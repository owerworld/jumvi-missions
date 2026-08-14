/*
 * JUMVI mission voice-coaching metadata.
 *
 * This file deliberately contains no child-facing copy. Every spoken recap or
 * reminder must be resolved at runtime from the existing localized mission
 * object (`missions[id].steps`, `.safety`, or `.win`). That keeps the original
 * 36 mission rules as the single source of truth and lets /tr use the same
 * metadata after its existing localization layer has translated the missions.
 *
 * `replay` controls how much is read on a repeat play:
 *   quick — the indexed essential step(s), then the existing win condition
 *   recap — the indexed sequence steps, then the existing win condition
 *   full  — all existing steps, then the existing win condition
 *
 * `reminder.fraction` is elapsed timer progress (0.5 = halfway). A reminder
 * points only to an existing step or safety line; it never invents a new rule.
 * The player must still opt into voice coaching, and the runtime should fire
 * each entry at most once per run. Mission 2 has its own live caller and
 * Mission 13 requires silence, so both intentionally have no reminders.
 */
(function exposeMissionCoaching(global) {
  "use strict";

  global.JUMVI_MISSION_COACHING = {
    1:  { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    2:  { replay: "full",  quickStepIndexes: [0, 1, 2], reminders: [] },
    3:  { replay: "recap", quickStepIndexes: [1, 2],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    4:  { replay: "recap", quickStepIndexes: [0, 1],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    5:  { replay: "quick", quickStepIndexes: [0],       reminders: [{ fraction: 0.5, source: "step", index: 0 }] },
    6:  { replay: "quick", quickStepIndexes: [0],       reminders: [{ fraction: 0.5, source: "step", index: 0 }] },

    7:  { replay: "recap", quickStepIndexes: [1, 2],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    8:  { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    9:  { replay: "full",  quickStepIndexes: [0, 1, 2], reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    10: { replay: "recap", quickStepIndexes: [1, 2],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    11: { replay: "quick", quickStepIndexes: [2],       reminders: [{ fraction: 0.5, source: "step", index: 2 }] },
    12: { replay: "recap", quickStepIndexes: [1, 2],    reminders: [{ fraction: 0.5, source: "step", index: 2 }] },

    13: { replay: "quick", quickStepIndexes: [0],       reminders: [] },
    14: { replay: "recap", quickStepIndexes: [0, 2],    reminders: [{ fraction: 0.5, source: "step", index: 2 }] },
    15: { replay: "quick", quickStepIndexes: [0],       reminders: [{ fraction: 0.5, source: "step", index: 0 }] },
    16: { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    17: { replay: "recap", quickStepIndexes: [0, 1],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    18: { replay: "quick", quickStepIndexes: [0],       reminders: [{ fraction: 0.5, source: "step", index: 0 }] },

    // Longer team missions get two spaced cues because roles or formations
    // change during play. Both cues still quote the mission's existing steps.
    19: { replay: "full", quickStepIndexes: [0, 1, 2], reminders: [
      { fraction: 0.33, source: "step", index: 1 },
      { fraction: 0.66, source: "step", index: 2 }
    ] },
    20: { replay: "full", quickStepIndexes: [0, 1, 2], reminders: [
      { fraction: 0.33, source: "step", index: 1 },
      { fraction: 0.66, source: "step", index: 2 }
    ] },
    21: { replay: "full", quickStepIndexes: [0, 1, 2], reminders: [
      { fraction: 0.33, source: "step", index: 1 },
      { fraction: 0.66, source: "step", index: 2 }
    ] },
    22: { replay: "full", quickStepIndexes: [0, 1, 2], reminders: [
      { fraction: 0.33, source: "step", index: 1 },
      { fraction: 0.66, source: "step", index: 2 }
    ] },
    23: { replay: "full", quickStepIndexes: [0, 1, 2], reminders: [
      { fraction: 0.33, source: "step", index: 1 },
      { fraction: 0.66, source: "step", index: 2 }
    ] },
    24: { replay: "full", quickStepIndexes: [0, 1, 2], reminders: [
      { fraction: 0.33, source: "step", index: 1 },
      { fraction: 0.66, source: "step", index: 2 }
    ] },

    25: { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "step", index: 2 }] },
    26: { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "step", index: 2 }] },
    27: { replay: "recap", quickStepIndexes: [1, 2],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    28: { replay: "full",  quickStepIndexes: [0, 1, 2], reminders: [{ fraction: 0.5, source: "step", index: 2 }] },
    29: { replay: "quick", quickStepIndexes: [0],       reminders: [{ fraction: 0.5, source: "step", index: 0 }] },
    30: { replay: "recap", quickStepIndexes: [0, 1],    reminders: [{ fraction: 0.5, source: "step", index: 0 }] },

    31: { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "safety" }] },
    32: { replay: "recap", quickStepIndexes: [0, 1],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    33: { replay: "full",  quickStepIndexes: [0, 1, 2], reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    34: { replay: "recap", quickStepIndexes: [1, 2],    reminders: [{ fraction: 0.5, source: "step", index: 2 }] },
    35: { replay: "recap", quickStepIndexes: [0, 1],    reminders: [{ fraction: 0.5, source: "step", index: 1 }] },
    36: { replay: "quick", quickStepIndexes: [1],       reminders: [{ fraction: 0.5, source: "step", index: 1 }] }
  };
})(window);
