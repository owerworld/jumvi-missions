#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-factory-durability.mjs — regression suite for the durable,
 * resumable mission-factory workflow: generation persists state and EXITS
 * (no long-lived process blocking on stdin), a later — possibly in a
 * completely separate `node` process — `--resume <RUN_ID> --approve` or
 * `--cancel` picks the SAME audited batch back up from disk, and every
 * state transition is validated (a cancelled run can never be approved, a
 * published run can never be republished, a corrupt run file fails closed).
 *
 * This exists because a real run of `node tools/jumvi-mission-factory.mjs
 * --count 6` (session history) got stuck holding a live readline prompt on
 * a detached background process, and the sandbox reclaimed that process
 * between conversation turns before a decision could be delivered to it --
 * losing the run even though nothing was ever actually wrong with the
 * generated batch. The fix removes the long-lived-process dependency
 * entirely; this suite is the proof.
 *
 * Uses only fixtures/mocks — no real LLM call, no real git/gh call, no
 * write to the real repo's data.js. Tests 8/9 spawn REAL, separate `node`
 * subprocesses (via execFileSync) specifically to prove cross-process
 * durability — not an in-process simulation of it.
 *
 *   node tools/check-mission-factory-durability.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";
import { execFileSync } from "node:child_process";

import { runGenerate, runResumeApprove, runResumeCancel } from "./jumvi-mission-factory.mjs";
import { createMockLabAdapter } from "./factory/lab.mjs";
import { createMockAuditorAdapter } from "./factory/auditor.mjs";
import { createFakeAdapters } from "./factory/adapters/fake.mjs";
import { newRunId, runDir } from "./factory/artifacts.mjs";
import { RUN_STATES, readRunState } from "./factory/run-state.mjs";

const ROOT = path.resolve(import.meta.dirname, "..");

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("Mission factory durability / resumable-approval contract\n");

/* ── sandbox + fixture helpers (self-contained, matches the pattern
 *    tools/check-mission-factory.mjs and *-governance.mjs already use) ──── */
function makeSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-durability-test-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "data"));
  fs.copyFileSync(path.join(ROOT, "data.js"), path.join(dir, "data.js"));
  fs.copyFileSync(path.join(ROOT, "src/worker.js"), path.join(dir, "src/worker.js"));
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

const OK_FINDINGS = Object.freeze({
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
});

function candidateTemplate(title = "Durability Test Mission") {
  return {
    title,
    pack: "Aim Master",
    difficulty: 1,
    players: "2",
    time: "45s",
    age: "4+",
    equipment: { paddles: 2, balls: 1 },
    steps: ["Stand at the line", "Toss gently to your partner"],
    win: "Complete 5 gentle tosses in a row.",
    safety: "Keep every toss below shoulder height.",
    tip: "A soft underhand toss lands most predictably.",
    mechanics_summary: "Durability-suite fixture, not a real candidate.",
    uniqueness_rationale: "Durability-suite fixture, not a real candidate.",
    physical_genome: {
      player_count: 2,
      ball_count: 1,
      starting_positions: "Both players stand at a marked line.",
      roles: "tosser (alternates), catcher (alternates)",
      starting_possession: "Player 1 holds the ball first.",
      objective: "Complete 5 gentle tosses in a row.",
      core_actions: ["toss gently underhand", "catch the incoming toss"],
      event_triggers: "A toss goes above shoulder height.",
      consequences: "An out-of-range toss resets the streak to zero.",
      role_transitions: "Tosser and catcher swap after every toss.",
      continuation: "Tossing continues until 5 in a row are completed.",
      reentry: "n/a -- no player ever leaves the activity.",
      difficulty_variables: "Distance apart can be adjusted.",
      safety_constraints: "Keep every toss below shoulder height.",
    },
  };
}

function alwaysApproveAuditor() {
  return createMockAuditorAdapter({
    script: (input) => ({
      lab_candidate_id: input.candidate.lab_candidate_id,
      auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST",
      findings: OK_FINDINGS,
      revision_instructions: null,
    }),
  });
}

