/* ═══════════════════════════════════════════════════════════════════════════
 * fingerprint.mjs — structural fingerprinting, duplicate/near-duplicate
 * detection, and the HG10 hard-gate + Phase 3 physical-constraint checklists
 * used both as (a) a deterministic pre-Auditor filter and (b) the reference
 * material handed to the Auditor so its independent review has the same
 * ground truth.
 *
 * ON "HG10" AND "PHASE 3 PHYSICAL CONSTRAINTS"
 * No existing spec for these was found anywhere in this repository. The
 * lists below are this implementation's own operational definition, written
 * to match the product this repo actually ships (a 2-4 player toss & catch
 * paddle set for ages 3-8, six existing packs, missions described in
 * "big-kid steps" not exact distances — see data.js). If the real JUMVI
 * production pipeline has an authoritative HG10 / Phase 3 document, replace
 * HARD_GATE_CHECKLIST / PHASE3_CONSTRAINTS below with it — every consumer in
 * this factory reads them from here, never duplicates them inline.
 * ══════════════════════════════════════════════════════════════════════════*/

export const HARD_GATE_CHECKLIST = Object.freeze([
  "HG1  — exactly one clear core mechanic (not a blend of two unrelated games)",
  "HG2  — safety line is specific to this mechanic, not generic filler",
  "HG3  — equipment count covers the stated max player count",
  "HG4  — 1-3 steps, each independently actionable by a child",
  "HG5  — win/goal condition is objectively measurable (a count, a time, a streak)",
  "HG6  — age band matches the motor/cognitive demand of the mechanic",
  "HG7  — pack/category is one of the six existing packs, correctly matched to the mechanic's theme",
  "HG8  — title is not identical or near-identical to any existing mission or batch sibling",
  "HG9  — difficulty rating (1-3) matches the actual step/coordination complexity",
  "HG10 — no prohibited high-risk mechanic (blindfolding, running collisions, face/head-level targeting, off-body contact)",
]);

export const PHASE3_CONSTRAINTS = Object.freeze([
  "P3.1 — all throws are described below chin/shoulder height by default",
  "P3.2 — starting distance is given in \"big-kid steps\", matching every existing mission's phrasing",
  "P3.3 — no mechanic requires more than 4 simultaneous players (matches the app's team-size ceiling)",
  "P3.4 — no sustained running that could cause player-to-player collision; movement is walk/step-based",
  "P3.5 — equipment role (paddle vs. ball count) is unambiguous per player, no shared/contested single item",
  "P3.6 — mission is playable in a home or small-yard footprint (Indoor Compact / Beach-Park framing already covers open space)",
  "P3.7 — no mechanic that pits players against each other for the same object at the same moment (collision/interception risk)",
]);

/* ── tokenization / bag-of-words fingerprint ─────────────────────────────── */
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "with", "your", "you",
  "it", "is", "at", "for", "than", "then", "into", "back", "each", "one",
  "two", "three", "four", "five", "big", "kid", "steps", "step", "player",
  "players", "ball", "paddle", "throw", "throws", "catch", "catches",
]);

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t));
}

/** Structural fingerprint: pack + difficulty band + a token bag drawn from
 * title/steps/win, so two missions with different wording but the same
 * mechanic still overlap heavily (e.g. "freeze on red light" vs "stop when
 * the whistle blows"). Deliberately excludes safety/tip text -- those vary
 * by house style, not by mechanic. */
export function structuralFingerprint(mission) {
  const tokens = new Set([
    ...tokenize(mission.title),
    ...tokenize(Array.isArray(mission.steps) ? mission.steps.join(" ") : ""),
    ...tokenize(mission.win),
  ]);
  return {
    id: mission.id ?? mission.lab_candidate_id ?? null,
    title: mission.title,
    pack: mission.pack,
    difficulty: mission.difficulty,
    tokens: [...tokens].sort(),
  };
}

export function fingerprintExistingMissions(missions) {
  return missions.map(structuralFingerprint);
}

