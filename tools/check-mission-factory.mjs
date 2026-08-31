#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-factory.mjs — end-to-end regression suite for the ONE
 * COMMAND mission factory (tools/jumvi-mission-factory.mjs).
 *
 * Every test here drives the REAL runFactory() orchestration -- the exact
 * function the CLI's main() calls -- with mock Lab/Auditor adapters and
 * fake git/github/cloudflare adapters. The only "real" thing that runs is
 * the actual import (tools/import-approved-missions.mjs's planImport /
 * writeApply) against a throwaway sandbox directory, so a passing run here
 * proves the real write/meta-regen/validation plumbing, not just control
 * flow. NOTHING in this file touches the real repo's data.js, calls a real
 * LLM API, or makes a real GitHub/Cloudflare request.
 *
 *   node tools/check-mission-factory.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

import { runFactory } from "./jumvi-mission-factory.mjs";
import { createMockLabAdapter } from "./factory/lab.mjs";
import { createMockAuditorAdapter } from "./factory/auditor.mjs";
import { createFakeAdapters } from "./factory/adapters/fake.mjs";
import { createScriptedApproval } from "./factory/turkish-review.mjs";
import { newRunId } from "./factory/artifacts.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("Mission factory contract\n");

/* ── sandbox helpers ──────────────────────────────────────────────────── */
function makeSandbox({ withFailingSchemaCheck = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-factory-test-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.copyFileSync(path.join(ROOT, "data.js"), path.join(dir, "data.js"));
  fs.copyFileSync(path.join(ROOT, "src/worker.js"), path.join(dir, "src/worker.js"));
  if (withFailingSchemaCheck) {
    fs.mkdirSync(path.join(dir, "tools"));
    fs.writeFileSync(
      path.join(dir, "tools", "check-mission-schema.mjs"),
      '#!/usr/bin/env node\nconsole.error("forced failure for check-mission-factory.mjs test");\nprocess.exit(1);\n'
    );
  }
  return dir;
}

function missionCountOf(sandboxDir) {
  const src = fs.readFileSync(path.join(sandboxDir, "data.js"), "utf8");
  const { missions } = vm.runInContext(`${src}\n;({ missions });`, vm.createContext({}));
  return missions.length;
}

function readSandboxSource(sandboxDir) {
  return fs.readFileSync(path.join(sandboxDir, "data.js"), "utf8");
}

/* ── shared candidate fixtures ────────────────────────────────────────────
 * Four candidates, one per required Auditor path:
 *   Alpha  -> APPROVE on the first pass
 *   Beta   -> REVISE_AND_REAUDIT once, Lab revision fixes it, then APPROVE
 *   Gamma  -> REJECT outright (never revised)
 *   Delta  -> REVISE_AND_REAUDIT forever; the mock reviser never actually
 *             fixes it, so all 3 revision rounds are consumed and it is
 *             dropped -- proving "never invent a weak replacement".
 * ────────────────────────────────────────────────────────────────────── */
function candidateTemplates() {
  return [
    {
      title: "Factory Test Alpha",
      pack: "Aim Master",
      difficulty: 2,
      players: "2",
      time: "90s",
      age: "5+",
      equipment: { paddles: 2, balls: 1 },
      steps: ["Chalk a target ring on the ground", "Throw a soft arc so the ball lands inside the ring", "Award a point for every ring landing"],
      win: "Score 5 ring landings before your partner does.",
      safety: "Keep every arc well below head height.",
      tip: "A shorter arc lands more predictably than a long one.",
      mechanics_summary: "Target-ring landing accuracy drill.",
      continuation_note: "Builds directly on Rainbow Throws.",
      uniqueness_rationale: "Distinct ground-target landing mechanic not used elsewhere.",
      physical_genome: {
        player_count: 2,
        ball_count: 1,
        starting_positions: "Both players stand at a marked throwing line facing the chalked target ring.",
        roles: "thrower (alternates each turn), scorer (tracks ring landings)",
        starting_possession: "Player 1 holds the ball first.",
        objective: "Land the ball inside the chalked ring more times than your partner.",
        core_actions: ["throw a soft arc toward the ring", "catch or retrieve the ball after each throw"],
        event_triggers: "A throw lands inside the ring boundary.",
        consequences: "A ring landing scores one point for the thrower; players alternate turns regardless of outcome.",
        role_transitions: "Thrower and retriever roles swap after each throw.",
        continuation: "Play continues turn by turn until one player reaches 5 ring landings.",
        reentry: "n/a -- no player ever leaves the activity.",
        difficulty_variables: "Ring size and throwing-line distance can be adjusted for age or skill.",
        safety_constraints: "Keep every arc well below head height; no throwing at the other player.",
      },
    },
    {
      title: "Factory Test Beta",
      pack: "Focus Control",
      difficulty: 3,
      players: "2",
      time: "90s",
      age: "5+",
      equipment: { paddles: 2, balls: 1 },
      steps: ["Thrower counts down from three out loud", "Catcher must not move until zero", "Catch calmly on zero, then swap roles"],
      win: "Complete 8 countdown catches without an early flinch.",
      safety: "Countdown pace stays calm, never rushed.",
      tip: "Whisper the countdown for an extra calm-focus challenge.",
      mechanics_summary: "Countdown stillness-then-catch focus drill.",
      continuation_note: "Extends Silent Mode's stillness concept.",
      uniqueness_rationale: "Combines a spoken countdown with a stillness check, unlike any existing mission.",
      physical_genome: {
        player_count: 2,
        ball_count: 1,
        starting_positions: "Thrower and catcher stand two big steps apart, facing each other.",
        roles: "thrower (counts down and throws), catcher (must stay still until zero)",
        starting_possession: "Thrower holds the ball first.",
        objective: "Complete as many countdown catches as possible without an early flinch.",
        core_actions: ["count down from three out loud", "throw gently on zero", "catch calmly on zero"],
        event_triggers: "Catcher moves before the countdown reaches zero.",
        consequences: "An early flinch resets that countdown rep; a calm catch on zero counts toward the goal.",
        role_transitions: "Thrower and catcher swap roles after every countdown rep.",
        continuation: "Reps continue until 8 successful countdown catches are completed.",
        reentry: "n/a -- no player ever leaves the activity.",
        difficulty_variables: "Countdown pace and distance apart can be adjusted; whispering the countdown raises difficulty.",
        safety_constraints: "Countdown pace stays calm, never rushed; throws stay soft and low.",
      },
    },
    {
      title: "Factory Test Gamma",
      pack: "Team Duo",
      difficulty: 2,
      players: "3",
      time: "120s",
      age: "6+",
      equipment: { paddles: 3, balls: 1 },
      steps: ["Stand in a triangle formation", "Pass clockwise only, never backward", "Speed up the pass rhythm every 5 catches"],
      win: "Complete 15 clockwise triangle passes without a drop.",
      safety: "Keep triangle spacing wide enough that nobody crowds the passer.",
      tip: "Call the next receiver's name before you throw.",
      mechanics_summary: "Rotating three-player clockwise triangle toss.",
      continuation_note: "n/a",
      uniqueness_rationale: "(Auditor will REJECT this one regardless of rationale text.)",
      physical_genome: {
        player_count: 3,
        ball_count: 1,
        starting_positions: "Three players stand in a wide triangle formation, one big step further apart than a normal circle toss.",
        roles: "passer (currently holding the ball), two receivers",
        starting_possession: "One designated player holds the ball first.",
        objective: "Complete as many clockwise triangle passes as possible without a drop.",
        core_actions: ["call the next receiver's name", "pass the ball clockwise only", "catch the incoming pass"],
        event_triggers: "The ball is dropped, or a pass goes counter-clockwise.",
        consequences: "A drop or a backward pass resets the current pass streak to zero.",
        role_transitions: "The passer role moves clockwise to whichever player just caught the ball.",
        continuation: "Passing continues, speeding up every 5 catches, until 15 clockwise passes are completed without a drop.",
        reentry: "n/a -- no player ever leaves the activity.",
        difficulty_variables: "Triangle spacing and pass speed-up cadence can be adjusted.",
        safety_constraints: "Keep triangle spacing wide enough that nobody crowds the passer.",
      },
    },
    {
      title: "Factory Test Delta",
      pack: "Indoor Compact",
      difficulty: 1,
      players: "2",
      time: "60s",
      age: "4+",
      equipment: { paddles: 2, balls: 1 },
      steps: ["Sit cross-legged on a rug, one big step apart", "Toss underhand, low and soft"],
      win: "Have a good time tossing on the rug.",
      safety: "Keep every toss below chest height while seated.",
      tip: "Great for a small bedroom floor.",
      mechanics_summary: "Seated low-toss rug mechanic with an intentionally vague win condition.",
      continuation_note: "n/a",
      uniqueness_rationale: "(Auditor will REVISE_AND_REAUDIT forever; the mock reviser never fixes the vague win condition.)",
      physical_genome: {
        player_count: 2,
        ball_count: 1,
        starting_positions: "Both players sit cross-legged on a rug, one big step apart, facing each other.",
        roles: "tosser (alternates), catcher (alternates)",
        starting_possession: "Player 1 holds the ball first.",
        objective: "Toss and catch together while seated on the rug.",
        core_actions: ["toss underhand, low and soft", "catch the incoming toss while seated"],
        event_triggers: "A toss goes above chest height or outside catching reach.",
        consequences: "An out-of-range toss is simply re-tossed; there is no scoring or fixed end condition.",
        role_transitions: "Tosser and catcher swap after every toss.",
        continuation: "Tossing continues for the session with no specific completion trigger.",
        reentry: "n/a -- no player ever leaves the activity.",
        difficulty_variables: "Seated distance apart can be adjusted.",
        safety_constraints: "Keep every toss below chest height while seated.",
      },
    },
  ];
}

const OK_FINDINGS = Object.freeze({
  existing_duplicate: { flag: false, detail: "no overlap found" },
  batch_duplicate: { flag: false, detail: "no overlap found" },
  hard_gate: { passed: true, failed_items: [] },
  phase3_physical: { passed: true, concerns: [] },
  structural_similarity: { score: 0.1, nearest: null },
  participation: { assessment: "balanced" },
  role_fairness: { assessment: "fair" },
  event_clarity: { assessment: "clear" },
  complexity: { assessment: "appropriate" },
  safety: { assessment: "acceptable", real_world_flags: [] },
  category_placement: { assessment: "correct", suggested_pack: null },
  evidence_quality: { assessment: "sufficient" },
});

function scriptedAuditor(auditorInput) {
  const c = auditorInput.candidate;
  const round = auditorInput.revision_round;
  const base = { lab_candidate_id: c.lab_candidate_id, findings: OK_FINDINGS, revision_instructions: null };

  if (c.title.startsWith("Factory Test Alpha")) {
    return {
      ...base,
      auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST",
      findings: { ...OK_FINDINGS, safety: { assessment: "acceptable", real_world_flags: ["physical distance: confirm 2 big steps suits the youngest age band"] } },
    };
  }
  if (c.title.startsWith("Factory Test Beta")) {
    if (round === 0) {
      return {
        ...base,
        auditor_verdict: "REVISE_AND_REAUDIT",
        findings: { ...OK_FINDINGS, complexity: { assessment: "difficulty 3 is too high for a 2-step mission" } },
        revision_instructions: "Lower difficulty to 2 to match the two simple steps.",
      };
    }
    return { ...base, auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST" };
  }
  if (c.title.startsWith("Factory Test Gamma")) {
    return {
      ...base,
      auditor_verdict: "REJECT",
      findings: { ...OK_FINDINGS, existing_duplicate: { flag: true, detail: "mechanic is a near-exact match for an existing mission" } },
    };
  }
  if (c.title.startsWith("Factory Test Delta")) {
    return {
      ...base,
      auditor_verdict: "REVISE_AND_REAUDIT",
      findings: { ...OK_FINDINGS, hard_gate: { passed: false, failed_items: ["HG5: win condition is not objectively measurable"] } },
      revision_instructions: "Add a specific countable win condition.",
    };
  }
  throw new Error(`scriptedAuditor: no script for "${c.title}"`);
}

function reviseFn(original, findings, round) {
  if (original.title.startsWith("Factory Test Beta") && round === 1) {
    return { difficulty: 2 };
  }
  return {}; // Delta: no-op forever, by design
}

function buildAdapters({ sandbox, ciOutcome = "success", deployOutcome = "success" }) {
  const labAdapter = createMockLabAdapter({ fixtures: candidateTemplates(), reviseFn });
  const auditorAdapter = createMockAuditorAdapter({ script: scriptedAuditor });
  const fake = createFakeAdapters({
    repoRoot: sandbox,
    initialMainMissionCount: missionCountOf(sandbox),
    ciOutcome,
    deployOutcome,
  });
  return { labAdapter, auditorAdapter, fake };
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 1 — the full happy path, one command, end to end.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter, fake } = buildAdapters({ sandbox });

  const result = await runFactory({
    repoRoot: sandbox,
    requestedCount: 4,
    runId: newRunId(),
    labAdapter,
    auditorAdapter,
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    approvalFn: createScriptedApproval("ONAY"),
    approvedBy: "Test Approver",
    log: () => {},
    logError: () => {},
  });

  check("full run outcome is 'published'", result.outcome === "published", JSON.stringify(result).slice(0, 300));
  check("Alpha (immediate APPROVE) is in the approved batch", result.finalBatch.approved.some((e) => e.candidate.title === "Factory Test Alpha"));
  check("Beta (REVISE then APPROVE) is in the approved batch with revision_round_used=1",
    result.finalBatch.approved.some((e) => e.candidate.title === "Factory Test Beta" && e.revision_round_used === 1));
  check("Gamma (outright REJECT) is rejected, not approved", result.finalBatch.rejected_outright.some((e) => e.candidate.title === "Factory Test Gamma"));
  check("Delta (exhausts 3 revisions) lands in revised_but_still_failed, not approved and not invented a replacement",
    result.finalBatch.revised_but_still_failed.some((e) => e.candidate.title === "Factory Test Delta") &&
    !result.finalBatch.approved.some((e) => e.candidate.title === "Factory Test Delta"));
  check("exactly 2 missions were approved (Alpha + Beta only)", result.finalBatch.approved.length === 2);

  check("Turkish review counts match", result.review.counts.requested === 4 && result.review.counts.approved === 2 && result.review.counts.revised === 1 && result.review.counts.rejected === 2);
  check("Turkish review surfaces Alpha's real-world flag before approval", result.review.flags.some((f) => f.mission === "Factory Test Alpha"));

  check("deployment result reports merged", result.deploymentResult?.merged === true);
  check("deployment result reports production_verified", result.deploymentResult?.production_verified === true);
  check("live_mission_count reflects +2", result.deploymentResult?.live_mission_count === before + 2);
  check("both new titles verified on 'production'", ["Factory Test Alpha", "Factory Test Beta"].every((t) => result.deploymentResult.new_mission_titles_verified.includes(t)));
  check("sandbox data.js now has +2 missions", missionCountOf(sandbox) === before + 2);
  check("a PR was created exactly once", fake.state.prs.length === 1);
  check("the PR was merged", fake.state.merged !== null);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 2 — human İPTAL: zero repository writes.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const originalSource = readSandboxSource(sandbox);
  const { labAdapter, auditorAdapter, fake } = buildAdapters({ sandbox });

  const result = await runFactory({
    repoRoot: sandbox,
    requestedCount: 4,
    runId: newRunId(),
    labAdapter,
    auditorAdapter,
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    approvalFn: createScriptedApproval("IPTAL"),
    approvedBy: "Test Approver",
    log: () => {},
    logError: () => {},
  });

  check("İPTAL outcome is 'iptal'", result.outcome === "iptal");
  check("İPTAL: sandbox data.js byte-identical to before the run", readSandboxSource(sandbox) === originalSource);
  check("İPTAL: no branch was ever created", Object.keys(fake.state.branches).length === 0);
  check("İPTAL: no PR was ever created", fake.state.prs.length === 0);
  check("İPTAL: nothing was merged", fake.state.merged === null);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 3 — CI failure: PR exists, but never merged, publication stops.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const { labAdapter, auditorAdapter, fake } = buildAdapters({ sandbox, ciOutcome: "failure" });

  const result = await runFactory({
    repoRoot: sandbox,
    requestedCount: 4,
    runId: newRunId(),
    labAdapter,
    auditorAdapter,
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    approvalFn: createScriptedApproval("ONAY"),
    approvedBy: "Test Approver",
    log: () => {},
    logError: () => {},
  });

  check("CI failure: outcome is 'publish-stopped'", result.outcome === "publish-stopped");
  check("CI failure: stopped at stage 'ci-failed'", result.stage === "ci-failed");
  check("CI failure: a PR was still opened (so the failure is visible)", fake.state.prs.length === 1);
  check("CI failure: nothing was merged", fake.state.merged === null);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 4a — stale main (safe drift): re-validates and CONTINUES.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter, fake } = buildAdapters({ sandbox });
  const runId = newRunId();

  // Run GENERATION first, against the un-drifted sandbox (this is what the
  // batch was actually evaluated against) -- deliberately NOT using the
  // all-in-one runFactory() here, so the drift below happens strictly
  // between generation and publish, not before both.
  const { runGenerationPipeline } = await import("./factory/pipeline.mjs");
  const { RunArtifacts } = await import("./factory/artifacts.mjs");
  const artifacts = new RunArtifacts(sandbox, runId);
  const { finalBatch, sync } = await runGenerationPipeline({ repoRoot: sandbox, requestedCount: 4, runId, labAdapter, auditorAdapter, artifacts });
  check("safe drift setup: generation approved Alpha+Beta before any drift", finalBatch.approved.length === 2);

  // NOW simulate "someone else merged a mission" on main, strictly after
  // generation was evaluated: append a real, unrelated mission directly to
  // the sandbox's data.js (publishApprovedBatch re-reads this file fresh),
  // and tell the fake git adapter main's count moved too.
  const src = readSandboxSource(sandbox);
  const arrayStart = src.indexOf("const missions = [");
  const closeIdx = src.indexOf("\n];\n", arrayStart);
  const insertAt = closeIdx + 1; // right after the preceding "\n", before "];"
  const injected = src.slice(0, insertAt) +
    `  m(${before + 1},"Reflex Rush","Injected Drift Mission",1,"2","45s","3+",["Unrelated drift step one","Unrelated drift step two"],"Unrelated drift win.","Unrelated drift safety.","Unrelated drift tip.",{paddles:2,balls:1}),\n` +
    src.slice(insertAt);
  fs.writeFileSync(path.join(sandbox, "data.js"), injected);
  fake.simulateMainChanged({ sha: "drifted-sha", missionCount: before + 1 });

  const { publishApprovedBatch } = await import("./factory/publish.mjs");
  const result = await publishApprovedBatch({
    repoRoot: sandbox,
    runId,
    finalBatch,
    syncStamp: sync.inventoryStamp,
    approvedBy: "Test Approver",
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    artifacts,
  });

  check("safe drift: publication still succeeds after re-validating", result.stopped !== true, JSON.stringify(result).slice(0, 300));
  check("safe drift: final count is before+1(drift)+2(ours)", missionCountOf(sandbox) === before + 1 + 2);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 4b — stale main (colliding drift right before merge): STOPS, never merges.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter, fake } = buildAdapters({ sandbox });

  // First getMainState() call (pre-APPLY) reports the real, unchanged state;
  // the second call (immediately before merge) reports main having advanced
  // far enough to collide with the id range this branch already claimed.
  let call = 0;
  const originalGetMainState = fake.git.getMainState;
  fake.git.getMainState = async () => {
    call += 1;
    if (call === 1) return originalGetMainState();
    return { sha: "collide-sha", missionCount: before + 100 };
  };

  const result = await runFactory({
    repoRoot: sandbox,
    requestedCount: 4,
    runId: newRunId(),
    labAdapter,
    auditorAdapter,
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    approvalFn: createScriptedApproval("ONAY"),
    approvedBy: "Test Approver",
    log: () => {},
    logError: () => {},
  });

  check("colliding drift: outcome is 'publish-stopped'", result.outcome === "publish-stopped");
  check("colliding drift: stopped at 'stale-main-id-collision-before-merge'", result.stage === "stale-main-id-collision-before-merge");
  check("colliding drift: never merged (never force-merged past a collision)", fake.state.merged === null);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 5 — invalid structured model output fails closed (no guessing, no retry-forever).
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const originalSource = readSandboxSource(sandbox);
  const brokenLabAdapter = {
    kind: "mock-broken",
    async generate() {
      return { not_even_close_to: "the LabOutput contract" };
    },
    async revise() {
      throw new Error("should never be called in this test");
    },
  };
  const auditorAdapter = createMockAuditorAdapter({ script: scriptedAuditor });
  const fake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: missionCountOf(sandbox) });

  const result = await runFactory({
    repoRoot: sandbox,
    requestedCount: 4,
    runId: newRunId(),
    labAdapter: brokenLabAdapter,
    auditorAdapter,
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    approvalFn: createScriptedApproval("ONAY"),
    approvedBy: "Test Approver",
    log: () => {},
    logError: () => {},
  });

  check("invalid Lab output: outcome is 'fail-closed'", result.outcome === "fail-closed");
  check("invalid Lab output: fails at the generation stage, never reaches approval", result.stage === "generation");
  check("invalid Lab output: sandbox data.js untouched", readSandboxSource(sandbox) === originalSource);
  check("invalid Lab output: no PR was ever created", fake.state.prs.length === 0);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 6 — importer's own rejection still blocks publication -> no PR.
 * Defense in depth: even if the factory's own pre-checks had a blind spot,
 * planImport (the real importer) independently rejecting a candidate must
 * still stop publication before any branch/PR is created.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const existingTitle = (() => {
    const src = readSandboxSource(sandbox);
    const m = src.match(/m\(1,"[^"]+","([^"]+)"/);
    return m[1];
  })();

  const { publishApprovedBatch } = await import("./factory/publish.mjs");
  const fake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before });

  const finalBatch = {
    run_id: "test-run-importer-rejection",
    approved: [
      {
        candidate: {
          lab_candidate_id: "forced-duplicate",
          title: existingTitle, // deliberately collides with mission id 1's real title
          pack: "Aim Master",
          difficulty: 1,
          players: "2",
          time: "45s",
          age: "3+",
          equipment: { paddles: 2, balls: 1 },
          steps: ["a", "b"],
          win: "win",
          safety: "safety",
          tip: "tip",
        },
        auditor_output: { lab_candidate_id: "forced-duplicate", auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST", findings: OK_FINDINGS, revision_instructions: null },
        revision_round_used: 0,
      },
    ],
    revised_but_still_failed: [],
    rejected_outright: [],
  };

  const artifacts = new (await import("./factory/artifacts.mjs")).RunArtifacts(sandbox, "test-run-importer-rejection");
  const result = await publishApprovedBatch({
    repoRoot: sandbox,
    runId: "test-run-importer-rejection",
    finalBatch,
    syncStamp: { mission_count: before, max_id: before },
    approvedBy: "Test Approver",
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    artifacts,
  });

  check("importer rejection: publication stops", result.stopped === true);
  check("importer rejection: stage is 'import-plan-invalid'", result.stage === "import-plan-invalid");
  check("importer rejection: no PR was ever created", fake.state.prs.length === 0);
  check("importer rejection: no branch was ever created", Object.keys(fake.state.branches).length === 0);
  check("importer rejection: sandbox data.js untouched", missionCountOf(sandbox) === before);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * TEST 7 — a failing post-apply test stops publication before any push/PR.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox({ withFailingSchemaCheck: true });
  const { labAdapter, auditorAdapter, fake } = buildAdapters({ sandbox });

  const result = await runFactory({
    repoRoot: sandbox,
    requestedCount: 4,
    runId: newRunId(),
    labAdapter,
    auditorAdapter,
    gitAdapter: fake.git,
    githubAdapter: fake.github,
    cloudflareAdapter: fake.cloudflare,
    approvalFn: createScriptedApproval("ONAY"),
    approvedBy: "Test Approver",
    log: () => {},
    logError: () => {},
  });

  check("failing test: outcome is 'publish-stopped'", result.outcome === "publish-stopped");
  check("failing test: stopped at 'post-apply-tests-failed'", result.stage === "post-apply-tests-failed");
  check("failing test: no PR was ever created", fake.state.prs.length === 0);
  check("failing test: no branch was ever pushed/committed", Object.values(fake.state.branches).every((b) => !b.committed));

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ── report ───────────────────────────────────────────────────────────── */
if (failures) {
  console.log(`\n❌ ${failures} mission factory contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ One-command generation, revision loop, Turkish review, human gate, stale-main protection, and the full publish pipeline all behave correctly under every required fixture scenario.");
