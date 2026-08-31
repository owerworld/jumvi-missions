/* ═══════════════════════════════════════════════════════════════════════════
 * prompts.mjs — the ONLY place code loads the Lab / Auditor system prompts
 * from. The prompt TEXT is pinned in versioned files next to this module
 * (lab.v1.txt, auditor.v1.txt) -- never inlined as a string literal in
 * lab.mjs / auditor.mjs. This mirrors tools/factory/governance/governance.mjs's
 * "rules live in a pinned file, code only loads it" pattern, applied to
 * prompt text instead of JSON rule data.
 *
 * Bumping a prompt is adding a new lab.vN.txt / auditor.vN.txt file and
 * moving the *_PROMPT_VERSION constant below to point at it -- the previous
 * version stays on disk, so a run's artifacts (which record the version
 * used, see lab.mjs/auditor.mjs's adapter `promptVersion`) always resolve
 * to the exact prompt text that produced them.
 * ══════════════════════════════════════════════════════════════════════════*/
import { readFileSync } from "node:fs";
import path from "node:path";

export const LAB_PROMPT_VERSION = "v1";
export const AUDITOR_PROMPT_VERSION = "v1";

function loadPromptText(fileName) {
  return readFileSync(path.join(import.meta.dirname, fileName), "utf8").trimEnd();
}

export function loadLabSystemPrompt(version = LAB_PROMPT_VERSION) {
  return loadPromptText(`lab.${version}.txt`);
}

export function loadAuditorSystemPrompt(version = AUDITOR_PROMPT_VERSION) {
  return loadPromptText(`auditor.${version}.txt`);
}
