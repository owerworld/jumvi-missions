/* ═══════════════════════════════════════════════════════════════════════════
 * governance.mjs — the ONLY place deterministic code reads HG10 / Phase 3
 * rules from. tools/factory/fingerprint.mjs and pipeline.mjs consume the
 * functions below; neither may hardcode a duplicate field list or rule set.
 *
 * The actual rules live in the two pinned, versioned JSON files next to this
 * module (hg10-schema.json, physical-principles.json) -- NOT in source, so
 * a governance change is a data diff, not a code diff.
 *
 * loadGovernanceFrom(dir) builds every validator bound to whatever JSON
 * lives in `dir`. The default export below is that function applied to this
 * module's own directory (the real, pinned governance) -- fingerprint.mjs
 * and pipeline.mjs import the plain named exports and never see the
 * factory. tools/check-mission-factory-governance.mjs calls
 * loadGovernanceFrom() a second time against a temp copy of the JSON with
 * one field deliberately edited, to prove the validators' behavior actually
 * comes from the file on disk -- not a list duplicated in this module --
 * i.e. that a governance change cannot silently fail to take effect.
 * ══════════════════════════════════════════════════════════════════════════*/
import { readFileSync } from "node:fs";
import path from "node:path";

function loadJsonFrom(dir, name) {
  return JSON.parse(readFileSync(path.join(dir, name), "utf8"));
}

