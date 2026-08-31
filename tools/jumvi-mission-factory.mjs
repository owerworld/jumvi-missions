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
 * below is a thin wrapper that supplies the REAL ones. Before constructing
 * any of them it runs factory/adapters/dependency-check.mjs, which prefers
 * the locally authenticated `claude` and `gh` CLIs (so a normal user never
 * has to set ANTHROPIC_API_KEY or GITHUB_TOKEN by hand) and falls back to
 * those env vars only if the CLIs aren't available. Default console output
 * is quiet -- only the Turkish review, the ONAY/İPTAL prompt, and one final
 * outcome line -- pass --verbose for the full stage-by-stage trace.
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
/**
 * `verbose` controls only the EXTRA stage-by-stage progress lines and the
 * raw deployment-result JSON dump. Regardless of `verbose`, the user always
 * sees: the Turkish review, the ONAY/İPTAL prompt, and one final outcome
 * line -- "Make one-command mode actually simple" means a normal run's
 * terminal output is exactly that and nothing else by default; pass
 * `--verbose` (main()'s CLI flag) for the full stage-marker trace.
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
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    throw new Error("requestedCount must be a positive integer");
  }
  const artifacts = new RunArtifacts(repoRoot, runId);
  const vlog = verbose ? log : () => {};
  vlog(`JUMVI Mission Factory — run ${runId}`);
  vlog(`Artifacts: ${artifacts.dir}`);

  vlog("\n→ CURRENT MAIN SYNC / LAB GENERATION / CHECKS / AUDITOR / REVISION LOOP / REAUDIT");
  let pipelineResult;
  try {
    pipelineResult = await runGenerationPipeline({ repoRoot, requestedCount, runId, labAdapter, auditorAdapter, artifacts });
  } catch (e) {
    if (e instanceof FactoryFailClosedError) {
      logError(`❌ Üretim durduruldu: ${e.message}`);
      artifacts.log(`FAIL-CLOSED: ${e.message}`);
      return { outcome: "fail-closed", stage: "generation", reason: e.message, artifacts };
    }
    throw e;
  }

  const { finalBatch, sync } = pipelineResult;

  // This is one of the two things a normal run always shows, unconditionally.
  const review = formatTurkishReview(finalBatch, requestedCount);
  log(`\n${review.text}\n`);
  artifacts.write("06-turkish-review", review);

  const decision = await approvalFn();
  artifacts.write("07-human-decision", { decision, at: new Date().toISOString() });

  if (decision !== "ONAY") {
    log(`İPTAL. Depoda hiçbir değişiklik yapılmadı. Çalışma kayıtları: ${artifacts.dir}`);
    return { outcome: "iptal", finalBatch, review, artifacts };
  }

  vlog("\n✅ ONAY alındı. Yayın süreci otomatik devam ediyor...");
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
    logError(`❌ Yayın durduruldu ("${result.stage}"): ${result.reason}`);
    logError(`Çalışma kayıtları: ${artifacts.dir}`);
    return { outcome: "publish-stopped", stage: result.stage, reason: result.reason, finalBatch, review, artifacts };
  }

  log(`✅ Yayınlandı ve production'da doğrulandı. (${result.deploymentResult.live_mission_count} görev, PR #${result.deploymentResult.pr_number})`);
  vlog(JSON.stringify(result.deploymentResult, null, 2));
  vlog(`Çalışma kayıtları: ${artifacts.dir}`);
  return { outcome: "published", deploymentResult: result.deploymentResult, finalBatch, review, artifacts };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requestedCount = Number(args.count);
  if (!Number.isInteger(requestedCount) || requestedCount < 1) {
    console.error("Usage: node tools/jumvi-mission-factory.mjs --count N [--approved-by=NAME] [--repo-root=DIR] [--verbose]");
    process.exit(1);
  }
  const repoRoot = args["repo-root"] ? path.resolve(args["repo-root"]) : DEFAULT_REPO_ROOT;
  const verbose = args.verbose === true || args.verbose === "true";

  // Dependency check FIRST, before any adapter is constructed: is `claude`
  // installed (else ANTHROPIC_API_KEY), is `gh` authenticated (else
  // GITHUB_TOKEN), is git available, is this the right repo. A normal user
  // with Claude Code and `gh` already set up needs neither env var. On
  // anything missing, print exactly ONE short actionable Turkish message
  // and stop -- no adapter is ever constructed past this point on failure.
  const { checkDependencies, resolveLabAndAuditorAdapters, resolveGithubAdapter } = await import("./factory/adapters/dependency-check.mjs");
  const deps = await checkDependencies({ repoRoot });
  if (!deps.ok) {
    console.error(`❌ ${deps.turkishMessage}`);
    process.exit(1);
  }

  const { createGitAdapter } = await import("./factory/adapters/git.mjs");
  const { createCloudflareAdapter } = await import("./factory/adapters/cloudflare.mjs");

  const { labAdapter, auditorAdapter } = await resolveLabAndAuditorAdapters({ preferClaudeCli: deps.llm.useClaudeCli });
  const { githubAdapter } = await resolveGithubAdapter({ repoRoot, preferGhCli: deps.github.useGhCli });
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
    verbose,
  });

  process.exit(result.outcome === "published" || result.outcome === "iptal" ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
