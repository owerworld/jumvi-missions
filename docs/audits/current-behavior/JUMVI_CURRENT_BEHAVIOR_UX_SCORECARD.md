# JUMVI — Current Behavior UX Scorecard

**Audit date:** 2026-08-25 / 26 (UTC)
**Scope:** English main route only. The TR/Turkish route (`/tr/`) was not opened, scored or modified.
**Audited build:** `fe4ffe6` (`claude/new-session-d884by` == `origin/main`)
**Live origin:** https://qr.jumvi.co/
**Method:** heuristic expert audit against live-identical bytes. **This is not a field study.** No real US family, child or caregiver was interviewed or observed. No moderated usability test was run.

---

## 1. Executive summary

The current English route is a mature, coherent product. Every one of the 36 missions opens as a real sheet with three steps, a win condition, an equipment list, a phone-down cue, task-specific safety, a Parent Tip and a Kids Challenge. Completion, XP, streak and Undo are provably correct and reversible. Accessibility holds up under real measurement rather than attribute-spotting: every visible control is named, keyboard focus is visibly indicated on 14/14 tab stops, and there is no horizontal overflow at 195 px or at 200 % text.

**Weighted heuristic score: 8.57 / 10.**

Two headline results differ from the previous audit, and both were re-measured from scratch rather than inherited:

- **The P0 onboarding overlap does not exist.** It is a measurement artifact. The Start CTA is `position: static` and a **sibling** of the scroll region, so it cannot paint over anything at any scroll offset. The 8 948 px² and 2 442 px² "overlap" figures reproduce exactly — because a naive rect-vs-rect intersection cannot tell *covered* from *scrolled out of view*, and returns the same number either way. `elementFromPoint` at those coordinates answers `btnWelcomeStart` because nothing is painted there at all. **Verdict: PASS (previous P0 refuted).**
- **The P1 invisible Pause is real, and worse than reported.** In the running state `btnStartTimer` carries the text "Pause" and `aria-label="Pause timer"` at **0 px height**, is not in the tab order, and has no keyboard route. The only visible controls are Close and the gate button. Closing — the one exit the UI offers — calls `resetTimerUI()` and **discards the run**. There is therefore no pause path at all, not merely an undiscoverable one. **Verdict: FAIL (confirmed and escalated).**

A third finding is new and is the largest remaining behavioral risk: **on 7 of 36 missions the fixed safety footer contradicts the mission's own instruction.** Mission 11 (*Sky Floater*) is the clearest case — its own safety line reads "Always throw UP — never AT each other" and the footer immediately beneath it reads "Throw below face level".

> **Decision: READY WITH EXPLICIT PRODUCT DECISIONS.** The product is behaviorally strong and shippable. Two things need an explicit owner decision before this can be called finished: whether a caregiver may pause a running mission, and whether a blanket safety footer may contradict a mission's own instruction.

---

## 2. Live version, branch and deploy verification

| Check | Result | Evidence |
|---|---|---|
| Working branch | `claude/new-session-d884by` | `git rev-parse HEAD` = `fe4ffe6085551f…` |
| Branch vs `main` | **Identical commit** — no divergence | `git rev-parse origin/main` = same SHA |
| Live root | HTTP 200 via Cloudflare | `curl -D` |
| Security headers | CSP, `permissions-policy: camera=(), microphone=(), geolocation=()`, `nosniff`, `X-Frame-Options: DENY`, HSTS `max-age=63072000; preload`, `referrer-policy: strict-origin-when-cross-origin` | response headers |
| Live `index.html` vs repo HEAD | **Byte-identical** (sha256 `99688d9b9bfb6d98…`) | `sha256sum` both sides |
| All 44 assets the page loads | **44/44 byte-identical to production** | per-asset `sha256sum` sweep, `LIVE_MEASURED` |

This is a stronger deploy claim than a header inspection can make. The previous audit could only say "asset version strings look current". Here every byte the browser executes — `index.html`, `app.js`, `data.js`, `style.css`, `warm-toy.css`, `jumvi-hub-app.js`, every image and font — was fetched from `qr.jumvi.co` and hashed against the audited tree. They match. **Measurements in this report therefore describe production behavior exactly.**

