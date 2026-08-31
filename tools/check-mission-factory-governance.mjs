#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-factory-governance.mjs — regression suite for the PINNED
 * governance layer (tools/factory/governance/) that HG10 / Phase 3 checks
 * are built on.
 *
 * This file exists because an earlier build of the mission factory defined
 * its own ad hoc HARD_GATE_CHECKLIST / PHASE3_CONSTRAINTS lists directly in
 * tools/factory/fingerprint.mjs and called them authoritative JUMVI
 * governance -- they were not; they were invented for that implementation.
 * That has been replaced with pinned, versioned JSON
 * (tools/factory/governance/hg10-schema.json,
 * tools/factory/governance/physical-principles.json) consumed through
 * tools/factory/governance/governance.mjs, the ONLY module allowed to read
 * those files. This suite proves:
 *
 *   1. governance.mjs's exported versions/constants come from the JSON on
 *      disk, not a duplicate literal in source.
 *   2. fingerprint.mjs no longer defines its own rule lists.
 *   3. HG10 canonical completeness behaves exactly as specified: a complete
 *      genome passes; any missing canonical field hard-fails with the exact
 *      pinned HARD_FAIL — INCOMPLETE_PHYSICAL_GENOME (HG10) string.
 *   4. UNKNOWN is a valid-but-unresolved state, never silently treated as
 *      resolved, at both the governance-module level and the pipeline
 *      level (an Auditor that APPROVEs despite an open UNKNOWN field is
 *      overridden by the deterministic gate, not trusted).
 *   5. Phase 3's enforced hard constraints reject correctly; its
 *      judgment-required constraints are NEVER auto-rejected, only
 *      surfaced as flags (meta_rules.behavioral_risk_not_auto_reject).
 *   6. Governance drift cannot silently occur: pointing the loader at a
 *      deliberately mutated temp copy of the pinned JSON changes validator
 *      behavior accordingly (proves data-driven, not hardcoded), and
 *      pointing it at a directory with no governance files at all fails
 *      loudly rather than silently falling back to a default.
 *
 * Uses only fixtures/mocks -- no real LLM call, no real git/gh call, no
 * write to the real repo's data.js.
 *
 *   node tools/check-mission-factory-governance.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  HG10_SCHEMA,
  HG10_VERSION,
  HG10_HARD_FAIL_CODE,
  PHYSICAL_PRINCIPLES,
  PHYSICAL_PRINCIPLES_VERSION,
  validateHG10Genome,
  checkPhysicalPrinciples,
  loadGovernanceFrom,
} from "./factory/governance/governance.mjs";
import * as fingerprintModule from "./factory/fingerprint.mjs";
import { runPreAuditChecks } from "./factory/fingerprint.mjs";
import { runGenerationPipeline } from "./factory/pipeline.mjs";
import { RunArtifacts, newRunId } from "./factory/artifacts.mjs";
import { createMockLabAdapter } from "./factory/lab.mjs";
import { createMockAuditorAdapter } from "./factory/auditor.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");
const GOV_DIR = path.join(ROOT, "tools", "factory", "governance");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("Mission factory governance contract\n");

function fullGenome(overrides = {}) {
  const base = {};
  for (const f of HG10_SCHEMA.canonical_fields) base[f] = `resolved value for ${f}`;
  return { ...base, ...overrides };
}

const OK_FINDINGS = {
  existing_duplicate: { flag: false, detail: "none" },
  batch_duplicate: { flag: false, detail: "none" },
  hard_gate: { passed: true, failed_items: [] },
  phase3_physical: { passed: true, concerns: [] },
  structural_similarity: { score: 0, nearest: null },
  participation: { assessment: "balanced" },
  role_fairness: { assessment: "fair" },
  event_clarity: { assessment: "clear" },
  complexity: { assessment: "appropriate" },
  safety: { assessment: "acceptable", real_world_flags: [] },
  category_placement: { assessment: "correct", suggested_pack: null },
  evidence_quality: { assessment: "sufficient" },
};

