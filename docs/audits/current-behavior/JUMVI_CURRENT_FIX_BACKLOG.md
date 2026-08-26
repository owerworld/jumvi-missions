# JUMVI — Current Fix Backlog

Build audited: `fe4ffe6`. Scope: English main route only — do not open or modify the TR/Turkish route for any item here.

**No application code was changed by this audit.** Every item below is a proposal with an acceptance criterion, not an applied fix.

Ordering note: there is **no P0**. The item previously carried as P0 (onboarding occlusion) was re-measured and does not exist — see `JUMVI_CURRENT_EVIDENCE_LOG.md` §E1. Nothing currently blocks release on correctness grounds.

---

## P1 — needs a product decision, then an implementation

### P1.1 — A caregiver cannot pause a running mission, and Close destroys the run

**Evidence:** E3.2–E3.8. In the running state `btnStartTimer` reads "Pause" with `aria-label="Pause timer"` at 0 px height and is absent from the tab order. Real `Tab` traversal reaches only `btnClose` and `btnToggleDone`. `closeMission()` calls `resetTimerUI()` (app.js:5303 → 4108), zeroing `timerState`, `timerTotal`, `timerLeft` and `timerEndAt`. Confirmed live: a run closed at 67 s remaining reopens at "Start" / "60s".

**Why it matters:** the Mott 2025 poll reports that 48 % of parents stand beside or hold the hand of a child attempting a new physical challenge. That caregiver is the one most likely to need to break off — a sibling, the door, a safety call. Today the only exit destroys 180 seconds of *Marathon Rally*.

**This is a decision, not just a bug.** The minimal running panel ("Put the phone down — Leo will let you know") is deliberate, well-judged and research-aligned. Two defensible answers:

- **(a) Expose pause.** A compact, keyboard-reachable Pause in the running panel that toggles to Resume. Must not make holding the phone necessary for normal play.
- **(b) Decide there is no pause, and stop the silent destruction.** Close and Escape either confirm ("Stop this mission? You'll start over.") or preserve the run and offer to resume.

**Acceptance criteria (either path):**
- No route through the running state silently discards elapsed play.
- If a control is added: accessible name, visible focus, ≥44 px target, reachable by pointer and keyboard, correct under reduced motion.
- `elapsed`, `remaining`, gate and completion stay correct across pause → resume; exactly one timer interval at all times (repo T09–T11 must still pass).
- Narration, countdown, `visibilitychange`, close, completion, Undo, Daily Champion, streak, badges, personal/team progress and the `localStorage` debounce all unchanged.
- If path (b): the copy must state what happens, and the same state must genuinely be preserved if it claims to be.

**Also record:** pausing the timer does not pause the completion gate, which is wall-clock from sheet open (app.js:4018–4024). That is coherent with the gate's purpose, but if pause becomes visible, decide whether "paused" time should still count toward being allowed to finish.

---

### P1.2 — The safety footer contradicts the mission on 7 of 36 sheets

**Evidence:** E5.9. Every mission ends with *"GENERAL SAFE PLAY TIPS — Throw below face level · keep 1-3 m distance · adult supervision required."*

| # | Mission | The mission asks for | The footer says |
|---:|---|---|---|
| 7 | Rainbow Throws | "Every throw must arc HIGH — over both heads!" | Throw below face level |
| 11 | Sky Floater | "Throw it as high and SLOW as you can" — own safety: **"Always throw UP — never AT each other"** | Throw below face level |
| 31 | Cloud Chaser | "Throw the ball as HIGH as you can into the sky!" | Throw below face level |
| 35 | Sky High Jump | "Thrower aims JUST above your normal reach… Then JUMP and catch in the air!" | Throw below face level |
| 32 | Home Base | Parent Tip: "Set bases 8-10 big steps apart for a real challenge!" | keep 1-3 m distance |
| 33 | How Far Can You Throw? | "BOTH step back 2 big steps… Beat your previous distance record!" | keep 1-3 m distance |
| 36 | Marathon Rally | "After every 5 clean catches, BOTH step back one big step" | keep 1-3 m distance |

**Why it matters:** CDC's preschool guidance is explicit that caregivers should be told what to *do*, not only what not to do. A blanket rule that the activity itself requires breaking teaches parents to discount the safety text everywhere — including the 29 sheets where it is correct and useful. Mission 11 prints both instructions within a few lines of each other.

**The product already contains the right pattern.** Mission 7 carries *"How high, how far. Keep the arc no higher than the thrower can reach with one arm up."* Mission 11 carries *"A grown-up checks there is nothing overhead first."* These are concrete, task-scoped and behaviorally correct.

**Acceptance criteria:**
- No mission sheet renders a general rule that its own instructions require the player to break.
- The 7 missions above each state their own height or distance ceiling in the primary safety band, and the conflicting general clause is scoped out or replaced on those sheets.
- The remaining 29 sheets keep the general footer unchanged.
- A regression check asserts this: for every mission, no general safety clause may contradict that mission's steps, win condition, Parent Tip or task safety line.