**Why a local mirror was used.** Chromium cannot reach the network through this sandbox's egress proxy (`ERR_CONNECTION_RESET` for every host, `example.com` included); `curl` can. Rather than downgrade to screenshot-free testing, the audited tree was served on `127.0.0.1` and every asset proven identical to production, as above. Browser measurements are `LIVE_MEASURED` against those exact bytes; anything genuinely requiring the production origin (real Cloudflare edge behavior, the `/api/beacon` endpoint, real iOS Safari) is labelled `NOT_TESTED`.

---

## 3. Method, evidence labels and limitations

Clean browser context and empty `localStorage`/`sessionStorage` for every measurement. Where a test mutated state, the context was destroyed rather than reused.

Three rules were applied throughout, because the previous audit's headline finding failed all three:

1. **A rectangle intersection is not an occlusion.** Every geometry claim is confirmed with `elementFromPoint` at the disputed coordinates and, separately, against the scroll container's clip box.
2. **A rendered label is not a reachable control.** Every control claim is confirmed with computed geometry, hit-testing and real `Tab` traversal.
3. **A screenshot is corroboration, not proof.** Screenshots are attached to each finding but no finding rests on one.

| Label | Meaning |
|---|---|
| `LIVE_OBSERVED` | Observed through real browser/DOM interaction. |
| `LIVE_MEASURED` | Proven by DOM rectangle, computed style, hit test, storage or runtime state. |
| `SOURCE_VERIFIED` | Verified in the shipped JS/HTML/CSS/data. |
| `RESEARCH_SUPPORTED` | Supported by external research or an official guideline. |
| `INFERRED` | Reasonable UX reading, not directly proven by live behavior. |
| `NOT_TESTED` | Could not be verified in this environment. |

**Limitations — read these before quoting any score.**