/* ═══════════════════════════════════════════════════════════════════════
 * 1 — pinned versions/constants come from the JSON files, not source.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const rawHg10 = JSON.parse(fs.readFileSync(path.join(GOV_DIR, "hg10-schema.json"), "utf8"));
  const rawPhys = JSON.parse(fs.readFileSync(path.join(GOV_DIR, "physical-principles.json"), "utf8"));
  check("HG10_VERSION matches hg10-schema.json's own governance_version field", HG10_VERSION === rawHg10.governance_version);
  check("HG10_SCHEMA.canonical_fields has exactly 14 pinned fields", HG10_SCHEMA.canonical_fields.length === 14);
  check("HG10_HARD_FAIL_CODE matches the pinned hard_fail_code string verbatim", HG10_HARD_FAIL_CODE === "HARD_FAIL — INCOMPLETE_PHYSICAL_GENOME (HG10)");
  check("PHYSICAL_PRINCIPLES_VERSION matches physical-principles.json's own governance_version field", PHYSICAL_PRINCIPLES_VERSION === rawPhys.governance_version);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 — fingerprint.mjs defines no rule lists of its own.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const exportNames = Object.keys(fingerprintModule);
  check("fingerprint.mjs does not export HARD_GATE_CHECKLIST", !exportNames.includes("HARD_GATE_CHECKLIST"));
  check("fingerprint.mjs does not export PHASE3_CONSTRAINTS", !exportNames.includes("PHASE3_CONSTRAINTS"));
  const src = fs.readFileSync(path.join(ROOT, "tools/factory/fingerprint.mjs"), "utf8");
  check("fingerprint.mjs imports HG10/physical checks from governance.mjs rather than redefining them", /from ["']\.\/governance\/governance\.mjs["']/.test(src));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 — HG10 canonical completeness.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const complete = validateHG10Genome(fullGenome());
  check("a fully-resolved genome is complete, no hard fail", complete.complete === true && complete.hardFail === false);

  const empty = validateHG10Genome(undefined);
  check("an entirely absent genome hard-fails with all 14 fields missing", empty.hardFail === true && empty.missingFields.length === 14);
  check("the hard-fail code is the exact pinned string", empty.hardFailCode === HG10_HARD_FAIL_CODE);

  const oneMissing = validateHG10Genome(fullGenome({ safety_constraints: undefined }));
  check("missing exactly one canonical field hard-fails, naming that field", oneMissing.hardFail === true && oneMissing.missingFields.length === 1 && oneMissing.missingFields[0] === "safety_constraints");

  const legacy = fullGenome();
  delete legacy.core_actions; legacy.core_interactions = "legacy core interactions text";
  delete legacy.continuation; legacy.continuation_engine = "legacy continuation text";
  delete legacy.reentry; legacy.reentry_model = "legacy reentry text";
  delete legacy.consequences; legacy.success_consequences = "win text"; legacy.failure_consequences = "lose text";
  const normalized = validateHG10Genome(legacy);
  check("legacy field names (core_interactions/continuation_engine/reentry_model) normalize to canonical names", normalized.complete === true && normalized.missingFields.length === 0);
  check("success_consequences + failure_consequences merge into consequences", normalized.normalizedGenome.consequences && normalized.normalizedGenome.consequences.success_consequences === "win text");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 — UNKNOWN stays UNKNOWN, never silently resolved.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const withUnknown = validateHG10Genome(fullGenome({ continuation: "UNKNOWN" }));
  check("a field literally UNKNOWN is NOT a hard fail", withUnknown.hardFail === false && withUnknown.complete === true);
  check("...but IS reported separately via unknownFields/hasUnknown, never merged into 'resolved'", withUnknown.hasUnknown === true && withUnknown.unknownFields.includes("continuation"));
  check("the UNKNOWN marker is whitespace/case tolerant and still tracked, never silently dropped", validateHG10Genome(fullGenome({ reentry: "  unknown  " })).unknownFields.includes("reentry"));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 — Phase 3 enforced hard constraints vs. judgment-required constraints.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const tooManyPlayers = checkPhysicalPrinciples({ playerCountMax: 5, ballCountMax: 1, equipment: { paddles: 5, balls: 1 }, genome: fullGenome() });
  check("MAX_PLAYERS(4) is enforced — 5 players violates", tooManyPlayers.violations.some((v) => v.startsWith("MAX_PLAYERS")));

  const tooManyBalls = checkPhysicalPrinciples({ playerCountMax: 2, ballCountMax: 5, equipment: { paddles: 2, balls: 5 }, genome: fullGenome() });
  check("MAX_BALLS(4) is enforced — 5 balls violates", tooManyBalls.violations.some((v) => v.startsWith("MAX_BALLS")));

  const badEquip = checkPhysicalPrinciples({ playerCountMax: 2, ballCountMax: 1, equipment: { paddles: 2, balls: 1, racket: 1 }, genome: fullGenome() });
  check("EQUIPMENT_ALLOWLIST rejects non-JUMVI-set equipment", badEquip.violations.some((v) => v.startsWith("EQUIPMENT_ALLOWLIST")));

  const forbiddenBehavior = checkPhysicalPrinciples({ playerCountMax: 2, ballCountMax: 1, equipment: { paddles: 2, balls: 1 }, genome: fullGenome({ core_actions: "smash the ball with a racket swing" }) });
  check("FORBIDDEN_PADDLE_BEHAVIOR catches rebound/racket/strike-style mechanic language", forbiddenBehavior.violations.some((v) => v.startsWith("FORBIDDEN_PADDLE_BEHAVIOR")));

  const clean = checkPhysicalPrinciples({ playerCountMax: 2, ballCountMax: 1, equipment: { paddles: 2, balls: 1 }, genome: fullGenome({ core_actions: "catch the ball and present the paddle for a supported transfer" }) });
  check("allowed catch/receive/present/reposition language produces zero violations", clean.violations.length === 0);
  check("judgment-required constraints are always surfaced as flags, never auto-violations", clean.judgmentFlags.length === PHYSICAL_PRINCIPLES.judgment_required_constraints.length);

  const noBehaviorWordsAtAll = checkPhysicalPrinciples({ playerCountMax: 2, ballCountMax: 1, equipment: { paddles: 2, balls: 1 }, genome: fullGenome({ core_actions: "run to the marker and back" }) });
  check("absence of ALLOWED_PADDLE_BEHAVIOR vocabulary is never itself a violation (meta_rules.behavioral_risk_not_auto_reject)", noBehaviorWordsAtAll.violations.length === 0);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 — runPreAuditChecks: the deterministic pre-Auditor HG10 gate, end to end.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const packKeys = new Set(["Aim Master"]);

  const noGenome = { title: "No Genome Candidate", pack: "Aim Master", players: "2", equipment: { paddles: 2, balls: 1 }, steps: ["a", "b"] };
  const resultNoGenome = runPreAuditChecks(noGenome, { existingFingerprints: [], batchSiblingFingerprints: [], existingPackKeys: packKeys });
  check("a candidate with no physical_genome at all is blocked with the exact HG10 hard-fail code", resultNoGenome.blockers.some((b) => b.startsWith(HG10_HARD_FAIL_CODE)));

  const withFullGenome = { title: "Full Genome Candidate", pack: "Aim Master", players: "2", equipment: { paddles: 2, balls: 1 }, steps: ["a", "b"], physical_genome: fullGenome() };
  const resultFull = runPreAuditChecks(withFullGenome, { existingFingerprints: [], batchSiblingFingerprints: [], existingPackKeys: packKeys });
  check("a candidate with a fully-resolved genome is not blocked by HG10", !resultFull.blockers.some((b) => b.includes("HG10")));

  const withUnknownGenome = { title: "Unknown Genome Candidate", pack: "Aim Master", players: "2", equipment: { paddles: 2, balls: 1 }, steps: ["a", "b"], physical_genome: fullGenome({ reentry: "UNKNOWN" }) };
  const resultUnknown = runPreAuditChecks(withUnknownGenome, { existingFingerprints: [], batchSiblingFingerprints: [], existingPackKeys: packKeys });
  check("a candidate with one UNKNOWN genome field is not HG10 hard-failed", !resultUnknown.blockers.some((b) => b.includes("HG10")));
  check("...but IS flagged hasUnknownGenomeFields for downstream routing", resultUnknown.hasUnknownGenomeFields === true && resultUnknown.unknownGenomeFields.includes("reentry"));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 7 — pipeline-level: an Auditor APPROVE cannot silently override an open
 * UNKNOWN genome field. The scripted mock Auditor here deliberately
 * misbehaves (APPROVEs anyway) to prove the deterministic gate, not the
 * model, has the final say on this specific rule.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-gov-test-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.copyFileSync(path.join(ROOT, "data.js"), path.join(dir, "data.js"));
  fs.copyFileSync(path.join(ROOT, "src/worker.js"), path.join(dir, "src/worker.js"));

  const runId = newRunId();
  const artifacts = new RunArtifacts(dir, runId);

  const candidateTemplate = {
    title: "Governance Test Unknown Field",
    pack: "Aim Master",
    difficulty: 1,
    players: "2",
    time: "60s",
    age: "4+",
    equipment: { paddles: 2, balls: 1 },
    steps: ["Stand at the line", "Toss gently to your partner"],
    win: "Complete 5 gentle tosses in a row.",
    safety: "Keep every toss below shoulder height.",
    tip: "A soft underhand toss lands most predictably.",
    mechanics_summary: "Simple underhand toss-and-catch drill.",
    uniqueness_rationale: "Governance regression fixture, not a real candidate.",
    physical_genome: fullGenome({ reentry: "UNKNOWN" }),
  };

  const labAdapter = createMockLabAdapter({ fixtures: [candidateTemplate], reviseFn: () => ({}) });

  let auditCallCount = 0;
  const auditorAdapter = createMockAuditorAdapter({
    script: (auditorInput) => {
      auditCallCount += 1;
      check(
        `audit call #${auditCallCount}: hg10_status.hasUnknown is told to the Auditor explicitly (never left for it to guess)`,
        auditorInput.hg10_status?.hasUnknown === true && auditorInput.hg10_status.unknownFields.includes("reentry")
      );
      // A misbehaving/over-eager Auditor: APPROVEs despite the open UNKNOWN.
      // The pipeline's deterministic gate must not trust this at face value.
      return { lab_candidate_id: auditorInput.candidate.lab_candidate_id, auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST", findings: OK_FINDINGS, revision_instructions: null };
    },
  });

  const { finalBatch } = await runGenerationPipeline({ repoRoot: dir, requestedCount: 1, runId, labAdapter, auditorAdapter, artifacts });

  check(
    "a candidate the Auditor APPROVEs despite an UNKNOWN genome field is NEVER placed in the approved batch",
    !finalBatch.approved.some((e) => e.candidate.title === "Governance Test Unknown Field")
  );
  check(
    "...it is instead pushed through forced revision rounds and, once exhausted, lands in revised_but_still_failed — never silently accepted, never replaced with an invented substitute",
    finalBatch.revised_but_still_failed.some((e) => e.candidate.title === "Governance Test Unknown Field")
  );
  check("the deterministic override actually forced more than one audit round (proves it was not accepted on the first APPROVE)", auditCallCount > 1);

  fs.rmSync(dir, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 8 — governance drift cannot silently occur.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const driftDir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-gov-drift-"));
  const hg10Raw = JSON.parse(fs.readFileSync(path.join(GOV_DIR, "hg10-schema.json"), "utf8"));
  const physRaw = JSON.parse(fs.readFileSync(path.join(GOV_DIR, "physical-principles.json"), "utf8"));

  const driftedHg10 = {
    ...hg10Raw,
    governance_version: "1.0.1-drift-test",
    canonical_fields: hg10Raw.canonical_fields.filter((f) => f !== "safety_constraints"),
  };
  fs.writeFileSync(path.join(driftDir, "hg10-schema.json"), JSON.stringify(driftedHg10, null, 2));
  fs.writeFileSync(path.join(driftDir, "physical-principles.json"), JSON.stringify(physRaw, null, 2));

  const drifted = loadGovernanceFrom(driftDir);
  check("a drifted governance directory loads its OWN version, distinct from the pinned repo version", drifted.HG10_VERSION === "1.0.1-drift-test" && drifted.HG10_VERSION !== HG10_VERSION);

  const genomeMissingOnlySafety = fullGenome({ safety_constraints: undefined });
  const pinnedResult = validateHG10Genome(genomeMissingOnlySafety);
  const driftedResult = drifted.validateHG10Genome(genomeMissingOnlySafety);
  check("under the PINNED (real) governance, a genome missing safety_constraints hard-fails", pinnedResult.hardFail === true);
  check(
    "under a DRIFTED (test-only) copy where that field was removed from canonical_fields, the SAME genome is now complete — proving validator behavior is genuinely read from the JSON on disk, not duplicated/hardcoded in governance.mjs",
    driftedResult.hardFail === false
  );

  fs.rmSync(driftDir, { recursive: true, force: true });

  const emptyDir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-gov-empty-"));
  let threw = false;
  try {
    loadGovernanceFrom(emptyDir);
  } catch {
    threw = true;
  }
  check("loading governance from a directory with no pinned JSON files fails loudly (fail-closed) rather than silently defaulting to something", threw === true);
  fs.rmSync(emptyDir, { recursive: true, force: true });
}

/* ── report ───────────────────────────────────────────────────────────── */
if (failures) {
  console.log(`\n❌ ${failures} governance contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ HG10 canonical completeness, UNKNOWN handling (module and pipeline level), Phase 3 enforced/judgment separation, and drift-proofing all behave correctly.");
