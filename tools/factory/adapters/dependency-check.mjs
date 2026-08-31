/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/dependency-check.mjs — the one-command flow's startup gate.
 *
 * A normal user running `node tools/jumvi-mission-factory.mjs --count N`
 * should not have to know about ANTHROPIC_API_KEY or GITHUB_TOKEN at all if
 * their machine is already set up (Claude Code CLI logged in, `gh`
 * authenticated, inside the right repo). This module checks that BEFORE any
 * adapter is constructed and, on anything missing, produces exactly ONE
 * short, actionable Turkish message and nothing else -- not a wall of
 * diagnostics, one message naming the one thing to fix next. Checks run in
 * a fixed priority order and stop at the first failure, because fixing them
 * one at a time is how the flow is meant to work.
 *
 * NOTE ON "authenticated": `gh auth status` is a documented subcommand `gh`
 * itself ships specifically to answer this question, so checkGhCliAuthenticated()
 * (adapters/gh-cli.mjs) uses it directly and it is a real, meaningful
 * authentication check. The `claude` CLI has no equivalent cheap,
 * non-interactive "am I logged in" subcommand -- confirming that would mean
 * making a real request (network + token cost) on every single startup.
 * checkClaudeCliInstalled() (adapters/claude-cli.mjs) therefore checks the
 * deterministic, free signal (is the binary on PATH and does it run) and
 * this module treats "installed" as "prefer this path"; a genuine auth
 * failure on the `claude` side surfaces from the pipeline's first real call
 * (fail-closed, same as any other pipeline error), not from this check.
 * ══════════════════════════════════════════════════════════════════════════*/
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { checkClaudeCliInstalled } from "./claude-cli.mjs";
import { checkGhCliAuthenticated } from "./gh-cli.mjs";

function checkGitAvailable() {
  try {
    execFileSync("git", ["--version"], { stdio: ["ignore", "pipe", "ignore"] });
    return { available: true };
  } catch (e) {
    return { available: false, reason: e.message };
  }
}

const REQUIRED_REPO_FILES = ["data.js", "tools/import-approved-missions.mjs", "src/worker.js"];

function checkRepoCorrect(repoRoot) {
  if (!repoRoot) return { correct: false, reason: "repoRoot verilmedi" };
  const missing = REQUIRED_REPO_FILES.filter((f) => !existsSync(path.join(repoRoot, f)));
  if (missing.length) {
    return { correct: false, reason: `beklenen dosyalar bulunamadı: ${missing.join(", ")}` };
  }
  try {
    const inside = execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: repoRoot, encoding: "utf8" }).trim();
    if (inside !== "true") return { correct: false, reason: "repoRoot bir git çalışma ağacı değil" };
  } catch (e) {
    return { correct: false, reason: `git deposu doğrulanamadı: ${e.message}` };
  }
  return { correct: true };
}

/**
 * Runs the full startup dependency check. Returns { ok: true, ... details }
 * on success, or { ok: false, turkishMessage } on the FIRST blocking issue
 * found (git -> repo -> Claude/API key -> gh/token, in that order) -- never
 * a combined list, per the "ONE short actionable message" requirement.
 * `claudeRunner`/`ghRunner` are injectable so tests never spawn the real
 * `claude`/`gh` binaries.
 */
export async function checkDependencies({ repoRoot, claudeRunner, ghRunner } = {}) {
  const git = checkGitAvailable();
  if (!git.available) {
    return { ok: false, turkishMessage: "git bulunamadı. Devam etmeden önce git kurun ve PATH üzerinde erişilebilir olduğundan emin olun." };
  }

  const repo = checkRepoCorrect(repoRoot);
  if (!repo.correct) {
    return { ok: false, turkishMessage: `Depo doğrulanamadı (${repo.reason}). --repo-root ile doğru JUMVI mission deposunu işaret ettiğinizden emin olun.` };
  }

  const claudeInstalled = await checkClaudeCliInstalled(claudeRunner ? { runner: claudeRunner } : {});
  const hasApiKeyFallback = !!process.env.ANTHROPIC_API_KEY;
  if (!claudeInstalled.installed && !hasApiKeyFallback) {
    return {
      ok: false,
      turkishMessage: "Claude Code CLI bulunamadı ve ANTHROPIC_API_KEY de ayarlanmamış. Devam etmek için `claude` CLI'ı kurup giriş yapın (claude.ai/code), ya da ANTHROPIC_API_KEY ortam değişkenini ayarlayın.",
    };
  }

  const ghAuth = await checkGhCliAuthenticated(ghRunner ? { runner: ghRunner } : {});
  const hasTokenFallback = !!process.env.GITHUB_TOKEN;
  if (!ghAuth.authenticated && !hasTokenFallback) {
    return {
      ok: false,
      turkishMessage: "`gh` CLI kimlik doğrulaması bulunamadı ve GITHUB_TOKEN de ayarlanmamış. Devam etmek için `gh auth login` çalıştırın, ya da GITHUB_TOKEN ortam değişkenini ayarlayın.",
    };
  }

  return {
    ok: true,
    turkishMessage: null,
    git,
    repo,
    llm: { useClaudeCli: claudeInstalled.installed, useApiKeyFallback: !claudeInstalled.installed && hasApiKeyFallback },
    github: { useGhCli: ghAuth.authenticated, useTokenFallback: !ghAuth.authenticated && hasTokenFallback },
  };
}

/** Builds the real Lab + Auditor adapters, preferring the local `claude`
 * CLI over ANTHROPIC_API_KEY. Call only after checkDependencies() reports
 * ok:true -- this does not itself re-check availability. */
export async function resolveLabAndAuditorAdapters({ preferClaudeCli } = {}) {
  if (preferClaudeCli) {
    const { createClaudeCliLabAdapter, createClaudeCliAuditorAdapter } = await import("./claude-cli.mjs");
    return { labAdapter: createClaudeCliLabAdapter(), auditorAdapter: createClaudeCliAuditorAdapter(), source: "claude-cli" };
  }
  const { createLiveLabAdapter } = await import("../lab.mjs");
  const { createLiveAuditorAdapter } = await import("../auditor.mjs");
  return { labAdapter: createLiveLabAdapter(), auditorAdapter: createLiveAuditorAdapter(), source: "anthropic-api-key" };
}

/** Builds the real GitHub adapter, preferring the local `gh` CLI over
 * GITHUB_TOKEN. Call only after checkDependencies() reports ok:true. */
export async function resolveGithubAdapter({ repoRoot, preferGhCli } = {}) {
  if (preferGhCli) {
    const { createGhCliAdapter } = await import("./gh-cli.mjs");
    return { githubAdapter: createGhCliAdapter(), source: "gh-cli" };
  }
  const { createGitHubAdapter } = await import("./github.mjs");
  return { githubAdapter: createGitHubAdapter({ repoRoot }), source: "github-token" };
}
