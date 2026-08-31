#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * check-mission-factory-cli-adapters.mjs — regression suite for the
 * one-command-mode defaults: the `claude -p` Lab/Auditor adapter, the `gh`
 * CLI GitHub adapter, and the dependency-check/adapter-resolution module
 * that prefers both over ANTHROPIC_API_KEY / GITHUB_TOKEN.
 *
 * Every "runner" (the injectable subprocess-spawning function each adapter
 * takes) is a plain in-memory fake here. NOTHING in this file spawns a real
 * `claude` or `gh` process, makes a real network call, or reads/writes the
 * real repo's data.js.
 *
 *   node tools/check-mission-factory-cli-adapters.mjs
 *
 * Exit 1 on any contract violation.
 * ══════════════════════════════════════════════════════════════════════════*/
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

import { createClaudeCliLabAdapter, createClaudeCliAuditorAdapter, checkClaudeCliInstalled } from "./factory/adapters/claude-cli.mjs";
import { createGhCliAdapter, checkGhCliAuthenticated } from "./factory/adapters/gh-cli.mjs";
import { checkDependencies, resolveLabAndAuditorAdapters, resolveGithubAdapter } from "./factory/adapters/dependency-check.mjs";
import { loadLabSystemPrompt, loadAuditorSystemPrompt, LAB_PROMPT_VERSION, AUDITOR_PROMPT_VERSION } from "./factory/prompts/prompts.mjs";
import { validateAuditorOutput } from "./factory/schemas.mjs";

