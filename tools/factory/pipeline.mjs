/* ═══════════════════════════════════════════════════════════════════════════
 * pipeline.mjs — the generation half of the one-command factory:
 *
 *   CURRENT MAIN SYNC → LAB GENERATION → DUPLICATE/HARD-GATE/CATEGORY CHECKS
 *   → INDEPENDENT AUDITOR → TARGETED LAB REVISION → INDEPENDENT REAUDIT
 *   → FINAL APPROVED MISSIONS
 *
 * Reuses tools/import-approved-missions.mjs's loadCurrentData() for "current
 * main sync" -- never a second copy of that logic. Everything here writes
 * an artifact per stage (see artifacts.mjs) so a human (or a test) can see
 * exactly what happened without re-running the models.
 * ══════════════════════════════════════════════════════════════════════════*/
import { loadCurrentData } from "../import-approved-missions.mjs";
import { fingerprintExistingMissions, runPreAuditChecks, structuralFingerprint, HARD_GATE_CHECKLIST, PHASE3_CONSTRAINTS } from "./fingerprint.mjs";
import { validateLabOutput, validateAuditorInput, validateAuditorOutput, validateRevisionPacket, validateFinalApprovedBatch, validateOrRetry } from "./schemas.mjs";

export const MAX_REVISION_ROUNDS = 3;

export async function syncCurrentMain(repoRoot) {
  const current = loadCurrentData(repoRoot);
  const packKeys = new Set(current.PACKS.map((p) => p.key).filter((k) => k !== "all"));
  const existingFingerprints = fingerprintExistingMissions(current.missions);
  return {
    current,
    packKeys,
    existingFingerprints,
    inventoryStamp: {
      mission_count: current.missions.length,
      max_id: current.missions.reduce((mx, m) => Math.max(mx, m.id), 0),
      source_hash: hashString(current.source),
    },
  };
}

function hashString(s) {
  // Cheap, dependency-free content stamp -- good enough to detect "did
  // data.js change since we synced", not a cryptographic requirement.
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16);
}

async function generateLabBatch({ labAdapter, requestedCount, runId, sync, artifacts }) {
  const context = {
    runId,
    existingFingerprints: sync.existingFingerprints,
    packKeys: [...sync.packKeys],
  };
  const result = await validateOrRetry(
    (attempt, priorErrors) => labAdapter.generate(requestedCount, { ...context, priorErrors, attempt }),
    validateLabOutput,
    { maxAttempts: 2, context: "lab-output" }
  );
  artifacts.write("01-lab-generation", { ok: result.ok, attempts: result.attempts, errors: result.errors || null, value: result.value || null });
  if (!result.ok) {
    throw new FactoryFailClosedError(`Lab output failed schema validation after ${result.attempts} attempt(s): ${result.errors.join("; ")}`);
  }
  return result.value;
}

function runPreAuditStage({ candidates, sync, artifacts }) {
  const batchFingerprints = candidates.map((c) => structuralFingerprint(c));
  const results = candidates.map((candidate) => {
    const check = runPreAuditChecks(candidate, {
      existingFingerprints: sync.existingFingerprints,
      batchSiblingFingerprints: batchFingerprints,
      existingPackKeys: sync.packKeys,
    });
    return { lab_candidate_id: candidate.lab_candidate_id, ...check };
  });
  artifacts.write("02-preaudit-checks", results);
  return results;
}

async function auditOnce({ auditorAdapter, candidate, batchSiblings, sync, revisionRound, priorFindings, artifacts, stageLabel }) {
  const auditorInput = {
    candidate,
    batch_siblings: batchSiblings,
    existing_fingerprints: sync.existingFingerprints,
    hard_gate_checklist: HARD_GATE_CHECKLIST,
    phase3_constraints: PHASE3_CONSTRAINTS,
    revision_round: revisionRound,
    prior_findings: priorFindings || null,
  };
  const inputCheck = validateAuditorInput(auditorInput);
  if (!inputCheck.valid) {
    throw new FactoryFailClosedError(`Auditor input failed validation: ${inputCheck.errors.join("; ")}`);
  }
  const result = await validateOrRetry(
    () => auditorAdapter.audit(auditorInput),
    validateAuditorOutput,
    { maxAttempts: 2, context: "auditor-output" }
  );
  artifacts.write(`${stageLabel}-${candidate.lab_candidate_id}`, { ok: result.ok, attempts: result.attempts, errors: result.errors || null, input: auditorInput, output: result.value || null });
  if (!result.ok) {
    throw new FactoryFailClosedError(
      `Auditor output for ${candidate.lab_candidate_id} failed schema validation after ${result.attempts} attempt(s): ${result.errors.join("; ")}`
    );
  }
  return result.value;
}