function buildGenerateAdapters(title) {
  return {
    labAdapter: createMockLabAdapter({ fixtures: [candidateTemplate(title)], reviseFn: () => ({}) }),
    auditorAdapter: alwaysApproveAuditor(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
 * 1 — generation persists WAITING_FOR_HUMAN_APPROVAL and returns; it never
 * takes an approvalFn / never blocks on stdin.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Waiting State");
  const runId = newRunId();

  const result = await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });

  check("runGenerate() has no approvalFn/decision parameter at all -- there is nothing to block on", !("approvalFn" in result));
  check("runGenerate() outcome is 'waiting-for-approval'", result.outcome === "waiting-for-approval");
  const state = readRunState(runDir(sandbox, runId));
  check("the persisted run state is WAITING_FOR_HUMAN_APPROVAL", state.state === RUN_STATES.WAITING_FOR_HUMAN_APPROVAL);
  check("generation never wrote to data.js", missionCountOf(sandbox) === before);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 — resume + approve (in-process, but structurally proven to reload from
 * disk: runResumeApprove takes no finalBatch parameter at all).
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Approve Path");
  const runId = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });

  const fake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before, ciOutcome: "success", deployOutcome: "success" });
  const result = await runResumeApprove({
    repoRoot: sandbox, runId, gitAdapter: fake.git, githubAdapter: fake.github, cloudflareAdapter: fake.cloudflare,
    approvedBy: "Durability Tester", log: () => {}, logError: () => {},
  });

  check("runResumeApprove() outcome is 'published'", result.outcome === "published", JSON.stringify(result).slice(0, 300));
  check("sandbox data.js now has +1 mission", missionCountOf(sandbox) === before + 1);
  check("the persisted run state is PUBLISHED", readRunState(runDir(sandbox, runId)).state === RUN_STATES.PUBLISHED);
  check("a PR was created exactly once", fake.state.prs.length === 1);
  check("the PR was merged", fake.state.merged !== null);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 — resume + cancel: zero repository writes, state moves to CANCELLED.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const originalSource = readSandboxSource(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Cancel Path");
  const runId = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });

  const result = await runResumeCancel({ repoRoot: sandbox, runId, log: () => {}, logError: () => {} });

  check("runResumeCancel() outcome is 'iptal'", result.outcome === "iptal");
  check("sandbox data.js is byte-identical to before the run", readSandboxSource(sandbox) === originalSource);
  check("the persisted run state is CANCELLED", readRunState(runDir(sandbox, runId)).state === RUN_STATES.CANCELLED);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 — stale main after the review was already shown: the existing
 * re-validation-before-APPLY protection still applies, reached through the
 * NEW resume path (not a special case that had to be re-implemented).
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Stale Main Path");
  const runId = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });

  // Simulate someone else merging a mission directly to "main" strictly
  // between the review being shown and the human approving it.
  const src = readSandboxSource(sandbox);
  const arrayStart = src.indexOf("const missions = [");
  const closeIdx = src.indexOf("\n];\n", arrayStart);
  const insertAt = closeIdx + 1;
  const injected = src.slice(0, insertAt) +
    `  m(${before + 1},"Reflex Rush","Injected Drift Mission",1,"2","45s","3+",["Unrelated drift step one","Unrelated drift step two"],"Unrelated drift win.","Unrelated drift safety.","Unrelated drift tip.",{paddles:2,balls:1}),\n` +
    src.slice(insertAt);
  fs.writeFileSync(path.join(sandbox, "data.js"), injected);

  const fake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before + 1, ciOutcome: "success" });
  const result = await runResumeApprove({
    repoRoot: sandbox, runId, gitAdapter: fake.git, githubAdapter: fake.github, cloudflareAdapter: fake.cloudflare,
    approvedBy: "Durability Tester", log: () => {}, logError: () => {},
  });

  check("stale main (safe drift) still resumes to 'published' after re-validating", result.outcome === "published", JSON.stringify(result).slice(0, 300));
  check("final count is before+1(drift)+1(ours)", missionCountOf(sandbox) === before + 2);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 — corrupted / missing run state fails closed, and never leaves a
 * partially-transitioned run behind.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();

  // 5a: a run id that was never generated.
  let threwNotFound = false;
  try {
    await runResumeApprove({ repoRoot: sandbox, runId: "never-existed-run-id", log: () => {}, logError: () => {} });
  } catch (e) {
    threwNotFound = e.constructor.name === "RunNotFoundError";
  }
  check("approving a run id that was never generated fails closed (RunNotFoundError)", threwNotFound);

  // 5b: state.json exists but is corrupt JSON.
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Corrupt State");
  const runId1 = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId: runId1, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });
  fs.writeFileSync(path.join(runDir(sandbox, runId1), "state.json"), "{ not valid json ][");
  let threwCorrupt = false;
  try {
    await runResumeApprove({ repoRoot: sandbox, runId: runId1, log: () => {}, logError: () => {} });
  } catch (e) {
    threwCorrupt = e.constructor.name === "CorruptRunStateError";
  }
  check("a corrupted state.json fails closed (CorruptRunStateError), never guessed at", threwCorrupt);

  // 5c: state.json is valid and WAITING, but the persisted batch file is
  // missing/corrupt -- must ALSO fail closed, and must NOT have already
  // transitioned the run to PUBLISHING before discovering that.
  const runId2 = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId: runId2, labAdapter: createMockLabAdapter({ fixtures: [candidateTemplate("Durability Missing Batch")], reviseFn: () => ({}) }), auditorAdapter: alwaysApproveAuditor(), log: () => {}, logError: () => {} });
  fs.rmSync(path.join(runDir(sandbox, runId2), "05-final-approved-batch.json"));
  let threwMissingBatch = false;
  try {
    await runResumeApprove({ repoRoot: sandbox, runId: runId2, log: () => {}, logError: () => {} });
  } catch (e) {
    threwMissingBatch = e.constructor.name === "CorruptRunStateError";
  }
  check("a missing persisted-batch file fails closed (CorruptRunStateError)", threwMissingBatch);
  check("...and the run was NOT left half-transitioned into PUBLISHING -- it's still WAITING_FOR_HUMAN_APPROVAL", readRunState(runDir(sandbox, runId2)).state === RUN_STATES.WAITING_FOR_HUMAN_APPROVAL);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 — double approval / republish prevention: once PUBLISHED, a second
 * approve is refused and nothing is published twice.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Double Approve");
  const runId = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });

  const fake1 = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before, ciOutcome: "success" });
  const first = await runResumeApprove({ repoRoot: sandbox, runId, gitAdapter: fake1.git, githubAdapter: fake1.github, cloudflareAdapter: fake1.cloudflare, approvedBy: "Durability Tester", log: () => {}, logError: () => {} });
  check("first approve publishes successfully", first.outcome === "published");
  check("mission count is +1 after the first approve", missionCountOf(sandbox) === before + 1);

  const fake2 = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before + 1, ciOutcome: "success" });
  const second = await runResumeApprove({ repoRoot: sandbox, runId, gitAdapter: fake2.git, githubAdapter: fake2.github, cloudflareAdapter: fake2.cloudflare, approvedBy: "Durability Tester Again", log: () => {}, logError: () => {} });
  check("a second approve of the SAME run is refused, not silently re-published", second.outcome === "refused" && second.currentState === RUN_STATES.PUBLISHED);
  check("mission count is STILL only +1 -- nothing was published twice", missionCountOf(sandbox) === before + 1);
  check("the second approve never touched the (fresh) fake GitHub adapter -- no second PR", fake2.state.prs.length === 0);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 7 — cancelled run cannot publish.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability Cancelled Cannot Publish");
  const runId = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });
  await runResumeCancel({ repoRoot: sandbox, runId, log: () => {}, logError: () => {} });

  const fake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before, ciOutcome: "success" });
  const attempt = await runResumeApprove({ repoRoot: sandbox, runId, gitAdapter: fake.git, githubAdapter: fake.github, cloudflareAdapter: fake.cloudflare, approvedBy: "Durability Tester", log: () => {}, logError: () => {} });

  check("approving an already-cancelled run is refused", attempt.outcome === "refused" && attempt.currentState === RUN_STATES.CANCELLED);
  check("sandbox data.js is untouched", missionCountOf(sandbox) === before);
  check("no PR was ever created for the cancelled run", fake.state.prs.length === 0);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 8 — CI failure still prevents merge through the resume path, AND a
 * PUBLISH_STOPPED run is terminal (never silently retried).
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);
  const { labAdapter, auditorAdapter } = buildGenerateAdapters("Durability CI Failure");
  const runId = newRunId();
  await runGenerate({ repoRoot: sandbox, requestedCount: 1, runId, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });

  const fake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before, ciOutcome: "failure" });
  const result = await runResumeApprove({ repoRoot: sandbox, runId, gitAdapter: fake.git, githubAdapter: fake.github, cloudflareAdapter: fake.cloudflare, approvedBy: "Durability Tester", log: () => {}, logError: () => {} });

  check("CI failure: outcome is 'publish-stopped'", result.outcome === "publish-stopped");
  check("CI failure: stopped at stage 'ci-failed'", result.stage === "ci-failed");
  check("CI failure: a PR was still opened (visible)", fake.state.prs.length === 1);
  check("CI failure: nothing was merged", fake.state.merged === null);
  check("the persisted run state is PUBLISH_STOPPED", readRunState(runDir(sandbox, runId)).state === RUN_STATES.PUBLISH_STOPPED);

  const retryFake = createFakeAdapters({ repoRoot: sandbox, initialMainMissionCount: before, ciOutcome: "success" });
  const retry = await runResumeApprove({ repoRoot: sandbox, runId, gitAdapter: retryFake.git, githubAdapter: retryFake.github, cloudflareAdapter: retryFake.cloudflare, approvedBy: "Durability Tester", log: () => {}, logError: () => {} });
  check("a PUBLISH_STOPPED run is terminal -- re-approving it is refused, never silently retried", retry.outcome === "refused" && retry.currentState === RUN_STATES.PUBLISH_STOPPED);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 9 — REAL cross-process proof: generation happens in one `node` process
 * that fully exits, then a COMPLETELY SEPARATE `node` process (no shared
 * memory whatsoever) loads the RUN_ID and approves. This is the literal
 * scenario the durability rework exists for.
 * ═══════════════════════════════════════════════════════════════════════*/