let failures = 0;
function check(label, condition, detail = "") {
  if (condition) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("Mission factory CLI-adapter contract\n");

const NO_SESSION_FLAGS = ["--continue", "--resume", "--session-id", "-c", "-r"];

/* ═══════════════════════════════════════════════════════════════════════
 * 1 — claude-cli Lab adapter: generate().
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const calls = [];
  const fakeCandidate = { lab_candidate_id: "x1", title: "Test" };
  const runner = async ({ args, input }) => {
    calls.push({ args, input });
    return {
      code: 0,
      stdout: JSON.stringify({
        type: "result",
        is_error: false,
        result: "```json\n" + JSON.stringify({ run_id: "r1", requested_count: 1, generated_at: "now", candidates: [fakeCandidate] }) + "\n```",
      }),
      stderr: "",
    };
  };
  const lab = createClaudeCliLabAdapter({ runner });
  check("claude-cli Lab adapter reports kind 'claude-cli'", lab.kind === "claude-cli");
  check("claude-cli Lab adapter reports the pinned Lab prompt version", lab.promptVersion === LAB_PROMPT_VERSION);

  const out = await lab.generate(1, { runId: "r1", existingFingerprints: [], packKeys: [] });
  check("generate() parses claude -p's JSON envelope and extracts the fenced JSON result correctly", out.candidates[0].lab_candidate_id === "x1");
  check("generate() invokes exactly one subprocess call", calls.length === 1);
  check("generate() shells out with `-p --output-format json`", calls[0].args.includes("-p") && calls[0].args.includes("--output-format") && calls[0].args.includes("json"));
  check("generate() carries the pinned Lab system prompt verbatim via --append-system-prompt", calls[0].args[calls[0].args.indexOf("--append-system-prompt") + 1] === loadLabSystemPrompt());
  check("generate() pipes the structured payload over stdin, not a CLI argument", JSON.parse(calls[0].input).run_id === "r1");
  check("generate() never passes a session-continuation flag — a genuinely fresh, isolated process every call", !calls[0].args.some((a) => NO_SESSION_FLAGS.includes(a)));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 2 — claude-cli Lab adapter: revise().
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const calls = [];
  const runner = async ({ args, input }) => {
    calls.push({ args, input });
    return { code: 0, stdout: JSON.stringify({ type: "result", is_error: false, result: JSON.stringify({ lab_candidate_id: "x1", title: "Revised" }) }), stderr: "" };
  };
  const lab = createClaudeCliLabAdapter({ runner });
  const packet = { original_candidate: { lab_candidate_id: "x1" }, auditor_findings: {}, revision_instructions: "fix it", revision_round: 1 };
  const out = await lab.revise(packet);
  check("revise() returns the revised single-candidate object", out.lab_candidate_id === "x1" && out.title === "Revised");
  check("revise()'s system prompt is the pinned Lab prompt plus the revision note appended", calls[0].args[calls[0].args.indexOf("--append-system-prompt") + 1].includes("REVISING exactly one previously-rejected candidate"));
  check("revise() is ALSO a fresh subprocess call — never continuing whatever produced the original candidate", !calls[0].args.some((a) => NO_SESSION_FLAGS.includes(a)));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 3 — claude-cli adapter: fails closed on a bad process/response.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const failRunner = async () => ({ code: 1, stdout: "", stderr: "auth error: not logged in" });
  const lab = createClaudeCliLabAdapter({ runner: failRunner });
  let threw = false;
  try {
    await lab.generate(1, { runId: "r", existingFingerprints: [], packKeys: [] });
  } catch (e) {
    threw = true;
    check("a non-zero claude -p exit code throws with the CLI's stderr context", e.message.includes("auth error"));
  }
  check("generate() throws (fails closed) on a non-zero exit code, never returns partial data", threw);

  const errRunner = async () => ({ code: 0, stdout: JSON.stringify({ type: "result", is_error: true, result: "boom" }), stderr: "" });
  const lab2 = createClaudeCliLabAdapter({ runner: errRunner });
  let threw2 = false;
  try { await lab2.generate(1, { runId: "r", existingFingerprints: [], packKeys: [] }); } catch { threw2 = true; }
  check("generate() throws when claude -p's own envelope reports is_error:true", threw2);

  const noResultRunner = async () => ({ code: 0, stdout: JSON.stringify({ type: "result" }), stderr: "" });
  const lab3 = createClaudeCliLabAdapter({ runner: noResultRunner });
  let threw3 = false;
  try { await lab3.generate(1, { runId: "r", existingFingerprints: [], packKeys: [] }); } catch { threw3 = true; }
  check("generate() throws when the envelope is missing a string result field", threw3);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 4 — claude-cli Auditor adapter.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const calls = [];
  const auditorOutput = { lab_candidate_id: "x1", auditor_verdict: "APPROVE_FOR_REAL_CHILD_PLAYTEST", findings: {}, revision_instructions: null };
  const runner = async ({ args, input }) => {
    calls.push({ args, input });
    return { code: 0, stdout: JSON.stringify({ type: "result", is_error: false, result: JSON.stringify(auditorOutput) }), stderr: "" };
  };
  const auditor = createClaudeCliAuditorAdapter({ runner });
  check("claude-cli Auditor adapter reports kind 'claude-cli'", auditor.kind === "claude-cli");
  check("claude-cli Auditor adapter reports the pinned Auditor prompt version", auditor.promptVersion === AUDITOR_PROMPT_VERSION);

  const out = await auditor.audit({ candidate: { lab_candidate_id: "x1" } });
  check("audit() parses the response correctly", out.auditor_verdict === "APPROVE_FOR_REAL_CHILD_PLAYTEST");
  check("audit() carries the pinned Auditor system prompt verbatim", calls[0].args[calls[0].args.indexOf("--append-system-prompt") + 1] === loadAuditorSystemPrompt());
  check("audit() is a fresh subprocess call, never sharing the Lab's process/session", !calls[0].args.some((a) => NO_SESSION_FLAGS.includes(a)));
}

/* ═══════════════════════════════════════════════════════════════════════
 * 5 — checkClaudeCliInstalled.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const ok = await checkClaudeCliInstalled({ runner: async () => ({ code: 0, stdout: "1.2.3", stderr: "" }) });
  check("checkClaudeCliInstalled reports installed:true on exit 0", ok.installed === true);
  const bad = await checkClaudeCliInstalled({ runner: async () => ({ code: 127, stdout: "", stderr: "not found" }) });
  check("checkClaudeCliInstalled reports installed:false on a non-zero exit", bad.installed === false);
  const thrown = await checkClaudeCliInstalled({ runner: async () => { throw new Error("ENOENT: claude"); } });
  check("checkClaudeCliInstalled reports installed:false when the runner itself throws (binary not on PATH)", thrown.installed === false);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 6 — gh-cli GitHub adapter: request shape and response parsing.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const calls = [];
  const runner = async ({ args, input }) => {
    calls.push({ args, input });
    if (args[0] === "repo" && args[1] === "view") {
      return { code: 0, stdout: JSON.stringify({ owner: { login: "owerworld" }, name: "jumvi-missions" }), stderr: "" };
    }
    if (args[0] === "api" && args[3] === "POST" && args[1].endsWith("/pulls")) {
      return { code: 0, stdout: JSON.stringify({ number: 42, html_url: "https://github.com/owerworld/jumvi-missions/pull/42" }), stderr: "" };
    }
    if (args[0] === "api" && args[1].includes("/check-runs")) {
      return { code: 0, stdout: JSON.stringify({ check_runs: [{ name: "ci", status: "completed", conclusion: "success" }] }), stderr: "" };
    }
    if (args[0] === "api" && args[3] === "PUT" && args[1].includes("/merge")) {
      return { code: 0, stdout: JSON.stringify({ merged: true, sha: "abc123" }), stderr: "" };
    }
    throw new Error(`unexpected gh call: ${JSON.stringify(args)}`);
  };
  const gh = createGhCliAdapter({ runner });
  check("gh-cli adapter reports kind 'gh-cli'", gh.kind === "gh-cli");

  const pr = await gh.createPullRequest({ title: "t", head: "h", base: "main", body: "b" });
  check("createPullRequest() infers owner/repo via `gh repo view` and returns {number,url}", pr.number === 42 && pr.url.endsWith("/pull/42"));
  check("createPullRequest() pipes the JSON body via `gh api --input -`, not an inline argument", calls.some((c) => c.args.includes("--input") && JSON.parse(c.input || "{}").title === "t"));

  const checks = await gh.waitForChecks({ ref: "abc" });
  check("waitForChecks() reports success when every check-run concludes success/skipped/neutral", checks.success === true && checks.timedOut === false);

  const merge = await gh.mergePullRequest({ number: 42 });
  check("mergePullRequest() returns {merged,sha} parsed from `gh api -X PUT .../merge`", merge.merged === true && merge.sha === "abc123");

  check("owner/repo is resolved via `gh repo view` exactly once and reused, never re-resolved per call", calls.filter((c) => c.args[0] === "repo").length === 1);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 7 — checkGhCliAuthenticated.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const ok = await checkGhCliAuthenticated({ runner: async () => ({ code: 0, stdout: "", stderr: "Logged in to github.com as octocat" }) });
  check("checkGhCliAuthenticated reports authenticated:true on exit 0", ok.authenticated === true);
  const bad = await checkGhCliAuthenticated({ runner: async () => ({ code: 1, stdout: "", stderr: "not logged in to any hosts" }) });
  check("checkGhCliAuthenticated reports authenticated:false on a non-zero exit", bad.authenticated === false);
}

/* ═══════════════════════════════════════════════════════════════════════
 * 8 — dependency-check.mjs: the full decision matrix, in priority order.
 * ═══════════════════════════════════════════════════════════════════════*/
function makeRepoSandbox() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-dep-test-"));
  fs.mkdirSync(path.join(dir, "src"));
  fs.mkdirSync(path.join(dir, "tools"));
  fs.writeFileSync(path.join(dir, "data.js"), "const missions = [];\n");
  fs.writeFileSync(path.join(dir, "src/worker.js"), "");
  fs.writeFileSync(path.join(dir, "tools/import-approved-missions.mjs"), "");
  execSync("git init -q", { cwd: dir });
  return dir;
}

