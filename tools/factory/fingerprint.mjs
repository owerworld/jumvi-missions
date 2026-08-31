/* ═══════════════════════════════════════════════════════════════════════════
 * fingerprint.mjs — structural fingerprinting and duplicate/near-duplicate
 * detection, plus the deterministic pre-Auditor gate: DUPLICATE / HARD-GATE
 * (HG10) / CATEGORY.
 *
 * GOVERNANCE NOTE
 * HG10 completeness and the Phase 3 physical principles are NOT defined in
 * this file. They are pinned, versioned data in tools/factory/governance/
 * (hg10-schema.json, physical-principles.json), consumed here through
 * tools/factory/governance/governance.mjs. This file used to define its own
 * ad hoc HARD_GATE_CHECKLIST / PHASE3_CONSTRAINTS lists and call them
 * authoritative -- that was wrong and has been removed. If those governance
 * files change, this file's behavior changes with them; nothing here
 * duplicates a rule list.
 * ══════════════════════════════════════════════════════════════════════════*/
import { validateHG10Genome, checkPhysicalPrinciples } from "./governance/governance.mjs";

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
 * by house style, not by mechanic. This technique (Jaccard over a token bag)
 * is this implementation's own duplicate-detection method, unrelated to the
 * governance-pinned HG10/Phase-3 rules below. */
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

/* ── deterministic pre-Auditor gate: DUPLICATE / HARD-GATE (HG10) / CATEGORY ─
 *
 * Three outcomes for a candidate:
 *   1. hardFail (HG10 incomplete, or an ENFORCED Phase-3/duplicate/category
 *      violation) -> the candidate is dropped before the Auditor ever sees
 *      it. blockers[0] is always HG10_SCHEMA.hard_fail_code verbatim when
 *      the failure is genome incompleteness.
 *   2. passed with unknownFields non-empty -> NOT a hard fail (UNKNOWN is a
 *      valid, honest state, never guessed) but the candidate is flagged so
 *      the Auditor is expected to route it to REVISE_AND_REAUDIT rather
 *      than approve it with unresolved fields.
 *   3. passed cleanly.
 * ────────────────────────────────────────────────────────────────────── */
export function runPreAuditChecks(candidate, { existingFingerprints, batchSiblingFingerprints, existingPackKeys }) {
  const blockers = [];
  const candidateFp = structuralFingerprint(candidate);

  // HG10 — canonical physical genome completeness (governance-pinned).
  const hg10 = validateHG10Genome(candidate.physical_genome);
  if (hg10.hardFail) {
    blockers.push(`${hg10.hardFailCode}: missing ${hg10.missingFields.join(", ")}`);
  }

  // Phase 3 — enforced hard constraints only (governance-pinned). Judgment-
  // required constraints are never auto-rejected; they're surfaced for the
  // Auditor via judgmentFlags.
  const maxPlayers = Number(String(candidate.players).split("–").pop());
  const maxBalls = Number(candidate.equipment?.balls);
  const physical = checkPhysicalPrinciples({
    playerCountMax: maxPlayers,
    ballCountMax: maxBalls,
    equipment: candidate.equipment,
    genome: candidate.physical_genome,
  });
  blockers.push(...physical.violations);

  // Category / pack — this factory never creates a new pack.
  if (!existingPackKeys.has(candidate.pack)) {
    blockers.push(`CATEGORY: pack "${candidate.pack}" is not one of the existing packs — this factory never creates a new pack`);
  }

  // Duplicate vs. real inventory.
  const nearestExisting = nearestFingerprint(candidateFp, existingFingerprints);
  if (nearestExisting && nearestExisting.similarity >= NEAR_DUPLICATE_THRESHOLD) {
    blockers.push(
      `DUPLICATE: ${nearestExisting.exactTitle ? "identical title to" : `${(nearestExisting.similarity * 100).toFixed(0)}% structural overlap with`} existing mission "${nearestExisting.other.title}"`
    );
  }

  // Duplicate vs. batch siblings (excluding self).
  const siblingFps = batchSiblingFingerprints.filter((fp) => fp.id !== candidateFp.id);
  const nearestSibling = siblingFps.length ? nearestFingerprint(candidateFp, siblingFps) : null;
  if (nearestSibling && nearestSibling.similarity >= NEAR_DUPLICATE_THRESHOLD) {
    blockers.push(
      `BATCH_DUPLICATE: ${nearestSibling.exactTitle ? "identical title to" : `${(nearestSibling.similarity * 100).toFixed(0)}% structural overlap with`} batch sibling "${nearestSibling.other.title}"`
    );
  }

  // Basic renderable-mission shape (the importer checks this again
  // independently -- this is an early, cheap filter, not the only gate).
  if (!Array.isArray(candidate.steps) || candidate.steps.length < 1 || candidate.steps.length > 3) {
    blockers.push("STEPS: must be 1-3 entries");
  }
  const maxPaddles = Array.isArray(candidate.equipment?.paddles)
    ? candidate.equipment.paddles[candidate.equipment.paddles.length - 1]
    : candidate.equipment?.paddles;
  if (Number.isFinite(maxPlayers) && Number.isInteger(maxPaddles) && maxPaddles < maxPlayers) {
    blockers.push(`EQUIPMENT: ${maxPlayers} players but only ${maxPaddles} paddles`);
  }

  return {
    passed: blockers.length === 0,
    blockers,
    hg10,
    hasUnknownGenomeFields: hg10.hasUnknown,
    unknownGenomeFields: hg10.unknownFields,
    judgmentFlags: physical.judgmentFlags,
    nearestExisting: nearestExisting ? { similarity: nearestExisting.similarity, title: nearestExisting.other.title } : null,
    nearestSibling: nearestSibling ? { similarity: nearestSibling.similarity, title: nearestSibling.other.title } : null,
  };
}
