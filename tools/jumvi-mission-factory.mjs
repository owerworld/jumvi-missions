#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * jumvi-mission-factory.mjs — THE one command, split into two DURABLE steps.
 *
 *   node tools/jumvi-mission-factory.mjs --count 6
 *     runs Lab -> pre-audit -> Auditor -> revision, shows the Turkish
 *     review, persists everything under artifacts/mission-runs/<RUN_ID>/,
 *     and EXITS. It never blocks a process on stdin waiting for a human.
 *
 *   node tools/jumvi-mission-factory.mjs --resume <RUN_ID> --approve
 *     the single ONAY, resumed from disk -- possibly minutes or hours
 *     later, in a completely different process. Re-fetches current main,
 *     re-validates if it moved, imports (reusing
 *     tools/import-approved-missions.mjs), runs tests, branches, pushes,
 *     opens a PR, waits for required CI + Cloudflare checks, merges only
 *     if green, waits for deploy, verifies production.
 *
 *   node tools/jumvi-mission-factory.mjs --resume <RUN_ID> --cancel
 *     the single İPTAL. Zero repository writes.
 *
 * WHY THIS SHAPE: a long-lived Node process holding a human approval
 * prompt open on stdin is fragile -- it cannot survive a crash, a
 * container restart, or (observed for real, driving this design) a
 * sandbox reclaiming a detached process between conversation turns. The
 * fix is not "make the process more robust" -- it's "don't require one
 * live process to span generation and approval at all". Every fact
 * needed to resume (the audited batch, the site fingerprint it was
 * generated against, the run's current state) lives on disk, validated
 * via tools/factory/run-state.mjs's state machine, never in memory. A
 * --resume --approve run reloads the SAME persisted batch; it never
 * regenerates.
 *
 * `runGenerate()` / `runResumeApprove()` / `runResumeCancel()` are the
 * real, independently-callable, independently-testable primitives --
 * exported so tools/check-mission-factory-durability.mjs can drive a
 * literal two-separate-process crash/resume scenario. `runFactory()`
 * below is a backward-compatible convenience composition of the three
 * (used by the interactive CLI's single-invocation feel is gone by
 * design, but tools/check-mission-factory.mjs's existing scripted-
 * approval tests still exercise the exact same on-disk persistence
 * and resume path this way -- there is no separate "fast path" that
 * skips the durable state machine).
 *
 * main() below prefers the locally authenticated `claude` and `gh` CLIs
 * (adapters/dependency-check.mjs) over ANTHROPIC_API_KEY/GITHUB_TOKEN, and
 * scopes each dependency check to what that specific command actually
 * uses: generate never touches GitHub; --resume never calls the Lab or
 * Auditor. Default console output is quiet -- pass --verbose for the full
 * stage-by-stage trace.
 * ══════════════════════════════════════════════════════════════════════════*/
import { readFileSync } from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { parseArgs } from "./import-approved-missions.mjs";
import { newRunId, RunArtifacts, runDir } from "./factory/artifacts.mjs";
import { runGenerationPipeline, FactoryFailClosedError } from "./factory/pipeline.mjs";
import { formatTurkishReview } from "./factory/turkish-review.mjs";
import { publishApprovedBatch } from "./factory/publish.mjs";
import {
  RUN_STATES,
  initRunState,
  readRunState,
  transitionRunState,
  CorruptRunStateError,
} from "./factory/run-state.mjs";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function gitConfigUserName(repoRoot) {
  try {
    return execFileSync("git", ["config", "user.name"], { cwd: repoRoot, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

/** Reloads the exact batch a WAITING_FOR_HUMAN_APPROVAL run was audited
 * against -- from the same artifact files runGenerationPipeline() already
 * writes (05-final-approved-batch.json, 00-site-fingerprint.json). This is
 * the "never regenerates, never trusts in-memory state" guarantee: a
 * --resume --approve in a fresh process has nothing else to go on, so this
 * function is exercised on EVERY approve, not just the crash-recovery case. */
function loadPersistedBatch(dir) {
  let finalBatchRecord;
  try {
    finalBatchRecord = JSON.parse(readFileSync(path.join(dir, "05-final-approved-batch.json"), "utf8"));
  } catch (e) {
    throw new CorruptRunStateError(`could not load this run's approved batch (05-final-approved-batch.json): ${e.message}`);
  }
  let inventoryStamp;
  try {
    inventoryStamp = JSON.parse(readFileSync(path.join(dir, "00-site-fingerprint.json"), "utf8"));
  } catch (e) {
    throw new CorruptRunStateError(`could not load this run's site fingerprint (00-site-fingerprint.json): ${e.message}`);
  }
  if (!finalBatchRecord || !finalBatchRecord.value || !Array.isArray(finalBatchRecord.value.approved)) {
    throw new CorruptRunStateError("05-final-approved-batch.json is missing or malformed");
  }
  if (!inventoryStamp || typeof inventoryStamp.mission_count !== "number") {
    throw new CorruptRunStateError("00-site-fingerprint.json is missing or malformed");
  }
  return { finalBatch: finalBatchRecord.value, syncStamp: inventoryStamp };
}

/**
 * GENERATE. Runs Lab -> pre-audit -> Auditor -> revision, persists the
 * complete result under artifacts/mission-runs/<RUN_ID>/ (including
 * state.json in WAITING_FOR_HUMAN_APPROVAL, or FAILED on a fail-closed
 * pipeline error), prints the Turkish review, and RETURNS. Never blocks
 * on stdin, never holds a process open waiting for a human -- the caller
 * (main()'s CLI, or a test) decides separately, later, possibly in a
 * different process, via runResumeApprove()/runResumeCancel().
 */
export async function runGenerate({
  repoRoot = DEFAULT_REPO_ROOT,
  requestedCount,
  runId = newRunId(),
  labAdapter,
  auditorAdapter,
  verbose = false,
  log = console.log,
  logError = console.error,
} = {}) {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error("requestedCount must be a positive integer");
  }
  const artifacts = new RunArtifacts(repoRoot, runId);
  const vlog = verbose ? log : () => {};
  vlog(`JUMVI Mission Factory — run ${runId}`);
  vlog(`Artifacts: ${artifacts.dir}`);

  initRunState(artifacts.dir, { runId, requestedCount });

  vlog("\n→ CURRENT MAIN SYNC / LAB GENERATION / CHECKS / AUDITOR / REVISION LOOP / REAUDIT");
  let pipelineResult;
  try {
    pipelineResult = await runGenerationPipeline({ repoRoot, requestedCount, runId, labAdapter, auditorAdapter, artifacts });
  } catch (e) {
    const message = e.message;
    logError(`❌ Üretim durduruldu: ${message}`);
    artifacts.log(`FAIL-CLOSED: ${message}`);
    transitionRunState(artifacts.dir, RUN_STATES.FAILED, { failure_stage: "generation", failure_reason: message });
    if (!(e instanceof FactoryFailClosedError)) throw e;
    return { outcome: "fail-closed", stage: "generation", reason: message, runId, artifacts };
  }

  const { finalBatch } = pipelineResult;
  const review = formatTurkishReview(finalBatch, requestedCount);
  log(`\n${review.text}\n`);
  artifacts.write("06-turkish-review", review);

  transitionRunState(artifacts.dir, RUN_STATES.WAITING_FOR_HUMAN_APPROVAL, { approved_count: finalBatch.approved.length });

  log(`RUN_ID: ${runId}`);
  log(`Onaylamak için:  node tools/jumvi-mission-factory.mjs --resume ${runId} --approve`);
  log(`İptal etmek için: node tools/jumvi-mission-factory.mjs --resume ${runId} --cancel`);

  return { outcome: "waiting-for-approval", runId, finalBatch, review, artifacts };
}

/**
 * RESUME + APPROVE — the single ONAY. Loads the run's PERSISTED state and
 * batch from disk (never regenerates, never relies on anything held in
 * this process's memory), refuses (fail-closed) unless the run is
 * genuinely WAITING_FOR_HUMAN_APPROVAL right now — covering a run that
 * never existed, a corrupted run, one already cancelled, one already
 * published, or one already mid-publish — then runs the exact same
 * re-sync -> stale-check -> import -> tests -> branch -> PR -> CI -> merge
 * -> Cloudflare -> production-verify chain publishApprovedBatch always has.
 */
export async function runResumeApprove({
  repoRoot = DEFAULT_REPO_ROOT,
  runId,
  gitAdapter,
  githubAdapter,
  cloudflareAdapter,
  approvedBy,
  verbose = false,
  log = console.log,
  logError = console.error,
} = {}) {
  if (!runId) throw new Error("runId is required");
  const dir = runDir(repoRoot, runId);
  const vlog = verbose ? log : () => {};

  const current = readRunState(dir); // throws RunNotFoundError / CorruptRunStateError
  if (current.state !== RUN_STATES.WAITING_FOR_HUMAN_APPROVAL) {
    const reason = `run ${runId} is in state ${current.state}, not ${RUN_STATES.WAITING_FOR_HUMAN_APPROVAL} — refusing to approve (never re-approves, never double-publishes).`;
    logError(`❌ ${reason}`);
    return { outcome: "refused", stage: "invalid-state", reason, runId, currentState: current.state };
  }

  const { finalBatch, syncStamp } = loadPersistedBatch(dir); // throws CorruptRunStateError

  const artifacts = new RunArtifacts(repoRoot, runId);
  const resolvedApprovedBy = approvedBy || gitConfigUserName(repoRoot) || os.userInfo().username;
  artifacts.write("07-human-decision", { decision: "ONAY", at: new Date().toISOString(), approved_by: resolvedApprovedBy });
  transitionRunState(dir, RUN_STATES.PUBLISHING, { approved_by: resolvedApprovedBy, approved_at: new Date().toISOString() });

  vlog("\n✅ ONAY alındı. Yayın süreci otomatik devam ediyor...");
  let result;
  try {
    result = await publishApprovedBatch({
      repoRoot,
      runId,
      finalBatch,
      syncStamp,
      approvedBy: resolvedApprovedBy,
      gitAdapter,
      githubAdapter,
      cloudflareAdapter,
      artifacts,
    });
  } catch (e) {
    transitionRunState(dir, RUN_STATES.FAILED, { failure_stage: "publish", failure_reason: e.message });
    throw e;
  }

  if (result.stopped) {
    transitionRunState(dir, RUN_STATES.PUBLISH_STOPPED, { publish_stage: result.stage, publish_reason: result.reason });
    logError(`❌ Yayın durduruldu ("${result.stage}"): ${result.reason}`);
    logError(`Çalışma kayıtları: ${dir}`);
    return { outcome: "publish-stopped", stage: result.stage, reason: result.reason, runId, artifacts };
  }

  transitionRunState(dir, RUN_STATES.PUBLISHED, {
    pr_number: result.deploymentResult.pr_number,
    merge_sha: result.deploymentResult.merge_sha,
    live_mission_count: result.deploymentResult.live_mission_count,
  });

  log(`✅ Yayınlandı ve production'da doğrulandı. (${result.deploymentResult.live_mission_count} görev, PR #${result.deploymentResult.pr_number})`);
  vlog(JSON.stringify(result.deploymentResult, null, 2));
  return { outcome: "published", deploymentResult: result.deploymentResult, runId, artifacts };
}

/**
 * RESUME + CANCEL — the single İPTAL. Only valid from
 * WAITING_FOR_HUMAN_APPROVAL; refuses (fail-closed) otherwise. Zero
 * repository writes, no adapters of any kind touched.
 */
export async function runResumeCancel({ repoRoot = DEFAULT_REPO_ROOT, runId, log = console.log, logError = console.error } = {}) {
  if (!runId) throw new Error("runId is required");
  const dir = runDir(repoRoot, runId);

  const current = readRunState(dir);
  if (current.state !== RUN_STATES.WAITING_FOR_HUMAN_APPROVAL) {
    const reason = `run ${runId} is in state ${current.state}, not ${RUN_STATES.WAITING_FOR_HUMAN_APPROVAL} — refusing to cancel.`;
    logError(`❌ ${reason}`);
    return { outcome: "refused", stage: "invalid-state", reason, runId, currentState: current.state };
  }

  const artifacts = new RunArtifacts(repoRoot, runId);
  artifacts.write("07-human-decision", { decision: "IPTAL", at: new Date().toISOString() });
  transitionRunState(dir, RUN_STATES.CANCELLED);

  log(`İPTAL. Depoda hiçbir değişiklik yapılmadı. Çalışma kayıtları: ${dir}`);
  return { outcome: "iptal", runId, artifacts };
}

/**
 * Backward-compatible ONE-CALL composition of the three primitives above,
 * for callers (tests, or a script) that want generate-then-immediately-
 * decide in a single process/call. `approvalFn` is `() => Promise<"ONAY"|
 * "IPTAL">`. Internally this is NOT a separate "fast path" — it calls
 * runGenerate() then runResumeApprove()/runResumeCancel() exactly as
 * separate `--resume` invocations would, so even this convenience wrapper
 * proves the on-disk persistence and resume path, not an in-memory shortcut.
 */
export async function runFactory({
  repoRoot = DEFAULT_REPO_ROOT,
  requestedCount,
  runId = newRunId(),
  labAdapter,
  auditorAdapter,
  gitAdapter,
  githubAdapter,
  cloudflareAdapter,
  approvalFn,
  approvedBy,
  verbose = false,
  log = console.log,
  logError = console.error,
} = {}) {
  const generated = await runGenerate({ repoRoot, requestedCount, runId, labAdapter, auditorAdapter, verbose, log, logError });
  if (generated.outcome === "fail-closed") {
    return generated;
  }

  const decision = await approvalFn();

  if (decision !== "ONAY") {
    await runResumeCancel({ repoRoot, runId, log, logError });
    return { outcome: "iptal", finalBatch: generated.finalBatch, review: generated.review, artifacts: generated.artifacts, runId };
  }

  const published = await runResumeApprove({ repoRoot, runId, gitAdapter, githubAdapter, cloudflareAdapter, approvedBy, verbose, log, logError });

  if (published.outcome !== "published") {
    return {
      outcome: "publish-stopped",
      stage: published.stage,
      reason: published.reason,
      finalBatch: generated.finalBatch,
      review: generated.review,
      artifacts: generated.artifacts,
      runId,
    };
  }
  return {
    outcome: "published",
    deploymentResult: published.deploymentResult,
    finalBatch: generated.finalBatch,
    review: generated.review,
    artifacts: generated.artifacts,
    runId,
  };
}

export const VALUE_FLAGS = new Set(["count", "repo-root", "approved-by", "resume"]);

const GENERATE_USAGE = "node tools/jumvi-mission-factory.mjs --count N [--repo-root=DIR] [--verbose]";
const RESUME_USAGE = "node tools/jumvi-mission-factory.mjs --resume RUN_ID --approve|--cancel [--approved-by=NAME] [--repo-root=DIR] [--verbose]";

async function main() {
  const args = parseArgs(process.argv.slice(2), { valueFlags: VALUE_FLAGS });
  const repoRoot = args["repo-root"] ? path.resolve(args["repo-root"]) : DEFAULT_REPO_ROOT;
  const verbose = args.verbose === true || args.verbose === "true";

  const { checkDependencies, resolveLabAndAuditorAdapters, resolveGithubAdapter } = await import("./factory/adapters/dependency-check.mjs");

  if (args.resume !== undefined) {
    const runId = typeof args.resume === "string" ? args.resume.trim() : "";
    const approve = args.approve === true;
    const cancel = args.cancel === true;
    if (!runId || approve === cancel) {
      // approve === cancel catches BOTH missing (false === false) and
      // ambiguous (true === true, both flags given at once) -- exactly one
      // of --approve/--cancel is required, never zero, never both.
      console.error(`Usage: ${RESUME_USAGE}`);
      process.exit(1);
    }

    if (cancel) {
      const deps = await checkDependencies({ repoRoot, need: { git: false, repo: true, llm: false, github: false } });
      if (!deps.ok) {
        console.error(`❌ ${deps.turkishMessage}`);
        process.exit(1);
      }
      const result = await runResumeCancel({ repoRoot, runId });
      process.exit(result.outcome === "iptal" ? 0 : 1);
    }

    // --approve
    const deps = await checkDependencies({ repoRoot, need: { git: true, repo: true, llm: false, github: true } });
    if (!deps.ok) {
      console.error(`❌ ${deps.turkishMessage}`);
      process.exit(1);
    }
    const { createGitAdapter } = await import("./factory/adapters/git.mjs");
    const { createCloudflareAdapter } = await import("./factory/adapters/cloudflare.mjs");
    const { githubAdapter } = await resolveGithubAdapter({ repoRoot, preferGhCli: deps.github.useGhCli });
    const gitAdapter = createGitAdapter({ repoRoot });
    const cloudflareAdapter = createCloudflareAdapter({ githubAdapter });

    const result = await runResumeApprove({
      repoRoot,
      runId,
      gitAdapter,
      githubAdapter,
      cloudflareAdapter,
      approvedBy: args["approved-by"],
      verbose,
    });
    process.exit(result.outcome === "published" ? 0 : 1);
  }

  // Generate mode (no --resume).
  const requestedCount = Number(args.count);
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    console.error(`Usage: ${GENERATE_USAGE}\n   or: ${RESUME_USAGE}`);
    process.exit(1);
  }

  const deps = await checkDependencies({ repoRoot, need: { git: true, repo: true, llm: true, github: false } });
  if (!deps.ok) {
    console.error(`❌ ${deps.turkishMessage}`);
    process.exit(1);
  }
  const { labAdapter, auditorAdapter } = await resolveLabAndAuditorAdapters({ preferClaudeCli: deps.llm.useClaudeCli });

  const result = await runGenerate({ repoRoot, requestedCount, labAdapter, auditorAdapter, verbose });
  process.exit(result.outcome === "waiting-for-approval" ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
