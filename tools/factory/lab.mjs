/* ═══════════════════════════════════════════════════════════════════════════
 * lab.mjs — the "Lab": generates new mission candidates, and revises a single
 * candidate against targeted Auditor findings.
 *
 * Two adapters, same interface ({ kind, generate(requestedCount, context),
 * revise(revisionPacket) }):
 *
 *   createMockLabAdapter  — deterministic, fixture-driven. Used by every test
 *                            in tools/check-mission-factory.mjs and by
 *                            `--mode test`. Never calls a network.
 *
 *   createLiveLabAdapter  — calls the real Anthropic Messages API. Requires
 *                            ANTHROPIC_API_KEY. Each call is a fresh,
 *                            stateless request with no shared conversation
 *                            state — that IS the "isolated model context"
 *                            the spec asks for; there is no cheaper way to
 *                            get real isolation from inside a plain Node
 *                            script run outside any particular agent host.
 *                            NOT exercised anywhere in this repo's tests or
 *                            by this implementation session — building it
 *                            correctly is in scope, running it against a
 *                            real key is a separately-reviewed decision the
 *                            user makes later.
 * ══════════════════════════════════════════════════════════════════════════*/

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export function createMockLabAdapter({ fixtures, reviseFn } = {}) {
  if (!fixtures) throw new Error("createMockLabAdapter requires fixtures (array or function)");
  let seq = 0;

  async function generate(requestedCount, context) {
    const pool = typeof fixtures === "function" ? fixtures(requestedCount, context) : fixtures;
    const chosen = pool.slice(0, requestedCount).map((tpl) => ({
      lab_candidate_id: `lab-${context.runId}-${seq++}`,
      revision_round: 0,
      ...tpl,
    }));
    return {
      run_id: context.runId,
      requested_count: requestedCount,
      generated_at: new Date().toISOString(),
      candidates: chosen,
    };
  }

  async function revise(revisionPacket) {
    const base = revisionPacket.original_candidate;
    const patch = reviseFn
      ? reviseFn(base, revisionPacket.auditor_findings, revisionPacket.revision_round)
      : {}; // no-op reviser: candidate comes back unchanged, so it keeps failing -- used to test round-exhaustion
    return {
      ...base,
      ...patch,
      lab_candidate_id: base.lab_candidate_id,
      revision_round: revisionPacket.revision_round,
    };
  }

  return { kind: "mock", generate, revise };
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
  const text = (json.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
  return text;
}

function extractJson(text) {
  // Models sometimes wrap JSON in prose or a fenced block despite instructions.
  // Take the largest {...} or [...] span rather than guessing structure.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.search(/[[{]/);
  if (start === -1) throw new Error("no JSON found in model output");
  return JSON.parse(candidate.slice(start));
}

const LAB_SYSTEM_PROMPT = `You are the JUMVI Mission Lab, an isolated generation context for the JUMVI Toss & Catch paddle set (2-4 players, ages 3-8, six packs: Aim Master, Focus Control, Team Duo, Indoor Compact, Beach/Park, Reflex Rush).
You output ONLY a single JSON object matching this exact shape, nothing else:
{"run_id":"...","requested_count":N,"generated_at":"ISO-8601","candidates":[{"lab_candidate_id":"...","title":"...","pack":"<one of the six pack keys>","difficulty":1|2|3,"players":"N or N–M (en dash)","time":"Ns","age":"N+","equipment":{"paddles":N or [min,max],"balls":N},"steps":["1-3 short imperative steps"],"win":"measurable win condition","safety":"specific safety line","tip":"one tip","mechanics_summary":"one sentence describing the core mechanic","continuation_note":"how this extends the existing skill progression","uniqueness_rationale":"why this is not a duplicate of an existing JUMVI mission"}]}
You will be given the CURRENT full mission inventory as structural fingerprints (pack + token bag) to exclude. Never propose a mechanic that overlaps heavily with any of them. Never invent a new pack. Do not lower quality just to reach the requested count -- fewer, better candidates are correct if that many good ideas don't exist.`;

export function createLiveLabAdapter({ apiKey = process.env.ANTHROPIC_API_KEY, model } = {}) {
  if (!apiKey) {
    throw new Error(
      "createLiveLabAdapter requires ANTHROPIC_API_KEY. This factory never fabricates a key -- set the env var yourself before using --mode live."
    );
  }

  async function generate(requestedCount, context) {
    const prompt = JSON.stringify({
      run_id: context.runId,
      requested_count: requestedCount,
      existing_fingerprints: context.existingFingerprints,
      pack_keys: context.packKeys,
    });
    const text = await callAnthropic(apiKey, LAB_SYSTEM_PROMPT, prompt, { model });
    return extractJson(text);
  }

  async function revise(revisionPacket) {
    const revisionPrompt = JSON.stringify(revisionPacket);
    const system = `${LAB_SYSTEM_PROMPT}\nYou are now REVISING exactly one previously-rejected candidate against specific Auditor findings. Output ONLY the single revised candidate object (the same per-candidate shape as above, same lab_candidate_id), not a full batch.`;
    const text = await callAnthropic(apiKey, system, revisionPrompt, { model });
    return extractJson(text);
  }

  return { kind: "live", generate, revise };
}