function jaccard(aTokens, bTokens) {
  const a = new Set(aTokens);
  const b = new Set(bTokens);
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

export const NEAR_DUPLICATE_THRESHOLD = 0.5;
export const EXACT_TITLE_MATCH = (a, b) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

/** Highest-similarity match against a corpus of fingerprints. Same-pack
 * overlap is weighted slightly higher (a shared mechanic in the same pack is
 * more likely a true duplicate than an incidental word overlap across
 * unrelated packs), but any fingerprint over the threshold is reported. */
export function nearestFingerprint(candidateFp, corpus) {
  let best = null;
  for (const other of corpus) {
    if (EXACT_TITLE_MATCH(candidateFp.title, other.title)) {
      return { similarity: 1, exactTitle: true, other };
    }
    let sim = jaccard(candidateFp.tokens, other.tokens);
    if (candidateFp.pack === other.pack) sim = Math.min(1, sim * 1.15);
    if (!best || sim > best.similarity) best = { similarity: sim, exactTitle: false, other };
  }
  return best;
}

/* ── deterministic pre-Auditor gate: DUPLICATE / HARD-GATE / CATEGORY ────── */
export function runPreAuditChecks(candidate, { existingFingerprints, batchSiblingFingerprints, existingPackKeys }) {
  const blockers = [];
  const candidateFp = structuralFingerprint(candidate);

  // Category / pack
  if (!existingPackKeys.has(candidate.pack)) {
    blockers.push(`HG7/category: pack "${candidate.pack}" is not one of the existing packs — this factory never creates a new pack`);
  }

  // Duplicate vs. real inventory
  const nearestExisting = nearestFingerprint(candidateFp, existingFingerprints);
  if (nearestExisting && nearestExisting.similarity >= NEAR_DUPLICATE_THRESHOLD) {
    blockers.push(
      `HG8/duplicate: ${nearestExisting.exactTitle ? "identical title to" : `${(nearestExisting.similarity * 100).toFixed(0)}% structural overlap with`} existing mission "${nearestExisting.other.title}"`
    );
  }

  // Duplicate vs. batch siblings (excluding self)
  const siblingFps = batchSiblingFingerprints.filter((fp) => fp.id !== candidateFp.id);
  const nearestSibling = siblingFps.length ? nearestFingerprint(candidateFp, siblingFps) : null;
  if (nearestSibling && nearestSibling.similarity >= NEAR_DUPLICATE_THRESHOLD) {
    blockers.push(
      `HG8/batch-duplicate: ${nearestSibling.exactTitle ? "identical title to" : `${(nearestSibling.similarity * 100).toFixed(0)}% structural overlap with`} batch sibling "${nearestSibling.other.title}"`
    );
  }

  // Deterministic subset of HG10 that doesn't need judgment
  if (!Array.isArray(candidate.steps) || candidate.steps.length < 1 || candidate.steps.length > 3) {
    blockers.push("HG4: steps must be 1-3 entries");
  }
  const maxPlayers = Number(String(candidate.players).split("–").pop());
  const maxPaddles = Array.isArray(candidate.equipment?.paddles)
    ? candidate.equipment.paddles[candidate.equipment.paddles.length - 1]
    : candidate.equipment?.paddles;
  if (Number.isFinite(maxPlayers) && Number.isInteger(maxPaddles) && maxPaddles < maxPlayers) {
    blockers.push(`HG3: ${maxPlayers} players but only ${maxPaddles} paddles`);
  }
  if (Number.isFinite(maxPlayers) && maxPlayers > 4) {
    blockers.push("P3.3: more than 4 simultaneous players");
  }

  return {
    passed: blockers.length === 0,
    blockers,
    nearestExisting: nearestExisting ? { similarity: nearestExisting.similarity, title: nearestExisting.other.title } : null,
    nearestSibling: nearestSibling ? { similarity: nearestSibling.similarity, title: nearestSibling.other.title } : null,
  };
}
