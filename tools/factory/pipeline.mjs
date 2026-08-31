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
import { fingerprintExistingMissions, runPreAuditChecks, structuralFingerprint } from "./fingerprint.mjs";
import { HG10_SCHEMA, HG10_VERSION, PHYSICAL_PRINCIPLES, PHYSICAL_PRINCIPLES_VERSION } from "./governance/governance.mjs";
import { validateLabOutput, validateAuditorInput, validateAuditorOutput, validateRevisionPacket, validateFinalApprovedBatch, validateOrRetry } from "./schemas.mjs";

export const MAX_REVISION_ROUNDS = 3;

// The governance descriptor handed to every Auditor call. Sourced entirely
// from tools/factory/governance/governance.mjs (pinned JSON) -- this module
// never authors its own checklist, it only shapes what's already loaded
// there into the AuditorInput contract (see schemas.mjs's validateAuditorInput).
const GOVERNANCE_FOR_AUDITOR = Object.freeze({
  hg10_version: HG10_VERSION,
  hg10_canonical_fields: HG10_SCHEMA.canonical_fields,
  physical_principles_version: PHYSICAL_PRINCIPLES_VERSION,
  judgment_flags: PHYSICAL_PRINCIPLES.judgment_required_constraints.map((j) => ({ id: j.id, description: j.description })),
});

function hg10StatusFromPreAudit(pre) {
  return {
    complete: pre.hg10.complete,
    hasUnknown: pre.hasUnknownGenomeFields,
    unknownFields: pre.unknownGenomeFields,
  };
}

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

async function auditOnce({ auditorAdapter, candidate, batchSiblings, sync, revisionRound, priorFindings, artifacts, stageLabel, hg10Status }) {
  const auditorInput = {
    candidate,
    batch_siblings: batchSiblings,
    existing_fingerprints: sync.existingFingerprints,
    governance: GOVERNANCE_FOR_AUDITOR,
    hg10_status: hg10Status,
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
    let currentPre = pre;
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
        hg10Status: hg10StatusFromPreAudit(currentPre),
      });

      const verdict = lastOutput.auditor_verdict;
      // Governance rule (physical-principles.json meta_rules.unknown_stays_
      // unknown): a genome field the deterministic gate found still marked
      // UNKNOWN is never silently treated as resolved -- even if the
      // Auditor itself returns APPROVE. The pipeline never trusts a model
      // to have quietly resolved something it was explicitly told (via
      // hg10_status) was still open; it downgrades that case into a forced
      // revision round instead.
      const blockedByUnknownGenome = verdict === "APPROVE_FOR_REAL_CHILD_PLAYTEST" && currentPre.hasUnknownGenomeFields;

      if (verdict === "APPROVE_FOR_REAL_CHILD_PLAYTEST" && !blockedByUnknownGenome) {
        approved.push({ candidate: current, auditor_output: lastOutput, revision_round_used: round });
        settled = true;
        break;
      }
      if (verdict === "REJECT") {
        rejectedOutright.push({ candidate: current, reason: "auditor REJECT", auditor_output: lastOutput });
        settled = true;
        break;
      }

      // REVISE_AND_REAUDIT, or an APPROVE downgraded above.
      if (round === MAX_REVISION_ROUNDS) break; // no rounds left -- fall through to "still failed"

      const nextRound = round + 1;
      const findingsForRevision = blockedByUnknownGenome
        ? { ...lastOutput.findings, hg10_unknown_fields: { flag: true, detail: `Auditor approved, but HG10 field(s) remain UNKNOWN and cannot be silently accepted: ${currentPre.unknownGenomeFields.join(", ")}` } }
        : lastOutput.findings;
      const revisionInstructions = blockedByUnknownGenome
        ? `HG10 field(s) remain UNKNOWN and cannot be silently approved: resolve ${currentPre.unknownGenomeFields.join(", ")}.`
        : lastOutput.revision_instructions;

      const revisionPacket = {
        original_candidate: current,
        auditor_findings: findingsForRevision,
        revision_instructions: revisionInstructions,
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
      currentPre = revisedPre;
      priorFindings = findingsForRevision;
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