{
  const dir = makeRepoSandbox();
  const claudeInstalledRunner = async ({ args }) => (args[0] === "--version" ? { code: 0, stdout: "1.0.0", stderr: "" } : { code: 1, stdout: "", stderr: "" });
  const claudeMissingRunner = async () => ({ code: 127, stdout: "", stderr: "command not found" });
  const ghAuthedRunner = async ({ args }) => (args[0] === "auth" ? { code: 0, stdout: "", stderr: "Logged in" } : { code: 1, stdout: "", stderr: "" });
  const ghUnauthedRunner = async () => ({ code: 1, stdout: "", stderr: "not logged in" });

  const savedApiKey = process.env.ANTHROPIC_API_KEY;
  const savedToken = process.env.GITHUB_TOKEN;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.GITHUB_TOKEN;

  const badRepoDir = fs.mkdtempSync(path.join(os.tmpdir(), "jumvi-dep-badrepo-"));
  const badRepoResult = await checkDependencies({ repoRoot: badRepoDir, claudeRunner: claudeInstalledRunner, ghRunner: ghAuthedRunner });
  check("checkDependencies fails closed with ONE Turkish message when the repo doesn't look like JUMVI", badRepoResult.ok === false && /Depo doğrulanamadı/.test(badRepoResult.turkishMessage));
  fs.rmSync(badRepoDir, { recursive: true, force: true });

  const noClaudeResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeMissingRunner, ghRunner: ghAuthedRunner });
  check("checkDependencies fails closed when claude is missing and ANTHROPIC_API_KEY is unset", noClaudeResult.ok === false && /Claude Code CLI/.test(noClaudeResult.turkishMessage));

  process.env.ANTHROPIC_API_KEY = "test-key";
  const apiKeyFallbackResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeMissingRunner, ghRunner: ghAuthedRunner });
  check(
    "checkDependencies succeeds via the ANTHROPIC_API_KEY fallback when claude isn't installed",
    apiKeyFallbackResult.ok === true && apiKeyFallbackResult.llm.useApiKeyFallback === true && apiKeyFallbackResult.llm.useClaudeCli === false
  );
  delete process.env.ANTHROPIC_API_KEY;

  process.env.ANTHROPIC_API_KEY = "test-key";
  const claudePreferredResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeInstalledRunner, ghRunner: ghAuthedRunner });
  check(
    "checkDependencies prefers the installed claude CLI over ANTHROPIC_API_KEY when both are available",
    claudePreferredResult.ok === true && claudePreferredResult.llm.useClaudeCli === true && claudePreferredResult.llm.useApiKeyFallback === false
  );
  delete process.env.ANTHROPIC_API_KEY;

  const noGhResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeInstalledRunner, ghRunner: ghUnauthedRunner });
  check("checkDependencies fails closed when gh isn't authenticated and GITHUB_TOKEN is unset", noGhResult.ok === false && /`gh`/.test(noGhResult.turkishMessage));

  process.env.GITHUB_TOKEN = "test-token";
  const tokenFallbackResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeInstalledRunner, ghRunner: ghUnauthedRunner });
  check(
    "checkDependencies succeeds via the GITHUB_TOKEN fallback when gh isn't authenticated",
    tokenFallbackResult.ok === true && tokenFallbackResult.github.useTokenFallback === true && tokenFallbackResult.github.useGhCli === false
  );
  delete process.env.GITHUB_TOKEN;

  process.env.GITHUB_TOKEN = "test-token";
  const ghPreferredResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeInstalledRunner, ghRunner: ghAuthedRunner });
  check(
    "checkDependencies prefers the authenticated gh CLI over GITHUB_TOKEN when both are available",
    ghPreferredResult.ok === true && ghPreferredResult.github.useGhCli === true && ghPreferredResult.github.useTokenFallback === false
  );
  delete process.env.GITHUB_TOKEN;

  const fullOkResult = await checkDependencies({ repoRoot: dir, claudeRunner: claudeInstalledRunner, ghRunner: ghAuthedRunner });
  check("checkDependencies reports ok:true with no turkishMessage when everything is available", fullOkResult.ok === true && fullOkResult.turkishMessage === null);

  if (savedApiKey !== undefined) process.env.ANTHROPIC_API_KEY = savedApiKey; else delete process.env.ANTHROPIC_API_KEY;
  if (savedToken !== undefined) process.env.GITHUB_TOKEN = savedToken; else delete process.env.GITHUB_TOKEN;

  fs.rmSync(dir, { recursive: true, force: true });
}

