# JUMVI — Current Release Decision

**Build:** `fe4ffe6` (`claude/new-session-d884by` == `origin/main`)
**Scope:** English main route only
**Date:** 2026-08-25 / 26 UTC
**Weighted heuristic UX score:** **8.57 / 10**

---

## Decision

# READY WITH EXPLICIT PRODUCT DECISIONS

The product is behaviorally strong and technically sound. Nothing found in this audit blocks release on correctness grounds. What stands between this build and a clean result is not a defect list but **two questions only the product owner can answer**, both of which have a defensible answer either way and neither of which is currently written down.

---

## Why not `NOT READY`

Nothing is broken in a way that would fail a family. Measured, not asserted:

- 36/36 missions open as real sheets with three steps, a win condition, equipment, an illustration, a phone-down cue, task-specific safety, a Parent Tip and a Kids Challenge.
- Completion is exactly-once and fully reversible: XP, streak and done-state award and revert precisely; expired Undo is inert; repeated Start creates no duplicate timer; replaying a completed mission farms no XP.
- The Daily Champion star is one per family per day and survives profile and team switching on the same device — the repo's own suite tests exactly that scenario and passes.
- Accessibility holds up under real measurement: every visible control is named, keyboard focus is visibly indicated on 14/14 tab stops, there is no horizontal overflow at any tested viewport, at 195 px, or at 200 % text.
- Offline keeps missions working; reset is a deliberate 1200 ms hold; the update path distinguishes "already latest", "check failed" and "update found" honestly.
- The previously blocking P0 does not exist.

## Why not `RELEASE READY — HEURISTIC`

Two open questions, and one substantive content defect:

1. **A caregiver cannot pause a running mission, and the only exit destroys the run.** The Pause control exists and is correctly named but is 0 px tall and absent from the tab order; `closeMission()` calls `resetTimerUI()`, zeroing elapsed play. For a 180-second mission that is a real loss at exactly the moment a parent is most likely to need to stop — the Mott poll's 48 % who stand beside a child on a new physical challenge. The minimal running panel is a good, deliberate design; whether it should include a pause is a decision that has not been made explicitly.

2. **On 7 of 36 sheets the general safety footer contradicts the mission's own instruction.** *Sky Floater* prints "Always throw UP — never AT each other" and, below it, "Throw below face level". *Home Base*'s Parent Tip says "Set bases 8-10 big steps apart" under a footer reading "keep 1-3 m distance". This is not vagueness; it is two opposite instructions on one screen, and it trains parents to discount the safety text on the 29 sheets where it is correct.

3. **A first-paint fold with no affordance** hides an entire level option at 568×320 (0 % visible) and truncates it at 390×844 (75 %).

Items 1 and 2 are the ones requiring a decision. Item 3 is an ordinary P2 fix.

## Why not `FIELD-VALIDATED READY`

**No real US family, child or caregiver was tested.** No interview, no moderated session, no observation. Every persona score in this audit is a modelled expert judgement derived from national survey data, not from watching anyone use JUMVI.

Real iOS Safari, real Android Chrome, VoiceOver, TalkBack, OS-level font scaling, the real install prompt and real GPU hardware were all outside this environment (the 3D Hub was verified on software WebGL). Chromium at a mobile viewport is not a device.

**This label must not be used until a field study exists.** Even if every heuristic item in the backlog were closed, the correct label would be `RELEASE READY — HEURISTIC`. A heuristic 10/10 is never a field 10/10, and this build is not at 10/10 either.

---

## The two decisions to record

### Decision 1 — May a caregiver pause a running mission?

| Option | What it means | What must then change |
|---|---|---|
| **(a) Yes, expose pause** | A compact Pause/Resume in the running panel | Accessible name, visible focus, ≥44 px, pointer **and** keyboard reachable; elapsed/remaining/gate/completion stay correct; exactly one timer interval (repo T09–T11 must still pass); must not make holding the phone necessary for normal play |
| **(b) No, by design** | The running screen stays minimal — phone down, no controls | Then Close and Escape must stop silently destroying the run: confirm first, or preserve the run and offer to resume. The current behavior — an unannounced reset — is not a defensible implementation of (b) |

Both are legitimate. What is not legitimate is the present state: a control that exists, is named, cannot be reached, and whose only alternative discards the user's progress without saying so.

### Decision 2 — May a general safety rule contradict the mission above it?

The answer is almost certainly no, but it needs to be written down, because the fix is a content policy rather than a patch: **a general safety clause may not appear on a sheet whose own instructions require breaking it.** The product already demonstrates the right pattern — mission 7's "no higher than the thrower can reach with one arm up" — so this is a matter of scoping the general footer, not of writing new safety guidance from scratch.

---

## Conditions for moving to `RELEASE READY — HEURISTIC`

1. Decision 1 recorded and implemented (either path).
2. Decision 2 recorded; the 7 contradicting sheets corrected; a regression check added.
3. P2.1 (first-paint fold) and P2.3 (Play CTA at 320×568) closed.
4. P2.2 (safety block extended to height/distance/running missions) closed.
5. Full regression green: the repo battery plus the 36-mission schema and sheet checks.

## Conditions for `FIELD-VALIDATED READY`

6. 5–8 US caregiver/child pairs across ages 3–5, 6–8, 8+; small indoor space; multi-child household; at least one child with a motor or attention difference.
7. Real-device and screen-reader passes (iOS Safari + VoiceOver, Android Chrome + TalkBack).
8. 3D Hub verified on real device GPU hardware (software WebGL and all six fallback paths already pass).
9. Persona and safety scores re-derived from observed behavior rather than modelled.

---

## Scope statement

This audit changed **no application code**, created no pull request, performed no merge and triggered no deploy. It produced evaluation artifacts only. The TR/Turkish route was not opened, scored or modified.