- No real family, child or caregiver participated. Every persona score is a modelled expert judgement, not observed behavior.
- Real iOS Safari, real Android Chrome, VoiceOver, TalkBack, OS-level font scaling and the real device install prompt were **not** tested. Chromium at mobile viewports is not a device.
- The 3D Hub was verified with **software WebGL** (`--use-gl=swiftshader`), not a real GPU. Rendering, exit and all six fallback paths pass; real-device GPU behavior and frame rate remain `NOT_TESTED`. (A first pass without those flags reported a 0×0 canvas — that was this harness's missing WebGL plus a query that matched an offscreen helper canvas, not a product limitation. Corrected.)
- The `/api/beacon` endpoint returned 405 against the local mirror (static server, no POST route). Analytics transport is `NOT_TESTED`; analytics *schema* is covered by the repo's own suite.
- The repository's own QA battery was run and is cited where it corroborates a finding. It is the product's own test suite, so it is supporting evidence, not independent evidence.

---

## 4. Weighted scorecard

| Area | Score | Weight | Live evidence |
|---|---:|---:|---|
| First use and conversion | **8.4/10** | 15 % | No occlusion at any of 5 viewports (`elementFromPoint`, and the repo's own checker 12/12). Level preselected, one-tap start, "No app · No account · No ads" above the fold. Deduction: at 320×568 and in landscape, part of the level chooser and the mission-count line sit below the scroller fold on first paint with **no scroll affordance** — at 568×320 the third level card is **0 % visible**; at 320×568 the Play tab's own "Start Mission" CTA is below the fold too. |
| Mission discovery and selection | **8.8/10** | 15 % | 36 missions, 6 packs × 6, metadata on every card, Pick one for me, Mission Book, Up next. 8 of 13 Missions-tab actions land in the first viewport at 390×844. |
| Mission comprehension and child-led play | **9.1/10** | 16 % | 36/36 sheets opened live: 3 steps each, win condition, equipment, illustration, phone-down cue on 36/36, Kids Challenge on 36/36, Parent Tip on 36/36. Full role preflight (who throws / catches / calls / when to switch / where to stand / only-two fallback) on all 8 missions needing 3+ players. Role-neutral "grown-up" language throughout. |
| Safety and parent trust | **7.8/10** | 15 % | Mission-specific safety line and adult-nearby cue on 36/36. Deductions: the fixed footer contradicts the mission's own instruction on **7/36** missions; the extended *Take it gently / Grown-up first / When to stop* block exists on only **4/36** (7, 11, 31, 36) and is absent from *Sky High Jump* (35), a jumping mission for 6+. |
| Family, team and profile | **8.7/10** | 12 % | Family first viewport carries Pick a Mission and Add a player. Profile empty-name validation is real: `aria-invalid`, `aria-describedby=profileEditNameError`, `role="alert"`, visible "Please enter a name.", focus returned to the input. Deduction: real multi-child family dynamics unverified without field testing. |
| Accessibility and responsive | **8.5/10** | 12 % | Every visible control named across all 4 tabs (one bare anchor in Grown-ups). Visible focus on **14/14** tab stops (solid 3 px outline). No horizontal overflow at 320/390/430/568/844, at 195 px, or at 200 % text. 36 `prefers-reduced-motion` rule blocks. 7 live regions, all `polite`. Repo suite: a11y-controls, dialog-contract (12/13 surfaces), zoom-textresize all pass. Deduction: the running state exposes a control that exists, is named, and can be reached by neither pointer nor keyboard. |
| Persistence, update, reset and offline | **8.6/10** | 8 % | Offline: banner "Offline — missions still work. Island needs a connection." appears and missions still open. XP/streak/done persist and revert exactly on Undo. Reset uses a deliberate 1200 ms hold (`HOLD_MS = 1200`, app.js:6331). Deduction: update-path branches not exercised end to end here. |
| 3D Hub and optional extras | **8.8/10** | 7 % | Verified rendering: a real **390×844 WebGL canvas** draws the island, with zone progress ("Bullseye! · 0/6 complete"), menu, GO TO NEXT MISSION and the first-run welcome modal. Exit returns cleanly (`tab-hub3d` → `tab-today`), zero page errors. Repo `check-hub-fallback` **6/6**: no-WebGL refusal, hub-module abort, three.js abort, offline, reduced motion, orientation change. Core missions never depend on it. Remaining gap: real device GPU. |
| **Weighted total** | **8.57/10** | 100 % | Heuristic expert result on live-identical bytes. Not a field score. |

Strongest: **mission comprehension and child-led play (9.1)**. Weakest: **safety and parent trust (7.8)**, entirely because of the footer contradiction — the per-mission safety writing itself is good.

---

## 5. Persona scores

Modelled from the research below. **No real person was consulted.** See `JUMVI_CURRENT_PERSONA_SCORES.csv` for the persona × criterion matrix.

| Persona | Score | Binding constraint |
|---|---:|---|
| Busy caregiver | **4.5/5** | 45–90 s defaults and one-tap start fit a 5–10 minute window; at 320×568 the Start CTA needs a scroll. |
| Screen-to-play parent | **4.6/5** | "Let's play one short round", Quick round on 4 missions, no guilt language, explicit phone-down beat. |
| Cautious parent | **4.0/5** | Adult-nearby and per-mission safety are strong; the contradictory footer is exactly what this persona reads most carefully. |
| Child-led parent | **4.5/5** | Choose another, Pick one for me, flexible win conditions, non-punitive retry. |
| Multi-child family | **4.4/5** | Full role preflight on all 8 multiplayer missions, shared totals, "only two of you today" fallback. |
| Small / cluttered home | **4.3/5** | Indoor Compact pack, "Watch out for lamps and shelves", feet-planted variants; distance footer still assumes a fixed 1–3 m. |
| Rural / limited access | **4.4/5** | Offline core proven working, no account, printable Mission Book, no 3D dependency. |
| Child with attention / motor / learning differences | **4.0/5** | Three visual steps, optional audio, 36 reduced-motion rule blocks, easy variants — but the easy-variant block reaches only 4/36 missions. |
| Grandparent caregiver | **4.5/5** | Role-neutral "grown-up" language throughout, low jargon, large targets. |
| **Mean** | **4.38/5** | |

Lowest is the **cautious parent (4.03)** — driven entirely by the safety-footer contradiction, and the persona most sensitive to it. Highest is the **screen-to-play parent (4.6)**, which is also the persona the Pew evidence suggests is most common.

---

## 6. Four tabs and main flows

| Flow | Verdict | Evidence |
|---|---|---|
| Fresh QR → onboarding → level → Start | **PASS** | Level preselected ("Just starting"), Start opens a correctly-scoped mission sheet. |
| Narration → Skip & Play | **PASS** | Start enters narration ("Skip & Play"), second tap enters countdown then running. Timer does not start early. |
| Start pressed repeatedly | **PASS** | Four rapid activations: exactly one timer. Gate fell 67 s → 63 s across 4 s (single interval). Repo T11: "repeated pause/resume never stacks intervals". |
| Running → Pause → Resume | **FAIL** | Control exists, is correctly labelled, is **0 px tall**, is not in the tab order. See §8. |
| Finish before the gate | **PASS** | Toast "Play it first! You can finish in 66s.", sheet does not enter `isComplete`. Repo T14: no done/xp/streak/Undo mutation while the gate is closed. |
| Gate open → completion | **PASS** | Gate becomes "We Finished!"; completion awards `doneSize 0→1`, `xp 0→10`, `streak 0→1`, "XP is earned once per mission". |
| Completion → Undo | **PASS** | Undo (68×40) reverts `done 1→0`, `xp 10→0`, `streak 1→0`. Repo T22: Undo after the window expires changes nothing; T23: a second Undo tap is a no-op; T18: two clicks in one tick never award twice; T20: replaying a done mission farms no XP. |
| Completion → Next | **PASS** | Next Mission present on the completion screen; repo suite covers the pack-scoped hub variant. |
| Daily Champion | **PARTIAL** | Per-profile day-scoped keys observed (`jumvi_p1_daily_challenge_v1` = `{"iso":"2026-08-25","count":0,"claimed":false}`). Cross-profile/team re-earning delegated to the repo's `check-daily-star-scope`; not independently re-derived here. |
| Missions → risky mission | **PARTIAL** | Safety, roles, space and stop conditions are legible before Start — but see the footer contradiction, §8. |
| Family → profile / team | **PASS** | Profile validation proven (`aria-invalid`, `role="alert"`, visible message, focus returned). |
| Grown-ups → privacy / help / update / reset | **PASS** | Practical order: Kids & Settings → Mission Book PDF → Privacy & Safety → Help & Support → Check for Updates → Reset Progress → support e-mail. Product Care `data-topic` attributes intact (`ball_not_sticking`, `ball_hard_to_remove`, `strap_fit`, `cleaning_storage`, `damaged_missing`). Reset is a 1200 ms deliberate hold. |
| 3D Hub → mission → return | **PASS** | Real WebGL canvas renders the island; exit returns `tab-hub3d` → `tab-today`; 0 page errors. Repo `check-hub-fallback` 6/6 including the no-WebGL refusal path. |
| Offline / reload | **PASS** | Offline banner shows, missions still open. |

---

## 7. 36-mission matrix summary

Full data: `JUMVI_CURRENT_36_MISSION_BEHAVIOR_MATRIX.csv`.

**36/36 missions were opened as real sheets in the browser** (not schema-scanned). This is the distinction the brief asks to keep: the data contract *and* the rendered sheet were both checked, on all 36.

| Property | Result |
|---|---|
| Missions | 36 unique ids, 6 packs × 6 |
| Steps | 3 on 36/36 |
| Win condition | 36/36 |
| Equipment block | 36/36, no player/equipment mismatch |
| Task-specific safety line | 36/36 |
| Parent Tip | 36/36 |
| Kids Challenge | 36/36 |
| Phone-down cue | 36/36 |
| Adult-nearby cue | 36/36 |
| Illustration | 36/36 |
| Full role preflight | 8/8 missions needing 3+ players |
| Quick round | 4/36 (7, 11, 31, 36) |
| Extended easy-variant / stop-condition block | 4/36 (7, 11, 31, 36) |
| **Fixed footer contradicts the mission's own instruction** | **7/36** |
| Mean behavior-fit score | 8.54/10 |

**The 7 contradictions** — all `LIVE_OBSERVED` + `SOURCE_VERIFIED`:

| # | Mission | Mission asks for | Footer says |
|---:|---|---|---|
| 7 | Rainbow Throws | "Every throw must arc HIGH — over both heads!" | Throw below face level |
| 11 | Sky Floater | "Throw it as high and SLOW as you can" — own safety: *"Always throw UP — never AT each other"* | Throw below face level |
| 31 | Cloud Chaser | "Throw the ball as HIGH as you can into the sky!" | Throw below face level |
| 35 | Sky High Jump | "Thrower aims JUST above your normal reach… Then JUMP and catch in the air!" | Throw below face level |
| 32 | Home Base | Parent Tip: "Set bases 8-10 big steps apart for a real challenge!" | keep 1-3 m distance |
| 33 | How Far Can You Throw? | "BOTH step back 2 big steps… Beat your previous distance record!" | keep 1-3 m distance |
| 36 | Marathon Rally | "After every 5 clean catches, BOTH step back one big step" | keep 1-3 m distance |

Bounded ladders that stay inside the band were checked and **excluded**: mission 9 (*Step-Back Challenge*) tops out at 3 big-kid steps (~1.5 m) and is not a contradiction.

---

## 8. Critical findings

### FINDING 1 — Previous P0 refuted: onboarding has no occlusion · `LIVE_MEASURED`

The Start CTA computes to `position: static`, is a **sibling** of `#welcomeScroll`, and carries `z-index: auto`. A static footer that is a sibling of the scroller cannot be painted over by it, at any scroll offset.

The prior figures reproduce exactly — 8 948 px² at 320×568, 2 442 px² at 390×844 — and are artifacts. At 390×844 the helper line's *bounding rect* is 823.7–841.7 while the scroller's clip box ends at 780: the element is **74 px below its own fold**, unrendered. `getBoundingClientRect()` reports the full box regardless; intersecting it with the footer yields a positive number for content that is not drawn.

Hit-testing settles it. At 430×932 (unclipped) `elementFromPoint` inside the helper returns `welcomeMissionCount`. At 390×844 and 320×568 it returns `btnWelcomeStart` **because nothing is painted at those coordinates** — the CTA is simply the topmost thing there. Scrolling the region to its end drops the intersection to **0 at every viewport** while the CTA does not move.

Corroboration: the repository ships `tools/check-onboarding-occlusion.mjs`, which passes **12/12** and whose header documents the same trap — *"getBoundingClientRect() reports an element's full box even when a scroll container clips most of it, so a naive rect-vs-rect test flags content that is scrolled out of sight and never painted."* The fix landed before this audit; the metric used to re-test it could not detect that it had.

**Verdict: PASS.** No occlusion at 320×568, 390×844, 430×932, 568×320 or 844×390.

### FINDING 2 — Real issue in the same area: first-paint fold, no affordance · `LIVE_MEASURED` · **P2 (P1 in landscape)**

What *is* true is smaller and different. At first paint, content below the scroller's fold:

| Viewport | Hidden below fold | Third level card visible | Mission-count line |
|---|---:|---:|---:|
| 320×568 | 44 px | 100 % | 0 % |
| 390×844 | 74 px | **75 %** | 0 % |
| 430×932 | 0 px | 100 % | 100 % |
| 568×320 | 134 px | **0 %** | 0 % |
| 844×390 | 99 px | **39 %** | 0 % |

`.welcomeScroll` has no fade, shadow or chevron. At **568×320 a whole level option is invisible with no cue that it exists** — a caregiver in landscape can reasonably conclude JUMVI offers two levels. At 390×844 the third card is visually truncated flush against the CTA, which reads as a rendering fault even though it is a scroll boundary.

Same class of issue on the Play tab: at 320×568 the primary "Start Mission" CTA is entirely below the fold (0 of 3 actions in the first viewport).

**Acceptance criterion:** at every tested viewport, either all three level cards are ≥90 % visible at first paint, or a visible scroll affordance is present. No content may terminate flush against the footer edge.

### FINDING 3 — P1 confirmed and escalated: no pause path exists · `LIVE_MEASURED` · `SOURCE_VERIFIED`

In the running state (`#sheet.isPlaying`, `#sheetBody { display: none }`):

- `btnStartTimer` — `innerText` "Pause", `aria-label` "Pause timer" — measures **0 px** and is **not visible**.
- Real `Tab` traversal reaches only `btnClose` and `btnToggleDone`. **The pause control is unreachable by pointer and by keyboard.**
- Activating it programmatically works correctly: label → "Resume", `aria-label` → "Resume timer". Repo T09/T10/T11 prove the interval is cleared, the remaining time freezes, and repeated pause/resume never stacks intervals. **The logic is sound; only the affordance is missing.**
- The one exit the UI offers is Close — and `closeMission()` calls `resetTimerUI()` (app.js:5303), which sets `timerState = "idle"`, `timerTotal = 0`, `timerLeft = 0`. Confirmed live: closing a run at 67 s remaining and reopening the mission shows "Start", `timerDisplay` "60s", timer UI hidden. **The elapsed run is discarded.** Escape does the same thing, with no confirmation.

So the accurate statement is not "pause is hidden" but **"a caregiver who must stop mid-mission loses the run."** For *Marathon Rally* that is 180 seconds of a family activity. The Mott poll finding that 48 % of parents stand beside or hold the hand of a child attempting a new physical challenge describes exactly the caregiver most likely to need to break off — to check a sibling, answer a door, or intervene on safety.

One nuance worth recording: pausing the timer does **not** pause the completion gate, which is wall-clock from sheet open (`Date.now() - missionOpenedAt`, app.js:4022). That is consistent with the gate's purpose as a floor on elapsed time, but it means a pause would not delay when finishing becomes available.

**This needs a product decision, not just a fix.** The running panel is deliberately minimal — "Put the phone down — Leo will let you know" — and that intent is good and research-aligned. Either a compact Pause is added without breaking phone-down, or the decision to have none is documented *and* Close stops silently destroying the run.

### FINDING 4 — New: the safety footer contradicts 7 missions · `LIVE_OBSERVED` · **P1**

Every mission ends with the identical block: *"GENERAL SAFE PLAY TIPS — Throw below face level · keep 1-3 m distance · adult supervision required."* On 7 of 36 missions this directly contradicts the instruction printed above it (table in §7).

*Sky Floater* is the sharpest: its own safety line says "Always throw UP — never AT each other", and the general footer beneath it says "Throw below face level". A parent reading carefully — the cautious persona, scoring lowest at 4.03 — gets two opposite instructions on one screen and no way to tell which governs.

This matters more than generic imprecision. CDC's preschool guidance is explicit that caregivers should be told **what to do**, not only what not to do; a rule that the activity itself violates trains parents to discount the safety text on every screen, including the 29 where it is correct.

**Acceptance criterion:** no mission sheet renders a general rule that its own instructions require the player to break. Missions that need a high throw or a growing distance state their own ceiling (several already do — mission 7's "no higher than the thrower can reach with one arm up" is exactly right) and the general line is scoped or suppressed accordingly.

### FINDING 5 — Extended safety scaffolding reaches only 4 of 36 · `LIVE_OBSERVED` · **P2**

The *Take it gently / Start easier / How high, how far / Grown-up first / When to stop* block — clearly the product's best safety pattern — exists on missions 7, 11, 31 and 36 only. It is **absent from *Sky High Jump* (35)**, the one mission that asks a 6-year-old to jump and catch in the air, and from *Chase the Ball!* (34) and *Crab Walk Relay* (20), which involve running.

---

## 9. Comparison with US family/child behavior research

Each row is a design hypothesis, not a verified claim about JUMVI users.

| Evidence | JUMVI implication | Current state |
|---|---|---|
| CDC: children 3–5 should be active throughout the day; caregivers should encourage active play [1] | Do not sell one mission as a health quota | **Met.** 45–90 s defaults, no daily-target framing. |
| CDC preschool guidance: give age-appropriate equipment, let the child choose, offer limited simple choices, explain what to do rather than only what not to do [2] | Level choice, Pick another, easy variants, concrete safety | **Mostly met.** Three levels, Choose another, per-mission safety. Weakened by Finding 4 — 7 missions say "don't" in a way the task itself contradicts. |
| Pew 2025: 86 % of parents call reasonable screen time a daily priority; only 19 % always keep to their own rules; 42 % think they could do better [3] | Low-friction, non-judgemental screen-to-play transition | **Met.** No guilt language, Quick round, explicit phone-down beat, no account. |
| Mott 2025: 88 % report running/jumping/climbing on a typical day; 48 % stand beside or hold the child's hand for a new physical challenge [4] | Adult-nearby and safe limits must be first-class, without blocking child-led play | **Partly met.** Adult-nearby on 36/36; but the caregiver standing beside the child is exactly who cannot pause (Finding 3). |
| Frontiers 2025 meta-synthesis: shared activity works when it is developmentally appropriate, adaptable to routine and sensitive to time/space/resource barriers [5] | Score routine fit, cognitive load, role clarity, non-punitive retry | **Met.** Offline core proven, no account, printable book, full role preflight, Undo. |
| Household-chaos and rural/low-income barrier literature [6] | Do not assume a quiet, large, empty home; avoid paternalistic framing | **Met.** Indoor Compact pack, "Watch out for lamps and shelves", feet-planted variants, no deficit language. |
| WCAG 2.2: visible focus, target size, focus not obscured, keyboard access, reflow, text resize [7] | Measure, don't assert | **Largely met.** 14/14 visible focus, no overflow at 195 px or 200 % text, all controls named. Exception: a named control reachable by neither pointer nor keyboard (Finding 3). |

---

## 10. Accessibility, safety, offline and 3D

| Check | Result | Evidence |
|---|---|---|
| Accessible names | Pass — all visible controls named across 4 tabs; one bare `<a>` in Grown-ups | own sweep + repo `check-a11y-controls` |
| Input labels / validation | Pass — `label[for]`, `aria-invalid`, `aria-describedby`, `role="alert"`, focus returned | `LIVE_MEASURED` |
| Dialog role / modal / focus | Pass — welcome overlay `role="dialog" aria-modal="true"`; repo `check-dialog-contract` 12/13 surfaces (13th is documented dead markup) | |
| Visible keyboard focus | Pass — **14/14** tab stops, solid 3 px outline | real `Tab` traversal |
| Target size | Pass — 0 controls under 24×24 on Play/Missions/Family; the two sub-24 items in Grown-ups are inline text links (WCAG 2.2 inline exception). Undo is 68×40 — above the 24 px AA floor, below 44 px | `LIVE_MEASURED` |
| Reflow / 200 % text | Pass — 0 horizontal overflow at 200 % root font and at 195 px | `LIVE_MEASURED` |
| Reduced motion | Pass — 36 `prefers-reduced-motion` rule blocks | `SOURCE_VERIFIED` |
| Live regions | Pass — 7 regions, all `polite`, no spam observed | `LIVE_OBSERVED` |
| Screen reader | **NOT TESTED** — no VoiceOver or TalkBack in this environment | |
| Safety copy | Mixed — per-mission excellent, general footer contradicts 7 missions | Finding 4 |
| Offline | Pass — banner shown, missions still open | `LIVE_OBSERVED` |
| 3D Hub | Pass — real 390×844 WebGL canvas, clean exit, 0 page errors; repo fallback suite 6/6. Real-device GPU still `NOT_TESTED` | `LIVE_OBSERVED` |

**Methodology note, recorded deliberately.** A first pass using programmatic `element.focus()` reported *no* focus indicator. That was wrong: `:focus-visible` does not match programmatic focus. Re-tested with real `Tab` presses, 14/14 stops show a 3 px outline. This is the same class of error as the P0 rect artifact, caught on the other side.

---

## 11. Backlog

| Priority | Item | Acceptance criterion |
|---|---|---|
| **P1** | Decide and implement pause | Either a compact, keyboard-reachable Pause/Resume in the running panel that does not require holding the phone; **or** a documented decision to have none — in which case Close must stop silently destroying the run (confirm, or preserve and offer resume). Elapsed/gate/completion stay correct; no duplicate timers. |
| **P1** | Stop the footer contradicting the mission | No sheet renders a general rule its own instructions require breaking. Missions 7, 11, 31, 35 (height) and 32, 33, 36 (distance) carry their own ceiling; the general line is scoped or suppressed there. |
| **P2** | First-paint fold in the welcome panel | All three level cards ≥90 % visible at first paint at every tested viewport, or a visible scroll affordance. Nothing terminates flush against the footer edge. Currently 0 % at 568×320. |
| **P2** | Extend the safety block past 4 missions | *Take it gently / Grown-up first / When to stop* on every mission whose risk profile is height, distance or running — at minimum 35, 34, 20, 9, 10. |
| **P2** | Play-tab CTA at 320×568 | Primary "Start Mission" reachable without scrolling on the smallest supported viewport. |
| **P3** | Bare anchor in Grown-ups | Give the unnamed `<a>` an accessible name. |
| **P3** | Undo target height | 68×40 → 44 px tall to clear the iOS/AAA guidance it currently sits just under. |
| **P2** | Field research | 5–8 US caregiver/child pairs; ages 3–5, 6–8, 8+; small indoor space; multi-child; different motor/attention needs. Required before any field claim. |

---

## 12. What is still missing for a 10/10

1. Resolve Finding 3 (pause) and Finding 4 (footer contradiction) — the only two items that need an owner's decision rather than a patch.
2. Close the fold and CTA-reachability gaps at 320×568 and 568×320.
3. Extend the safety block to every height/distance/running mission.
4. Real-device evidence: iOS Safari, Android Chrome, VoiceOver, TalkBack, OS font scaling, real install prompt.
5. Real-device GPU verification of the 3D Hub (software WebGL and all six fallback paths already pass).
6. Field testing with 5–8 US caregiver/child pairs, folded back into the persona and safety scores.

Items 4–6 are the ones that make the difference between a heuristic score and a field score. **No amount of further heuristic testing can substitute for them.**

---

## 13. Release decision

**READY WITH EXPLICIT PRODUCT DECISIONS — 8.57/10 (heuristic).**

The previously-blocking P0 does not exist. What blocks a clean result now is not a rendering fault but two questions only the product owner can answer: *may a caregiver pause a running mission?* and *may a general safety rule contradict the mission printed above it?* Neither is a bug report; both are decisions with a defensible answer either way, and both must be recorded.

`FIELD-VALIDATED READY` is **not** available: no real family, child or caregiver was tested. Even were every heuristic item closed, the correct label would be `RELEASE READY — HEURISTIC`, never a field 10/10.

---

## 14. Required summary table

| Question | Answer |
|---|---|
| English live route opened? | **PASS** — HTTP 200; all 44 assets byte-identical to the audited build |
| 4 tabs tested on real mobile viewports? | **PASS** — Play, Missions, Family, Grown-ups × 5 viewports, screenshots + DOM measurements |
| 36-mission data contract complete? | **PASS** — 36 ids, 6×6 packs, 3 steps, all required fields, 0 equipment mismatches |
| 36 missions opened as real sheets? | **PASS** — 36/36 opened live, content extracted per sheet |
| P0 onboarding overlap present? | **PASS (no overlap)** — previous P0 refuted as a rect-intersection artifact; repo checker 12/12 |
| Pause/Resume visible to the user? | **FAIL** — 0 px, not in tab order; Close discards the run |
| Completion/Undo correct? | **PASS** — XP/streak/done award and revert exactly; expired Undo is inert; no double-award |
| Family/Profile/Team isolation correct? | **PASS** — validation contract proven live; per-profile day-scoped storage keys observed |
| Safety appropriate to behavior? | **7.8/10** — 36/36 mission-specific safety and adult-nearby cues, but the fixed footer contradicts 7/36 missions |
| Accessibility passing on real evidence? | **PASS with one exception** — names, 14/14 visible focus, targets, reflow, 200 % text all measured; a named control is reachable by neither pointer nor keyboard. Screen reader **NOT TESTED** |
| US behavior alignment | **8.5/10** — strong on screen-to-play, routine fit, roles and offline; limited by the pause gap and the contradictory footer. Bounded: hypotheses from national surveys, not observation of JUMVI users |
| Weighted UX score | **8.57/10** |
| Release decision | **READY WITH EXPLICIT PRODUCT DECISIONS** |
| Remaining for 10/10 | Pause decision; footer contradiction; 320×568 and 568×320 fold + CTA; safety block on all height/distance/running missions; real-device + screen-reader evidence; real 3D verification; 5–8 pair field study |

---

## 15. References

[1] CDC — Child Activity: An Overview. https://www.cdc.gov/physical-activity-basics/guidelines/children.html
[2] CDC — Positive Parenting Tips: Preschoolers (3–5 years). https://www.cdc.gov/child-development/positive-parenting-tips/preschooler-3-5-years.html
[3] Pew Research Center — How Parents Approach Their Kids' Screen Time. https://www.pewresearch.org/internet/2025/10/08/how-parents-approach-their-kids-screen-time/
[4] C.S. Mott Children's Hospital National Poll — Parent Perspectives on Play. https://mottpoll.org/reports/parent-perspectives-play
[5] Frontiers in Public Health — Challenges and facilitators to parent–child shared physical activity. https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2025.1658179/full
[6] MDPI Children — Facilitators and Barriers to Physical Activity for Families of Rural Preschoolers. https://www.mdpi.com/2227-9067/11/3/362
[7] W3C — Web Content Accessibility Guidelines (WCAG) 2.2. https://www.w3.org/TR/WCAG22/
[8] JUMVI — live English main route. https://qr.jumvi.co/
