/* ═══════════════════════════════════════════════════════════════════════════
 * adapters/claude-cli.mjs — the DEFAULT Lab/Auditor adapter: shells out to
 * the locally authenticated `claude` CLI (`claude -p`) instead of calling
 * the Anthropic API directly. This is what makes one-command mode actually
 * simple: a normal user who already has Claude Code installed and logged in
 * does not need to find or set ANTHROPIC_API_KEY themselves.
 *
 *   claude -p --output-format json --append-system-prompt "<pinned prompt>"
 *
 * with the structured task payload (existing fingerprints, governance data,
 * candidate, etc.) piped over STDIN rather than passed as a CLI argument --
 * arbitrary-length JSON without shell-escaping or ARG_MAX concerns. Machine
 * -readable output (`--output-format json`) is parsed for its `result`
 * field, then the model's own JSON contract is extracted from that text the
 * same way the direct-API adapters already do (models sometimes still wrap
 * JSON in prose or a fenced block despite instructions).
 *
 * Every call is a brand-new `claude -p` subprocess -- no `--continue` /
 * `--resume` / shared session id ever passed -- so each Lab generation call,
 * each Auditor call, and each revision round is a genuinely fresh, isolated
 * process with no shared conversation state. That IS the "isolated model
 * context" requirement, and it holds even more literally here than for the
 * direct-API adapters (adapters/../lab.mjs, adapters/../auditor.mjs).
 *
 * `runner({ args, input }) => Promise<{ code, stdout, stderr }>` is
 * INJECTABLE specifically so tests can exercise this adapter's argument
 * shape and JSON-parsing logic without ever invoking the real `claude`
 * binary. tools/check-mission-factory-cli-adapters.mjs is the only thing
 * that calls these factories in this repo's test suite, always with a fake
 * runner. Nothing here is exercised against a real CLI process in tests.
 * ══════════════════════════════════════════════════════════════════════════*/
import { spawn } from "node:child_process";
import { loadLabSystemPrompt, LAB_PROMPT_VERSION, loadAuditorSystemPrompt, AUDITOR_PROMPT_VERSION } from "../prompts/prompts.mjs";

const REVISION_NOTE =
  "You are now REVISING exactly one previously-rejected candidate against specific Auditor findings. " +
  "Output ONLY the single revised candidate object (the same per-candidate shape as above, same lab_candidate_id), not a full batch.";

/** Real runner: spawns `claude` with `args`, writes `input` to its stdin,
 * and resolves with the collected exit code/stdout/stderr. Never invoked in
 * this repo's test suite -- tests always inject a fake runner. */
export async function defaultCliRunner({ args, input }) {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", args, { stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => { stdout += d; });
    child.stderr.on("data", (d) => { stderr += d; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, stdout, stderr }));
    child.stdin.write(input ?? "");
    child.stdin.end();
  });
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in claude -p output");
  return JSON.parse(candidate.slice(start));
}

/** Parses `claude -p --output-format json`'s own envelope (a JSON object
 * with a string `result` field carrying the model's final text response --
 * see https://code.claude.com/docs/en/claude-code-on-the-web for the CLI's
 * output-format contract) and then extracts the model's OWN JSON contract
 * from that text. Two JSON layers, deliberately never conflated. */
function parseCliJsonOutput(stdout) {
  let outer;
  try {
    outer = JSON.parse(stdout);
  } catch (e) {
    throw new Error(`claude -p --output-format json did not print parseable JSON on stdout: ${e.message}`);
  }
  if (outer.is_error) {
    throw new Error(`claude -p reported an error: ${outer.result || outer.error || "unknown error"}`);
  }
  if (typeof outer.result !== "string") {
    throw new Error('claude -p --output-format json response is missing a string "result" field');
  }
  return extractJson(outer.result);
}

async function invokeClaudeCli({ runner, systemPrompt, payload, extraArgs }) {
  const args = ["-p", "--output-format", "json", "--append-system-prompt", systemPrompt, ...extraArgs];
  const { code, stdout, stderr } = await runner({ args, input: JSON.stringify(payload) });
  if (code !== 0) {
    throw new Error(`claude -p exited with code ${code}: ${(stderr || "").slice(0, 500)}`);
  }
  return parseCliJsonOutput(stdout);
}

export function createClaudeCliLabAdapter({ runner = defaultCliRunner, extraArgs = [] } = {}) {
  const systemPrompt = loadLabSystemPrompt();

  async function generate(requestedCount, context) {
    return invokeClaudeCli({
      runner,
      systemPrompt,
      extraArgs,
      payload: {
        run_id: context.runId,
        requested_count: requestedCount,
        existing_fingerprints: context.existingFingerprints,
        pack_keys: context.packKeys,
      },
    });
  }

  async function revise(revisionPacket) {
    return invokeClaudeCli({
      runner,
      systemPrompt: `${systemPrompt}\n${REVISION_NOTE}`,
      extraArgs,
      payload: revisionPacket,
    });
  }

  return { kind: "claude-cli", promptVersion: LAB_PROMPT_VERSION, generate, revise };
}

export function createClaudeCliAuditorAdapter({ runner = defaultCliRunner, extraArgs = [] } = {}) {
  const systemPrompt = loadAuditorSystemPrompt();

  async function audit(auditorInput) {
    return invokeClaudeCli({ runner, systemPrompt, extraArgs, payload: auditorInput });
  }

  return { kind: "claude-cli", promptVersion: AUDITOR_PROMPT_VERSION, audit };
}

/** Dependency-check helper: is a `claude` binary on PATH at all? Cheap,
 * no network, no prompt sent. Used by adapters/dependency-check.mjs. */
export async function checkClaudeCliInstalled({ runner = defaultCliRunner } = {}) {
  try {
    const { code, stdout, stderr } = await runner({ args: ["--version"], input: "" });
    if (code !== 0) return { installed: false, reason: (stderr || stdout || "claude --version exited non-zero").trim() };
    return { installed: true, version: stdout.trim() };
  } catch (e) {
    return { installed: false, reason: e.message };
  }
}