/* ═══════════════════════════════════════════════════════════════════════
 * 9 — resolveLabAndAuditorAdapters / resolveGithubAdapter: the CLI-first
 * default actually gets selected (fallback branch tested only via the safe,
 * network-free Lab/Auditor path -- the GitHub-token fallback's construction
 * depends on a real git remote and is exercised by adapters/github.mjs's
 * own pre-existing usage, not re-tested here).
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const { labAdapter, auditorAdapter, source } = await resolveLabAndAuditorAdapters({ preferClaudeCli: true });
  check("resolveLabAndAuditorAdapters(preferClaudeCli:true) returns claude-cli adapters by default", source === "claude-cli" && labAdapter.kind === "claude-cli" && auditorAdapter.kind === "claude-cli");

  const savedApiKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  const fallback = await resolveLabAndAuditorAdapters({ preferClaudeCli: false });
  check("resolveLabAndAuditorAdapters(preferClaudeCli:false) falls back to the direct Anthropic API adapters", fallback.source === "anthropic-api-key" && fallback.labAdapter.kind === "live" && fallback.auditorAdapter.kind === "live");
  if (savedApiKey !== undefined) process.env.ANTHROPIC_API_KEY = savedApiKey; else delete process.env.ANTHROPIC_API_KEY;

  const { githubAdapter, source: ghSource } = await resolveGithubAdapter({ preferGhCli: true });
  check("resolveGithubAdapter(preferGhCli:true) returns the gh-cli adapter by default", ghSource === "gh-cli" && githubAdapter.kind === "gh-cli");
}

/* ═══════════════════════════════════════════════════════════════════════
 * 10 — pinned-prompt content proof and "Auditor cannot generate replacement
 * games" as a structural (schema-level) guarantee, not just prose.
 * ═══════════════════════════════════════════════════════════════════════*/
{
  const labPromptText = loadLabSystemPrompt();
  const auditorPromptText = loadAuditorSystemPrompt();
  check("the pinned Auditor prompt explicitly states it never proposes a replacement mechanic", auditorPromptText.includes("never propose a replacement mechanic"));
  check("the pinned Auditor prompt explicitly states it does not trust Lab conclusions", auditorPromptText.toLowerCase().includes("do not trust lab conclusions"));
  check("the pinned Lab prompt explicitly requires a dynamic current-main sync first", labPromptText.includes("Current-main sync first"));
  check("the pinned Lab prompt explicitly forbids lowering quality to hit the requested count", labPromptText.includes("Do not lower quality"));

  const smuggledReplacement = {
    lab_candidate_id: "x1",
    auditor_verdict: "REVISE_AND_REAUDIT",
    findings: {
      existing_duplicate: { flag: false, detail: "x" }, batch_duplicate: { flag: false, detail: "x" },
      hard_gate: { passed: true, failed_items: [] }, phase3_physical: { passed: true, concerns: [] },
      structural_similarity: { score: 0, nearest: null }, participation: { assessment: "x" },
      role_fairness: { assessment: "x" }, event_clarity: { assessment: "x" }, complexity: { assessment: "x" },
      safety: { assessment: "x", real_world_flags: [] }, category_placement: { assessment: "x", suggested_pack: null },
      evidence_quality: { assessment: "x" },
    },
    revision_instructions: { title: "A whole replacement mission the Auditor invented", steps: ["a", "b"] }, // NOT a string
  };
  const result = validateAuditorOutput(smuggledReplacement);
  check(
    "the AuditorOutput schema rejects a replacement-mission object smuggled in place of text revision_instructions — the Auditor has no channel to hand back a new game, only instructions for a fresh Lab context to act on",
    result.valid === false
  );
}

/* ── report ───────────────────────────────────────────────────────────── */
if (failures) {
  console.log(`\n❌ ${failures} CLI-adapter contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ claude -p Lab/Auditor adapter, gh CLI GitHub adapter, and CLI-first dependency resolution all behave correctly under every fixture scenario.");
