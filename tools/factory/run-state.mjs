/* ═══════════════════════════════════════════════════════════════════════════
 * run-state.mjs — the durable state machine behind every mission-factory
 * run. A run's ENTIRE lifecycle (generation -> human decision -> publish)
 * lives on disk under artifacts/mission-runs/<RUN_ID>/state.json, never in
 * one process's memory. This is what lets `node tools/jumvi-mission-factory.mjs
 * --count 6` exit cleanly after showing the Turkish review instead of
 * blocking a process on stdin, and lets a LATER, COMPLETELY SEPARATE node
 * invocation (`--resume <RUN_ID> --approve`) pick the exact same audited
 * batch back up -- including across a process crash, a container restart,
 * or (as happened for real) a sandbox reclaiming a detached process mid-wait.
 *
 * STATES
 *   GENERATING                -> the pipeline is running (Lab/Auditor/revision)
 *   WAITING_FOR_HUMAN_APPROVAL -> generation finished, review is on disk,
 *                                 waiting for --resume --approve|--cancel
 *   CANCELLED                 -> İPTAL. Terminal. Zero repo writes ever made.
 *   PUBLISHING                -> ONAY received, import->test->PR->CI->merge->
 *                                 deploy chain is running
 *   PUBLISHED                 -> published and production-verified. Terminal.
 *   PUBLISH_STOPPED           -> the publish chain stopped itself for cause
 *                                 (stale main, CI red, a failed post-apply
 *                                 test, ...). Terminal -- re-run the factory
 *                                 for fresh ids rather than retrying this run.
 *   FAILED                    -> an unexpected error, not a deliberate stop.
 *                                 Terminal.
 *
 * Every transition is validated against VALID_TRANSITIONS below -- there is
 * no code path that can move a run from CANCELLED to PUBLISHING, or from
 * PUBLISHED back to WAITING_FOR_HUMAN_APPROVAL. That is the actual
 * enforcement mechanism behind "a cancelled run cannot be approved" and "a
 * published run cannot be published twice", not a convention callers have
 * to remember to respect.
 *
 * CRASH SAFETY: state.json is written via write-to-temp-then-rename
 * (writeRunStateAtomic below) so a process killed mid-write can never leave
 * a half-written state.json -- a reader sees the complete old version or
 * the complete new version, never a corrupt mix. readRunState() additionally
 * validates shape (required fields, a recognised `state` value) and throws
 * CorruptRunStateError on anything else -- callers must treat that as
 * fail-closed, the same discipline tools/factory/governance/governance.mjs
 * applies to an unresolved HG10 field: never guessed, never patched.
 * ══════════════════════════════════════════════════════════════════════════*/
import { readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import path from "node:path";

export const RUN_STATES = Object.freeze({
  GENERATING: "GENERATING",
  WAITING_FOR_HUMAN_APPROVAL: "WAITING_FOR_HUMAN_APPROVAL",
  CANCELLED: "CANCELLED",
  PUBLISHING: "PUBLISHING",
  PUBLISHED: "PUBLISHED",
  PUBLISH_STOPPED: "PUBLISH_STOPPED",
  FAILED: "FAILED",
});

const TERMINAL_STATES = new Set([
  RUN_STATES.CANCELLED,
  RUN_STATES.PUBLISHED,
  RUN_STATES.PUBLISH_STOPPED,
  RUN_STATES.FAILED,
]);

/** The ONLY table of legal state transitions. Not duplicated anywhere else
 * -- transitionRunState() is the sole place a run's `state` field changes. */
const VALID_TRANSITIONS = Object.freeze({
  [RUN_STATES.GENERATING]: [RUN_STATES.WAITING_FOR_HUMAN_APPROVAL, RUN_STATES.FAILED],
  [RUN_STATES.WAITING_FOR_HUMAN_APPROVAL]: [RUN_STATES.CANCELLED, RUN_STATES.PUBLISHING],
  [RUN_STATES.PUBLISHING]: [RUN_STATES.PUBLISHED, RUN_STATES.PUBLISH_STOPPED, RUN_STATES.FAILED],
  [RUN_STATES.CANCELLED]: [],
  [RUN_STATES.PUBLISHED]: [],
  [RUN_STATES.PUBLISH_STOPPED]: [],
  [RUN_STATES.FAILED]: [],
});

export class RunStateError extends Error {}
export class RunNotFoundError extends RunStateError {}
export class CorruptRunStateError extends RunStateError {}
export class InvalidTransitionError extends RunStateError {}

function stateFilePath(runDir) {
  return path.join(runDir, "state.json");
}

const REQUIRED_FIELDS = ["run_id", "state", "requested_count", "created_at", "updated_at", "history"];

/** Reads and validates state.json. Throws rather than returning a
 * best-effort/partial object -- there is no "probably fine" reading of a
 * run's approval state. */
export function readRunState(runDir) {
  const file = stateFilePath(runDir);
  if (!existsSync(file)) {
    throw new RunNotFoundError(`no run found at "${runDir}" (state.json does not exist)`);
  }
  let raw;
  try {
    raw = readFileSync(file, "utf8");
  } catch (e) {
    throw new CorruptRunStateError(`could not read ${file}: ${e.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new CorruptRunStateError(`${file} is not valid JSON: ${e.message}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CorruptRunStateError(`${file} does not contain a JSON object`);
  }
  for (const field of REQUIRED_FIELDS) {
    if (parsed[field] === undefined) {
      throw new CorruptRunStateError(`${file} is missing required field "${field}"`);
    }
  }
  if (!Object.values(RUN_STATES).includes(parsed.state)) {
    throw new CorruptRunStateError(`${file} has an unrecognised state "${parsed.state}"`);
  }
  return parsed;
}

/** write-to-temp-then-rename: state.json is replaced atomically, never
 * observable half-written. */
function writeRunStateAtomic(runDir, stateObj) {
  const file = stateFilePath(runDir);
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  writeFileSync(tmp, `${JSON.stringify(stateObj, null, 2)}\n`);
  renameSync(tmp, file);
}

/** Creates a brand-new run's state.json in GENERATING. Called exactly once,
 * at the very start of a generate command, before the pipeline runs. */
export function initRunState(runDir, { runId, requestedCount }) {
  const now = new Date().toISOString();
  const state = {
    run_id: runId,
    state: RUN_STATES.GENERATING,
    requested_count: requestedCount,
    created_at: now,
    updated_at: now,
    history: [{ state: RUN_STATES.GENERATING, at: now }],
  };
  writeRunStateAtomic(runDir, state);
  return state;
}

/**
 * Moves a run from its CURRENT persisted state to `toState`, validated
 * against VALID_TRANSITIONS. `extra` fields are merged into the persisted
 * record (e.g. { approved_by, approved_at } on the move into PUBLISHING).
 * Throws InvalidTransitionError -- never silently applies a transition
 * that was never declared legal, and never overwrites a terminal state.
 * This is the actual enforcement point behind "cancelled run cannot be
 * approved" / "published run cannot be republished" / "double approval
 * is refused".
 */
export function transitionRunState(runDir, toState, extra = {}) {
  const current = readRunState(runDir);
  const allowed = VALID_TRANSITIONS[current.state] || [];
  if (!allowed.includes(toState)) {
    throw new InvalidTransitionError(
      `run ${current.run_id}: cannot move from ${current.state} to ${toState} ` +
      `(allowed from ${current.state}: ${allowed.length ? allowed.join(", ") : "none -- this is a terminal state"})`
    );
  }
  const now = new Date().toISOString();
  const next = {
    ...current,
    ...extra,
    state: toState,
    updated_at: now,
    history: [...current.history, { state: toState, at: now }],
  };
  writeRunStateAtomic(runDir, next);
  return next;
}

export function isTerminal(state) {
  return TERMINAL_STATES.has(state);
}