---

## P2

### P2.1 — Welcome panel: first-paint fold with no affordance

**Evidence:** E2.1–E2.4.

| Viewport | Hidden below fold | "Any challenge" card visible | Mission-count line |
|---|---:|---:|---:|
| 320×568 | 44 px | 100 % | 0 % |
| 390×844 | 74 px | 75 % | 0 % |
| 430×932 | 0 px | 100 % | 100 % |
| 568×320 | 134 px | **0 %** | 0 % |
| 844×390 | 99 px | 39 % | 0 % |

At 568×320 an entire level option is invisible with no cue that it exists. At 390×844 — the most common US iPhone viewport — the third card is truncated flush against the CTA, which reads as a rendering fault rather than a scroll boundary. `.welcomeScroll` has no fade, mask, shadow or chevron.

**Acceptance criteria:** at every tested viewport, either all three level cards are ≥90 % visible at first paint, or a visible scroll affordance is present. No content terminates flush against the footer edge. `check-onboarding-occlusion` must still pass 12/12 — this is additive, and must not reintroduce a sticky CTA.

### P2.2 — Extend the good safety block past 4 missions

**Evidence:** E5.8. *Take it gently / Start easier / How high, how far / Grown-up first / When to stop* exists on missions 7, 11, 31 and 36 only. It is absent from **35 (Sky High Jump)** — the one mission asking a 6-year-old to jump and catch in the air — and from **34 (Chase the Ball!)** and **20 (Crab Walk Relay)**, which involve running.

**Acceptance criterion:** every mission whose risk profile involves height, growing distance or running carries the block. Minimum set: 35, 34, 20, 9, 10.

### P2.3 — Play tab primary CTA below the fold at 320×568

**Evidence:** E2.5. 0 of 3 Play-tab actions land fully inside the first viewport at 320×568; the mission card is cut at the metadata row and "Start Mission" needs a scroll.

**Acceptance criterion:** the primary Start action is fully visible and hit-testable without scrolling at 320×568.

### P2.4 — Field research

No real family, child or caregiver has been tested. Required before any field claim.

**Acceptance criterion:** 5–8 US caregiver/child pairs; ages 3–5, 6–8 and 8+; at least one small indoor space; at least one multi-child household; at least one child with a motor or attention difference. Results folded back into the persona and safety scores.

### P2.5 — Real-device and assistive-technology evidence

**Acceptance criterion:** iOS Safari and Android Chrome on real hardware; VoiceOver and TalkBack passes over onboarding, a mission sheet, the running state and completion; OS-level font scaling; the real install prompt. Today all of these are `NOT_TESTED`.

### P2.6 — Verify the 3D Hub on real device GPU hardware

**Evidence:** E7.8, E7.8c. The hub renders a real WebGL canvas and exits cleanly under software WebGL, and all six failure modes pass (`check-hub-fallback` 6/6): no WebGL, hub module aborted, three.js aborted, offline, reduced motion, orientation change. What remains untested is real GPU hardware.

**Acceptance criterion:** hub entry, gate walk, mission open, completion and return verified on real iOS and Android hardware, with an acceptable frame rate on a low-end device.

---

## P3

### P3.1 — One unnamed anchor in Grown-ups
An `<a>` in the Grown-ups tab has no accessible name. **Acceptance criterion:** every link has an accessible name; `check-a11y-controls` still passes.

### P3.2 — Undo target height
The Undo control measures 68×40. That clears the WCAG 2.2 AA 24 px floor but sits just under the 44 px commonly applied on touch. **Acceptance criterion:** ≥44 px tall without disturbing the Undo/Next layout (`check-undo-next-layout` must stay 5/5).

### P3.3 — Illustration load timing at 320 px
**Evidence:** E8. Illustrations rendered on 36/36 sheets with no console errors, but lazy-load timing under network throttling was not instrumented. **Acceptance criterion:** measure first-paint timing for mission illustrations on a throttled 3G profile at 320 px; no layout shift on arrival.

---

## Explicitly not filed

- **Onboarding occlusion.** Re-measured at 5 viewports with `elementFromPoint` and against the scroll clip box: the CTA is `position: static` and a sibling of the scroller and cannot cover anything. The repository's own checker passes 12/12. The previously reported 8 948 px² / 2 442 px² figures are rect-vs-clip artifacts. See E1.
- **Undo defect.** Undo reverts `done`, `xp` and `streak` exactly inside the window and is inert outside it (E4.5, E4.6). No defect.
- **Duplicate timers on repeated Start.** Exactly one interval under four rapid activations (E4.2).
- **Daily Champion re-earning by switching profile or team.** Directly tested by the repo suite: team → solo → another team on one day yields exactly one star, and a second child sees the family's star without minting another (E7.5).