const HARNESS_SRC = `
import path from "node:path";
import { pathToFileURL } from "node:url";

const [, , mode, repoRoot, ...rest] = process.argv;
const factoryUrl = pathToFileURL(process.env.FACTORY_MJS_PATH).href;
const { runGenerate, runResumeApprove, runResumeCancel } = await import(factoryUrl);

const OK_FINDINGS = {
  existing_duplicate: { flag: false, detail: "none" }, batch_duplicate: { flag: false, detail: "none" },
  hard_gate: { passed: true, failed_items: [] }, phase3_physical: { passed: true, concerns: [] },
  structural_similarity: { score: 0, nearest: null }, participation: { assessment: "balanced" },
  role_fairness: { assessment: "fair" }, event_clarity: { assessment: "clear" }, complexity: { assessment: "appropriate" },
  safety: { assessment: "acceptable", real_world_flags: [] }, category_placement: { assessment: "correct", suggested_pack: null },
  evidence_quality: { assessment: "sufficient" },
};

if (mode === "generate") {
  const { createMockLabAdapter } = await import(pathToFileURL(process.env.LAB_MJS_PATH).href);
  const { createMockAuditorAdapter } = await import(pathToFileURL(process.env.AUDITOR_MJS_PATH).href);
  const requestedCount = Number(rest[0]);
  const title = rest[1];
  const template = {
    title, pack: "Aim Master", difficulty: 1, players: "2", time: "45s", age: "4+",
    equipment: { paddles: 2, balls: 1 },
    steps: ["Stand at the line", "Toss gently to your partner"],
    win: "Complete 5 gentle tosses in a row.", safety: "Keep every toss below shoulder height.",
    tip: "A soft underhand toss lands most predictably.",
    mechanics_summary: "Cross-process durability fixture.", uniqueness_rationale: "Cross-process durability fixture.",
    physical_genome: {
      player_count: 2, ball_count: 1, starting_positions: "x", roles: "x", starting_possession: "x",
      objective: "x", core_actions: ["toss"], event_triggers: "x", consequences: "x", role_transitions: "x",
      continuation: "x", reentry: "x", difficulty_variables: "x", safety_constraints: "Keep every toss below shoulder height.",
    },
  };
  const labAdapter = createMockLabAdapter({ fixtures: [template], reviseFn: () => ({}) });
  const auditorAdapter = createMockAuditorAdapter({ script: (input) => ({ lab_candidate_id: input.candidate.lab_candidate_id, auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST", findings: OK_FINDINGS, revision_instructions: null }) });
  const result = await runGenerate({ repoRoot, requestedCount, labAdapter, auditorAdapter, log: () => {}, logError: () => {} });
  process.stdout.write(JSON.stringify({ outcome: result.outcome, runId: result.runId }));
} else if (mode === "approve") {
  const { createFakeAdapters } = await import(pathToFileURL(process.env.FAKE_MJS_PATH).href);
  const runId = rest[0];
  const initialMainMissionCount = Number(rest[1]);
  const ciOutcome = rest[2] || "success";
  const fake = createFakeAdapters({ repoRoot, initialMainMissionCount, ciOutcome });
  const result = await runResumeApprove({ repoRoot, runId, gitAdapter: fake.git, githubAdapter: fake.github, cloudflareAdapter: fake.cloudflare, approvedBy: "Cross-Process Durability Test", log: () => {}, logError: () => {} });
  process.stdout.write(JSON.stringify({ outcome: result.outcome, stage: result.stage ?? null, deploymentResult: result.deploymentResult ?? null }));
} else if (mode === "cancel") {
  const runId = rest[0];
  const result = await runResumeCancel({ repoRoot, runId, log: () => {}, logError: () => {} });
  process.stdout.write(JSON.stringify({ outcome: result.outcome }));
} else {
  throw new Error("unknown harness mode: " + mode);
}
`;