export class FactoryFailClosedError extends Error {}

/** Runs the full generation pipeline. Returns a FinalApprovedBatch-shaped
 * object (validated) plus the full per-candidate audit trail. Throws
 * FactoryFailClosedError if any structured contract fails validation after
 * retry -- callers must not catch-and-continue past that. */
export async function runGenerationPipeline({ repoRoot, requestedCount, runId, labAdapter, auditorAdapter, artifacts }) {
  const sync = await syncCurrentMain(repoRoot);
  artifacts.write("00-site-fingerprint", sync.inventoryStamp);

  const labOutput = await generateLabBatch({ labAdapter, requestedCount, runId, sync, artifacts });
  const preAudit = runPreAuditStage({ candidates: labOutput.candidates, sync, artifacts });
  const preAuditByCandidateId = new Map(preAudit.map((p) => [p.lab_candidate_id, p]));

  const approved = [];
  const revisedButStillFailed = [];
  const rejectedOutright = [];

  for (const candidate of labOutput.candidates) {
    const pre = preAuditByCandidateId.get(candidate.lab_candidate_id);
    if (!pre.passed) {
      rejectedOutright.push({ candidate, reason: `pre-audit gate: ${pre.blockers.join("; ")}`, auditor_output: null });
      continue;
    }

    const siblings = labOutput.candidates.filter((c) => c.lab_candidate_id !== candidate.lab_candidate_id);
    let current = candidate;
    let round = 0;
    let priorFindings = null;
    let lastOutput = null;
    let settled = false;

    while (round <= MAX_REVISION_ROUNDS) {
      lastOutput = await auditOnce({
        auditorAdapter,
        candidate: current,
        batchSiblings: siblings,
        sync,
        revisionRound: round,
        priorFindings,
        artifacts,
        stageLabel: round === 0 ? "03-audit-initial" : `03-audit-reaudit-r${round}`,
      });

      if (lastOutput.auditor_verdict === "APPROVE_FOR_REAL_CHILD_PLAYTEST") {
        approved.push({ candidate: current, auditor_output: lastOutput, revision_round_used: round });
        settled = true;
        break;
      }
      if (lastOutput.auditor_verdict === "REJECT") {
        rejectedOutright.push({ candidate: current, reason: "auditor REJECT", auditor_output: lastOutput });
        settled = true;
        break;
      }

      // REVISE_AND_REAUDIT
      if (round === MAX_REVISION_ROUNDS) break; // no rounds left -- fall through to "still failed"

      const nextRound = round + 1;
      const revisionPacket = {
        original_candidate: current,
        auditor_findings: lastOutput.findings,
        revision_instructions: lastOutput.revision_instructions,
        revision_round: nextRound,
      };
      const packetCheck = validateRevisionPacket(revisionPacket);
      if (!packetCheck.valid) {
        throw new FactoryFailClosedError(`Revision packet failed validation: ${packetCheck.errors.join("; ")}`);
      }
      artifacts.write(`04-revision-packet-${candidate.lab_candidate_id}-r${nextRound}`, revisionPacket);

      const revised = await labAdapter.revise(revisionPacket);
      // Re-run the deterministic gate on the revised candidate too -- a
      // revision could accidentally introduce a new duplicate or invalid pack.
      const revisedPre = runPreAuditChecks(revised, {
        existingFingerprints: sync.existingFingerprints,
        batchSiblingFingerprints: siblings.map((c) => structuralFingerprint(c)),
        existingPackKeys: sync.packKeys,
      });
      artifacts.write(`04-revision-result-${candidate.lab_candidate_id}-r${nextRound}`, { revised, preAudit: revisedPre });
      if (!revisedPre.passed) {
        rejectedOutright.push({ candidate: revised, reason: `pre-audit gate after revision r${nextRound}: ${revisedPre.blockers.join("; ")}`, auditor_output: lastOutput });
        settled = true;
        break;
      }

      current = revised;
      priorFindings = lastOutput.findings;
      round = nextRound;
    }

    if (!settled) {
      revisedButStillFailed.push({ candidate: current, rounds: MAX_REVISION_ROUNDS, last_auditor_output: lastOutput });
    }
  }

  const finalBatch = {
    run_id: runId,
    approved,
    revised_but_still_failed: revisedButStillFailed,
    rejected_outright: rejectedOutright,
  };
  const finalCheck = validateFinalApprovedBatch(finalBatch);
  artifacts.write("05-final-approved-batch", { ok: finalCheck.valid, errors: finalCheck.errors, value: finalBatch });
  if (!finalCheck.valid) {
    throw new FactoryFailClosedError(`Final approved batch failed validation: ${finalCheck.errors.join("; ")}`);
  }

  return { finalBatch, sync };
}
