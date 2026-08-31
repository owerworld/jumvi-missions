#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * jumvi-mission-factory.mjs — THE one command.
 *
 *   node tools/jumvi-mission-factory.mjs --count 6
 *
 * CURRENT MAIN SYNC -> LAB GENERATION -> DUPLICATE/HARD-GATE/CATEGORY CHECKS
 * -> INDEPENDENT AUDITOR -> TARGETED LAB REVISION -> INDEPENDENT REAUDIT
 * -> FINAL APPROVED MISSIONS -> TURKISH HUMAN REVIEW -> "YAYINLANSIN MI?"
 *
 * On İPTAL: stop, zero repo changes, artifacts preserved for review.
 * On ONAY: automatically re-sync, re-validate if main moved, import (reusing
 * tools/import-approved-missions.mjs), run tests, branch, push, open a PR,
 * wait for required CI + Cloudflare checks, merge only if green, wait for
 * deploy, verify production. Any failure anywhere stops publication --
 * never force-merged, never bypassed.
 *
 * `runFactory()` is the actual orchestration and is exported so
 * tools/check-mission-factory.mjs can drive the exact same one-command flow
 * with mock Lab/Auditor and fake git/github/cloudflare adapters -- main()
 * below is a thin wrapper that supplies the REAL ones (Anthropic API via
 * ANTHROPIC_API_KEY, GitHub REST API via GITHUB_TOKEN).
 * ══════════════════════════════════════════════════════════════════════════*/
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

import { parseArgs } from "./import-approved-missions.mjs";
import { newRunId, RunArtifacts } from "./factory/artifacts.mjs";
import { runGenerationPipeline, FactoryFailClosedError } from "./factory/pipeline.mjs";
import { formatTurkishReview, askForApprovalInteractive } from "./factory/turkish-review.mjs";
import { publishApprovedBatch } from "./factory/publish.mjs";

const SCRIPT_DIR = fileURLToPath(new URL(".", import.meta.url));
const DEFAULT_REPO_ROOT = path.resolve(SCRIPT_DIR, "..");

function gitConfigUserName(repoRoot) {
  try {
    return execFileSync("git", ["config", "user.name"], { cwd: repoRoot, encoding: "utf8" }).trim() || null;
  } catch {
    return null;
  }
}

/**
 * The one-command orchestration. All model/git/github/cloudflare access is
 * via injected adapters -- main() below wires real ones; tests wire mocks
 * and fakes. `approvalFn` is `() => Promise<"ONAY"|"IPTAL">`; the real CLI
 * uses the interactive terminal prompt, tests use a scripted decision.
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
  log = console.log,
  logError = console.error,
} = {}) {
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error("requestedCount must be a positive integer");
  }
  const artifacts = new RunArtifacts(repoRoot, runId);
  log(`JUMVI Mission Factory — run ${runId}`);
  log(`Artifacts: ${artifacts.dir}`);

  log("\n→ CURRENT MAIN SYNC / LAB GENERATION / CHECKS / AUDITOR / REVISION LOOP / REAUDIT");
  let pipelineResult;
  try {
    pipelineResult = await runGenerationPipeline({ repoRoot, requestedCount, runId, labAdapter, auditorAdapter, artifacts });
  } catch (e) {
    if (e instanceof FactoryFailClosedError) {
      logError(`\n❌ Pipeline stopped (fail-closed): ${e.message}`);
      artifacts.log(`FAIL-CLOSED: ${e.message}`);
      return { outcome: "fail-closed", stage: "generation", reason: e.message, artifacts };
    }
    throw e;
  }

  const { finalBatch, sync } = pipelineResult;

  log("\n→ TURKISH HUMAN REVIEW");
  const review = formatTurkishReview(finalBatch, requestedCount);
  log(`\n${review.text}\n`);
  artifacts.write("06-turkish-review", review);

  const decision = await approvalFn();
  artifacts.write("07-human-decision", { decision, at: new Date().toISOString() });

  if (decision !== "ONAY") {
    log(`\nİPTAL. Depoda hiçbir değişiklik yapılmadı. Çalışma kayıtları saklandı: ${artifacts.dir}`);
    return { outcome: "iptal", finalBatch, review, artifacts };
  }

  log("\n✅ ONAY alındı. Yayın süreci otomatik devam ediyor...");
  const result = await publishApprovedBatch({
    repoRoot,
    runId,
    finalBatch,
    syncStamp: sync.inventoryStamp,
    approvedBy: approvedBy || gitConfigUserName(repoRoot) || os.userInfo().username,
    gitAdapter,
    githubAdapter,
    cloudflareAdapter,
    artifacts,
  });

  if (result.stopped) {
    logError(`\n❌ Publication stopped at stage "${result.stage}": ${result.reason}`);
    logError(`Run artifacts: ${artifacts.dir}`);
    return { outcome: "publish-stopped", stage: result.stage, reason: result.reason, finalBatch, review, artifacts };
  }

  log("\n✅ Published and verified in production.");
  log(JSON.stringify(result.deploymentResult, null, 2));
  log(`\nRun artifacts: ${artifacts.dir}`);
  return { outcome: "published", deploymentResult: result.deploymentResult, finalBatch, review, artifacts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestedCount = Number(args.count);
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    console.error("Usage: node tools/jumvi-mission-factory.mjs --count N [--approved-by=NAME] [--repo-root=DIR]");
    process.exit(1);
  }
  const repoRoot = args["repo-root"] ? path.resolve(args["repo-root"]) : DEFAULT_REPO_ROOT;

  // Real adapters only, loaded lazily so a missing ANTHROPIC_API_KEY /
  // GITHUB_TOKEN fails fast with a clear message instead of failing deep
  // inside the pipeline after real API calls have already been made.
  const { createLiveLabAdapter } = await import("./factory/lab.mjs");
  const { createLiveAuditorAdapter } = await import("./factory/auditor.mjs");
  const { createGitAdapter } = await import("./factory/adapters/git.mjs");
  const { createGitHubAdapter } = await import("./factory/adapters/github.mjs");
  const { createCloudflareAdapter } = await import("./factory/adapters/cloudflare.mjs");

  let labAdapter, auditorAdapter, githubAdapter;
  try {
    labAdapter = createLiveLabAdapter();
    auditorAdapter = createLiveAuditorAdapter();
    githubAdapter = createGitHubAdapter({ repoRoot });
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    process.exit(1);
  }
  const gitAdapter = createGitAdapter({ repoRoot });
  const cloudflareAdapter = createCloudflareAdapter({ githubAdapter });

  const result = await runFactory({
    repoRoot,
    requestedCount,
    labAdapter,
    auditorAdapter,
    gitAdapter,
    githubAdapter,
    cloudflareAdapter,
    approvalFn: askForApprovalInteractive,
    approvedBy: args["approved-by"],
  });

  process.exit(result.outcome === "published" || result.outcome === "iptal" ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