function runHarness(mode, repoRoot, extraArgs) {
  const harnessPath = path.join(os.tmpdir(), `jumvi-durability-harness-${process.pid}.mjs`);
  fs.writeFileSync(harnessPath, HARNESS_SRC);
  const env = {
    ...process.env,
    FACTORY_MJS_PATH: path.join(ROOT, "tools/jumvi-mission-factory.mjs"),
    LAB_MJS_PATH: path.join(ROOT, "tools/factory/lab.mjs"),
    AUDITOR_MJS_PATH: path.join(ROOT, "tools/factory/auditor.mjs"),
    FAKE_MJS_PATH: path.join(ROOT, "tools/factory/adapters/fake.mjs"),
  };
  try {
    const stdout = execFileSync("node", [harnessPath, mode, repoRoot, ...extraArgs], { encoding: "utf8", env });
    return JSON.parse(stdout);
  } finally {
    fs.rmSync(harnessPath, { force: true });
  }
}

{
  const sandbox = makeSandbox();
  const before = missionCountOf(sandbox);

  // Process A: generate, then this process exits completely -- execFileSync
  // does not return until the child has fully terminated.
  const genResult = runHarness("generate", sandbox, ["1", "Cross Process Durability Mission"]);
  check("generate subprocess reports 'waiting-for-approval'", genResult.outcome === "waiting-for-approval");
  check("generate subprocess wrote no missions to data.js", missionCountOf(sandbox) === before);
  const runId = genResult.runId;
  check("the run's state is durably WAITING_FOR_HUMAN_APPROVAL, read by a THIRD process (this test itself)", readRunState(runDir(sandbox, runId)).state === RUN_STATES.WAITING_FOR_HUMAN_APPROVAL);

  // Process B: a COMPLETELY SEPARATE node invocation, no shared memory with
  // process A, resumes by RUN_ID alone and approves.
  const approveResult = runHarness("approve", sandbox, [runId, String(before), "success"]);
  check("approve subprocess (separate process) resumes the SAME audited batch and publishes", approveResult.outcome === "published", JSON.stringify(approveResult).slice(0, 300));
  check("the correct mission was published (title matches what process A generated)", missionCountOf(sandbox) === before + 1);
  check("final persisted state is PUBLISHED", readRunState(runDir(sandbox, runId)).state === RUN_STATES.PUBLISHED);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

{
  // Same cross-process proof, for the cancel path: generate in one process,
  // cancel in a second, separate one.
  const sandbox = makeSandbox();
  const originalSource = readSandboxSource(sandbox);

  const genResult = runHarness("generate", sandbox, ["1", "Cross Process Cancel Mission"]);
  const runId = genResult.runId;

  const cancelResult = runHarness("cancel", sandbox, [runId]);
  check("cancel subprocess (separate process) resumes and cancels the SAME run by RUN_ID", cancelResult.outcome === "iptal");
  check("sandbox data.js is byte-identical to before either subprocess ran", readSandboxSource(sandbox) === originalSource);
  check("final persisted state is CANCELLED", readRunState(runDir(sandbox, runId)).state === RUN_STATES.CANCELLED);

  fs.rmSync(sandbox, { recursive: true, force: true });
}

/* ── report ───────────────────────────────────────────────────────────── */
if (failures) {
  console.log(`\n❌ ${failures} durability contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ Generation persists and exits cleanly, resume works from a completely separate process, corrupt/missing run files fail closed, and every state transition (cancel, double-approve, republish, terminal PUBLISH_STOPPED) is validated.");