export function loadGovernanceFrom(dir) {
  const HG10_SCHEMA = Object.freeze(loadJsonFrom(dir, "hg10-schema.json"));
  const PHYSICAL_PRINCIPLES = Object.freeze(loadJsonFrom(dir, "physical-principles.json"));
  const HG10_VERSION = HG10_SCHEMA.governance_version;
  const PHYSICAL_PRINCIPLES_VERSION = PHYSICAL_PRINCIPLES.governance_version;
  const HG10_HARD_FAIL_CODE = HG10_SCHEMA.hard_fail_code;

  /** Applies hg10-schema.json's normalization_map and consequence_merge to a
   * raw genome object, producing the canonical-field view. Never mutates the
   * input. Legacy names are additive fallbacks -- a genome that already uses
   * canonical names is untouched. */
  function normalizeGenome(rawGenome) {
    const genome = { ...(rawGenome || {}) };
    for (const [legacy, canonical] of Object.entries(HG10_SCHEMA.normalization_map)) {
      if (genome[canonical] === undefined && genome[legacy] !== undefined) {
        genome[canonical] = genome[legacy];
      }
    }
    const { target, sources } = HG10_SCHEMA.consequence_merge;
    if (genome[target] === undefined && sources.some((s) => genome[s] !== undefined)) {
      genome[target] = Object.fromEntries(
        sources.filter((s) => genome[s] !== undefined).map((s) => [s, genome[s]])
      );
    }
    return genome;
  }

  function isResolvedValue(value) {
    if (value === undefined || value === null) return false;
    if (typeof value === "string" && value.trim() === "") return false;
    if (Array.isArray(value) && value.length === 0) return false;
    if (typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === 0) return false;
    return true;
  }

  function isUnknownMarker(value) {
    return typeof value === "string" && value.trim().toUpperCase() === HG10_SCHEMA.unknown_marker;
  }

  /**
   * The HG10 hard gate. Every canonical field must be either genuinely
   * resolved, or explicitly UNKNOWN -- there is no third, silent state. A
   * field that is absent, empty, or null is a HARD_FAIL. A field that is
   * literally "UNKNOWN" is NOT a hard fail (it's an honest, valid state) but
   * is reported separately so the caller can route the candidate to
   * REVISE_AND_REAUDIT rather than treat it as resolved.
   */
  function validateHG10Genome(rawGenome) {
    const genome = normalizeGenome(rawGenome);
    const missingFields = [];
    const unknownFields = [];
    for (const field of HG10_SCHEMA.canonical_fields) {
      const value = genome[field];
      if (isUnknownMarker(value)) {
        unknownFields.push(field);
        continue;
      }
      if (!isResolvedValue(value)) {
        missingFields.push(field);
      }
    }
    const hardFail = missingFields.length > 0;
    return {
      complete: !hardFail,
      hardFail,
      hardFailCode: hardFail ? HG10_SCHEMA.hard_fail_code : null,
      missingFields,
      unknownFields,
      hasUnknown: unknownFields.length > 0,
      normalizedGenome: genome,
      governanceVersion: HG10_VERSION,
    };
  }

  function behaviorScanText(normalizedGenome) {
    const parts = [];
    for (const key of ["core_actions", "objective", "event_triggers", "consequences"]) {
      const v = normalizedGenome[key];
      if (typeof v === "string") parts.push(v);
      else if (Array.isArray(v)) parts.push(v.filter((x) => typeof x === "string").join(" "));
      else if (v && typeof v === "object") parts.push(Object.values(v).filter((x) => typeof x === "string").join(" "));
    }
    return parts.join(" ").toLowerCase();
  }

  /**
   * Deterministic Phase-3 checks. Only `enforced: true` hard_constraints can
   * ever produce a `violations` entry (a real hard fail). The judgment-
   * required constraints are ALWAYS returned as `judgmentFlags` for the
   * Auditor to weigh -- never auto-rejected here, per
   * meta_rules.behavioral_risk_not_auto_reject.
   */
  function checkPhysicalPrinciples({ playerCountMax, ballCountMax, equipment, genome }) {
    const normalized = normalizeGenome(genome || {});
    const violations = [];

    for (const c of PHYSICAL_PRINCIPLES.hard_constraints) {
      if (!c.enforced) continue;
      if (c.type === "numeric_bound") {
        const val = c.field === "player_count" ? playerCountMax : c.field === "ball_count" ? ballCountMax : null;
        if (typeof val === "number" && val > c.max) violations.push(`${c.id}: ${c.description} (got ${val})`);
      } else if (c.type === "equipment_allowlist") {
        const keys = Object.keys(equipment || {}).map((k) => k.toLowerCase());
        const bad = keys.filter((k) => !c.allowed.some((a) => k.startsWith(a)));
        if (bad.length) violations.push(`${c.id}: unrecognised equipment field(s) ${bad.join(", ")}`);
      } else if (c.type === "behavior_denylist") {
        const text = behaviorScanText(normalized);
        const hit = c.forbidden.filter((term) => text.includes(term));
        if (hit.length) violations.push(`${c.id}: forbidden mechanic language detected: ${hit.join(", ")}`);
      }
    }

    const judgmentFlags = PHYSICAL_PRINCIPLES.judgment_required_constraints.map((j) => ({ id: j.id, description: j.description }));

    return { violations, judgmentFlags, governanceVersion: PHYSICAL_PRINCIPLES_VERSION };
  }

  return {
    HG10_SCHEMA,
    PHYSICAL_PRINCIPLES,
    HG10_VERSION,
    PHYSICAL_PRINCIPLES_VERSION,
    HG10_HARD_FAIL_CODE,
    normalizeGenome,
    validateHG10Genome,
    checkPhysicalPrinciples,
  };
}

const PINNED = loadGovernanceFrom(import.meta.dirname);

export const HG10_SCHEMA = PINNED.HG10_SCHEMA;
export const PHYSICAL_PRINCIPLES = PINNED.PHYSICAL_PRINCIPLES;
export const HG10_VERSION = PINNED.HG10_VERSION;
export const PHYSICAL_PRINCIPLES_VERSION = PINNED.PHYSICAL_PRINCIPLES_VERSION;
export const HG10_HARD_FAIL_CODE = PINNED.HG10_HARD_FAIL_CODE;
export const normalizeGenome = PINNED.normalizeGenome;
export const validateHG10Genome = PINNED.validateHG10Genome;
export const checkPhysicalPrinciples = PINNED.checkPhysicalPrinciples;
