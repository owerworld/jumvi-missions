/* ═══════════════════════════════════════════════════════════════════════════
 * auditor.mjs — the "Independent Auditor": evaluates one candidate at a time
 * against the current mission inventory, the batch it arrived with, the HG10
 * hard-gate checklist, and the Phase 3 physical-constraint checklist.
 *
 * Two adapters, same interface ({ kind, audit(auditorInput) => AuditorOutput }):
 *
 *   createMockAuditorAdapter — `script(auditorInput) => AuditorOutput`, fully
 *                               test-controlled. Never calls a network.
 *
 *   createLiveAuditorAdapter — calls the real Anthropic Messages API, always
 *                               a fresh stateless request per call (per
 *                               candidate, per round) so it is never sharing
 *                               conversation state with the Lab call that
 *                               produced the candidate -- genuine isolation.
 *                               Requires ANTHROPIC_API_KEY. Not exercised in
 *                               this repo's tests or by this session.
 * ══════════════════════════════════════════════════════════════════════════*/
import { loadAuditorSystemPrompt, AUDITOR_PROMPT_VERSION } from "./prompts/prompts.mjs";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function createMockAuditorAdapter({ script }) {
  if (typeof script !== "function") throw new Error("createMockAuditorAdapter requires a script(auditorInput) function");
  return {
    kind: "mock",
    promptVersion: AUDITOR_PROMPT_VERSION,
    async audit(auditorInput) {
      return script(auditorInput);
    },
  };
}

async function callAnthropic(apiKey, system, userPrompt, { model = "claude-sonnet-5" } = {}) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Anthropic API ${res.status}: ${body.slice(0, 500)}`);
  }
  const json = await res.json();
  return (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}

function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model output");
  return JSON.parse(candidate.slice(start));
}

const AUDITOR_SYSTEM_PROMPT = loadAuditorSystemPrompt();

export function createLiveAuditorAdapter({ apiKey = process.env.ANTHROPIC_API_KEY, model } = {}) {
  if (!apiKey) {
    throw new Error(
      "createLiveAuditorAdapter requires ANTHROPIC_API_KEY. This factory never fabricates a key -- set the env var yourself before using --mode live."
    );
  }
  return {
    kind: "live",
    promptVersion: AUDITOR_PROMPT_VERSION,
    async audit(auditorInput) {
      const text = await callAnthropic(apiKey, AUDITOR_SYSTEM_PROMPT, JSON.stringify(auditorInput), { model });
      return extractJson(text);
    },
  };
}
