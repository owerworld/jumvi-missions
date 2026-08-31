/* ═══════════════════════════════════════════════════════════════════════════
 * schemas.mjs — structured contracts for every model-to-model handoff in the
 * mission factory (Lab output, Auditor input/output, revision packet, final
 * approved batch, publish plan, deployment result).
 *
 * Hand-rolled, not a JSON-Schema library: the repo carries no dependencies
 * (no package.json / node_modules), and this mirrors the same validation
 * style already used by tools/import-approved-missions.mjs
 * (validateCandidateShape) and tools/check-mission-schema.mjs.
 *
 * FAIL-CLOSED CONTRACT: every validate* function returns { valid, errors }.
 * Nothing downstream may act on a payload that failed validation — see
 * validateOrRetry(), which is the only sanctioned way a caller turns a raw
 * (Lab/Auditor) response into a trusted object. There is no "best effort"
 * parse anywhere in this file.
 * ══════════════════════════════════════════════════════════════════════════*/

const VERDICTS = new Set(["APPROVE_FOR_REAL_CHILD_PLAYTEST", "REVISE_AND_REAUDIT", "REJECT"]);

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function isStringArray(v, { min = 0, max = Infinity } = {}) {
  return Array.isArray(v) && v.length >= min && v.length <= max && v.every((s) => isNonEmptyString(s));
}

/* ── mission-model fields shared with data/approved-mission-batch.schema.json
 *    (the Lab must produce candidates that will, once approved, satisfy that
 *    exact contract — this is checked again by the importer itself, so this
 *    is belt-and-braces, not the only gate) ─────────────────────────────── */
function missionFieldErrors(c, label) {
  const errors = [];
  if (!isNonEmptyString(c.title)) errors.push(`${label}: "title" is empty`);
  if (!isNonEmptyString(c.pack)) errors.push(`${label}: "pack" is empty`);
  if (![1, 2, 3].includes(c.difficulty)) errors.push(`${label}: difficulty ${JSON.stringify(c.difficulty)} outside 1-3`);
  if (!/^\d+(–\d+)?$/.test(String(c.players))) errors.push(`${label}: players "${c.players}" is not "N" or "N–M" (en dash)`);
  if (!/^\d+s$/.test(String(c.time))) errors.push(`${label}: time "${c.time}" is not "Ns"`);
  if (!/^\d+\+$/.test(String(c.age))) errors.push(`${label}: age "${c.age}" is not "N+"`);
  if (!isStringArray(c.steps, { min: 1, max: 3 })) errors.push(`${label}: "steps" must be 1-3 non-empty strings`);
  if (!isNonEmptyString(c.win)) errors.push(`${label}: "win" is empty`);
  if (!isNonEmptyString(c.safety)) errors.push(`${label}: "safety" is empty`);
  if (!isNonEmptyString(c.tip)) errors.push(`${label}: "tip" is empty`);
  const eq = c.equipment;
  if (!eq || typeof eq !== "object" || Array.isArray(eq)) {
    errors.push(`${label}: "equipment" is not an object`);
  } else {
    const maxPaddles = Array.isArray(eq.paddles) ? eq.paddles[eq.paddles.length - 1] : eq.paddles;
    if (!Number.isInteger(maxPaddles) || maxPaddles < 1) errors.push(`${label}: equipment.paddles is not a positive count`);
    if (!Number.isInteger(eq.balls) || eq.balls < 1) errors.push(`${label}: equipment.balls is not a positive count`);
  }
  // The candidate's physical genome (HG10). This checks only that the field
  // is present and shaped like an object -- whether it's actually HG10
  // COMPLETE (all 14 canonical fields resolved or explicitly UNKNOWN) is a
  // governance-pinned question, answered by
  // tools/factory/governance/governance.mjs's validateHG10Genome(), not
  // here. This file only owns the structural contract; the semantic rule
  // list lives in tools/factory/governance/ and nowhere else.
  if (!c.physical_genome || typeof c.physical_genome !== "object" || Array.isArray(c.physical_genome)) {
    errors.push(`${label}: "physical_genome" is not an object`);
  }
  return errors;
}

/* ── 1. Lab output ─────────────────────────────────────────────────────── */
export function validateLabOutput(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Lab output is not an object"] };
  if (!isNonEmptyString(obj.run_id)) errors.push("run_id is missing");
  if (!Number.isInteger(obj.requested_count) || obj.requested_count < 1) errors.push("requested_count must be a positive integer");
  if (!isNonEmptyString(obj.generated_at)) errors.push("generated_at is missing");
  if (!Array.isArray(obj.candidates)) {
    errors.push("candidates is not an array");
    return { valid: errors.length === 0, errors };
  }
  obj.candidates.forEach((c, i) => {
    const label = `candidates[${i}]`;
    if (!c || typeof c !== "object") { errors.push(`${label}: not an object`); return; }
    if (!isNonEmptyString(c.lab_candidate_id)) errors.push(`${label}: lab_candidate_id is missing`);
    if (!isNonEmptyString(c.mechanics_summary)) errors.push(`${label}: mechanics_summary is missing`);
    if (!isNonEmptyString(c.uniqueness_rationale)) errors.push(`${label}: uniqueness_rationale is missing`);
    errors.push(...missionFieldErrors(c, label));
  });
  return { valid: errors.length === 0, errors };
}

/* ── 2. Auditor input ─────────────────────────────────────────────────── */
function isPlainObject(v) {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

export function validateAuditorInput(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Auditor input is not an object"] };
  if (!obj.candidate || typeof obj.candidate !== "object") errors.push("candidate is missing");
  else errors.push(...missionFieldErrors(obj.candidate, "candidate"));
  if (!Array.isArray(obj.batch_siblings)) errors.push("batch_siblings must be an array (may be empty)");
  if (!Array.isArray(obj.existing_fingerprints)) errors.push("existing_fingerprints must be an array");
  // governance: sourced from tools/factory/governance/governance.mjs at call
  // time (see pipeline.mjs) -- this is NOT a checklist authored in this
  // file. Only the shape is enforced here; the actual field list, versions,
  // and constraint text are pinned governance data.
  if (!isPlainObject(obj.governance)) {
    errors.push("governance is missing");
  } else {
    if (!isNonEmptyString(obj.governance.hg10_version)) errors.push("governance.hg10_version is missing");
    if (!isStringArray(obj.governance.hg10_canonical_fields, { min: 1 })) errors.push("governance.hg10_canonical_fields must be a non-empty string array");
    if (!isNonEmptyString(obj.governance.physical_principles_version)) errors.push("governance.physical_principles_version is missing");
    if (!Array.isArray(obj.governance.judgment_flags)) errors.push("governance.judgment_flags must be an array");
  }
  // hg10_status: the deterministic pre-audit gate's own read of this exact
  // candidate's genome completeness (tools/factory/fingerprint.mjs's
  // runPreAuditChecks), so the Auditor is told explicitly which fields (if
  // any) are still UNKNOWN rather than having to re-derive it blind.
  if (!isPlainObject(obj.hg10_status)) {
    errors.push("hg10_status is missing");
  } else {
    if (typeof obj.hg10_status.complete !== "boolean") errors.push("hg10_status.complete must be boolean");
    if (typeof obj.hg10_status.hasUnknown !== "boolean") errors.push("hg10_status.hasUnknown must be boolean");
    if (!Array.isArray(obj.hg10_status.unknownFields)) errors.push("hg10_status.unknownFields must be an array");
  }
  if (!Number.isInteger(obj.revision_round) || obj.revision_round < 0) errors.push("revision_round must be a non-negative integer");
  return { valid: errors.length === 0, errors };
}

/* ── 3. Auditor output ────────────────────────────────────────────────── */
export function validateAuditorOutput(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Auditor output is not an object"] };
  if (!isNonEmptyString(obj.lab_candidate_id)) errors.push("lab_candidate_id is missing");
  if (!VERDICTS.has(obj.auditor_verdict)) errors.push(`auditor_verdict "${obj.auditor_verdict}" is not one of ${[...VERDICTS].join(", ")}`);
  const f = obj.findings;
  if (!f || typeof f !== "object") {
    errors.push("findings is missing");
  } else {
    const need = [
      "existing_duplicate", "batch_duplicate", "hard_gate", "phase3_physical",
      "structural_similarity", "participation", "role_fairness", "event_clarity",
      "complexity", "safety", "category_placement", "evidence_quality",
    ];
    for (const key of need) {
      if (!f[key] || typeof f[key] !== "object") errors.push(`findings.${key} is missing`);
    }
    if (f.safety && !Array.isArray(f.safety.real_world_flags)) {
      errors.push("findings.safety.real_world_flags must be an array (may be empty)");
    }
  }
  if (obj.auditor_verdict === "REVISE_AND_REAUDIT" && !isNonEmptyString(obj.revision_instructions)) {
    errors.push("revision_instructions is required when auditor_verdict is REVISE_AND_REAUDIT");
  }
  return { valid: errors.length === 0, errors };
}

/* ── 4. Revision packet ───────────────────────────────────────────────── */
export function validateRevisionPacket(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Revision packet is not an object"] };
  if (!obj.original_candidate || typeof obj.original_candidate !== "object") errors.push("original_candidate is missing");
  if (!obj.auditor_findings || typeof obj.auditor_findings !== "object") errors.push("auditor_findings is missing");
  if (!isNonEmptyString(obj.revision_instructions)) errors.push("revision_instructions is missing");
  if (!Number.isInteger(obj.revision_round) || obj.revision_round < 1 || obj.revision_round > 3) {
    errors.push("revision_round must be an integer 1-3");
  }
  return { valid: errors.length === 0, errors };
}

/* ── 5. Final approved batch ──────────────────────────────────────────── */
export function validateFinalApprovedBatch(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Final approved batch is not an object"] };
  if (!isNonEmptyString(obj.run_id)) errors.push("run_id is missing");
  for (const key of ["approved", "revised_but_still_failed", "rejected_outright"]) {
    if (!Array.isArray(obj[key])) errors.push(`${key} must be an array`);
  }
  (obj.approved || []).forEach((entry, i) => {
    if (!entry.candidate) errors.push(`approved[${i}]: candidate is missing`);
    else errors.push(...missionFieldErrors(entry.candidate, `approved[${i}].candidate`));
    if (entry.auditor_output?.auditor_verdict !== "APPROVE_FOR_REAL_CHILD_PLAYTEST") {
      errors.push(`approved[${i}]: auditor_output.auditor_verdict must be APPROVE_FOR_REAL_CHILD_PLAYTEST`);
    }
  });
  return { valid: errors.length === 0, errors };
}

/* ── 6. Publish plan ──────────────────────────────────────────────────── */
export function validatePublishPlan(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Publish plan is not an object"] };
  if (!isNonEmptyString(obj.run_id)) errors.push("run_id is missing");
  const ha = obj.human_approval;
  if (!ha || typeof ha !== "object") errors.push("human_approval is missing");
  else {
    if (!["ONAY", "IPTAL"].includes(ha.decision)) errors.push('human_approval.decision must be "ONAY" or "IPTAL"');
    if (!isNonEmptyString(ha.timestamp)) errors.push("human_approval.timestamp is missing");
    if (!Number.isInteger(ha.approved_count) || ha.approved_count < 0) errors.push("human_approval.approved_count must be a non-negative integer");
  }
  if (!obj.import_plan || typeof obj.import_plan !== "object") errors.push("import_plan is missing");
  if (!isNonEmptyString(obj.batch_file_path)) errors.push("batch_file_path is missing");
  return { valid: errors.length === 0, errors };
}

/* ── 7. Deployment result ─────────────────────────────────────────────── */
export function validateDeploymentResult(obj) {
  const errors = [];
  if (!obj || typeof obj !== "object") return { valid: false, errors: ["Deployment result is not an object"] };
  if (!isNonEmptyString(obj.run_id)) errors.push("run_id is missing");
  if (!isNonEmptyString(obj.branch)) errors.push("branch is missing");
  if (!["success", "failure", "skipped", "pending"].includes(obj.ci_status)) errors.push("ci_status invalid");
  if (typeof obj.merged !== "boolean") errors.push("merged must be a boolean");
  if (typeof obj.production_verified !== "boolean") errors.push("production_verified must be a boolean");
  return { valid: errors.length === 0, errors };
}

/* ── retry-with-validation: the ONLY sanctioned way a raw model response
 *    becomes a trusted object. `producer` is called up to maxAttempts times;
 *    the first result to pass `validator` wins. Never guesses, never patches
 *    an invalid payload — a validator failure is fed back into the next
 *    producer() call (if any attempts remain) or the call fails closed. ─── */
export async function validateOrRetry(producer, validator, { maxAttempts = 2, context = "" } = {}) {
  let lastErrors = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw;
    try {
      raw = await producer(attempt, lastErrors);
    } catch (e) {
      lastErrors = [`producer threw: ${e.message}`];
      continue;
    }
    const { valid, errors } = validator(raw);
    if (valid) return { ok: true, value: raw, attempts: attempt };
    lastErrors = errors;
  }
  return { ok: false, errors: lastErrors, context, attempts: maxAttempts };
}
