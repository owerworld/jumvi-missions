# JUMVI — Current Behavior Evidence Log

Every claim in `JUMVI_CURRENT_BEHAVIOR_UX_SCORECARD.md` traces to a row here.
Build: `fe4ffe6`. Date: 2026-08-25 / 26 UTC. Scope: English main route only.

---

## E0 — Environment and why measurements are valid for production

| # | Claim | Label | Evidence |
|---|---|---|---|
| E0.1 | Working branch and `origin/main` are the same commit | `SOURCE_VERIFIED` | `git rev-parse HEAD` = `git rev-parse origin/main` = `fe4ffe6085551fa28e10b4554eadf9b0101f3d72` |
| E0.2 | Live root returns 200 through Cloudflare | `LIVE_MEASURED` | `curl -D`: `HTTP/2 200`, `server: cloudflare`, `cf-ray: a30e5afdbe1d3992-IAD` |
| E0.3 | Child-safety-relevant headers present | `LIVE_MEASURED` | `permissions-policy: camera=(), microphone=(), geolocation=()`; CSP `default-src 'self'`; `x-content-type-options: nosniff`; `x-frame-options: DENY`; HSTS `max-age=63072000; includeSubDomains; preload`; `referrer-policy: strict-origin-when-cross-origin` |
| E0.4 | Live `index.html` is byte-identical to the audited tree | `LIVE_MEASURED` | sha256 both sides = `99688d9b9bfb6d98…`; `content-length: 96150` matches local file size |
| E0.5 | **All 44 same-origin assets the page loads are byte-identical to production** | `LIVE_MEASURED` | Asset list captured from the browser's own request log, then each path fetched from `https://qr.jumvi.co` and hashed against the local mirror: **MATCH=44, DIFF=0** |
| E0.6 | Chromium cannot reach the network through this sandbox's proxy | `LIVE_MEASURED` | `net::ERR_CONNECTION_RESET` for `https://qr.jumvi.co/` **and** `https://example.com/` via `proxy:{server}` and via `--proxy-server`; `curl` to the same hosts returns 200. Proxy status endpoint reports `recentRelayFailures: []`. Hence the byte-identical local mirror at `127.0.0.1:8899`. |
| E0.7 | `/api/beacon` not exercised | `NOT_TESTED` | 405 from the static mirror (no POST route). Analytics transport unverified; schema covered by the repo's own suite. |

---

## E1 — Onboarding geometry (previous P0)

| # | Claim | Label | Evidence |
|---|---|---|---|
| E1.1 | The Start CTA cannot paint over scroller content | `LIVE_MEASURED` + `SOURCE_VERIFIED` | Computed `position: static`, `z-index: auto`, `cta.parentElement === scroller.parentElement` → **sibling**. CSS: `#welcomeOverlay .welcomeStart{ position:static; flex:0 0 auto; }` (warm-toy.css) |
| E1.2 | The prior "overlap" numbers reproduce exactly and are artifacts | `LIVE_MEASURED` | Naive rect intersection: **8 948.4 px² at 320×568**, **2 442 px² at 390×844**, 0 at 430×932 — identical to the previous report. |
| E1.3 | Those coordinates are clipped, not covered | `LIVE_MEASURED` | 390×844: helper rect `823.7–841.7`, scroller clip box ends at `780` → element is 74 px below its own fold, unpainted. 320×568: scroller bottom `504.0`, CTA top `504.0` — abutting, not overlapping. |
| E1.4 | Hit-testing confirms nothing is covered | `LIVE_MEASURED` | 430×932 (unclipped): `elementFromPoint` inside the helper → `welcomeMissionCount`. 390×844 / 320×568: → `btnWelcomeStart`, because nothing is painted there. CTA hit test at centre and both corners → `SELF` at all 5 viewports. |
| E1.5 | Scrolling the region to its end drops the intersection to 0 everywhere | `LIVE_MEASURED` | Stage C at all 5 viewports: `overlap = 0`, helper visible, CTA rect unchanged. |
| E1.6 | The repository's own occlusion checker passes 12/12 | `SOURCE_VERIFIED` | `tools/check-onboarding-occlusion.mjs`: 12 ✅, "Nothing above the CTA is covered, at any tested size or orientation." Its header documents the same rect-vs-clip trap. |
| E1.7 | No horizontal overflow at any viewport | `LIVE_MEASURED` | `scrollWidth - innerWidth = 0` at 320×568, 390×844, 430×932, 568×320, 844×390 |
| E1.8 | Zero console errors during onboarding at all 5 viewports | `LIVE_MEASURED` | Only the expected `/api/beacon` 405s from the static mirror |

**Verdict: PASS — previous P0 refuted.**

---

## E2 — First-paint fold (the real, smaller issue)

| # | Claim | Label | Evidence |
|---|---|---|---|
| E2.1 | Content sits below the scroller fold at first paint | `LIVE_MEASURED` | Hidden below fold: 320×568 = 44 px · 390×844 = 74 px · 430×932 = 0 px · 568×320 = 134 px · 844×390 = 99 px |
| E2.2 | The third level card is truncated or invisible | `LIVE_MEASURED` | "Any challenge" visible: 100 % @320×568 · **75 % @390×844** · 100 % @430×932 · **0 % @568×320** · **39 % @844×390** |
| E2.3 | The mission-count line is unseen on first paint on 4 of 5 viewports | `LIVE_MEASURED` | `welcomeMissionCount` 0 % visible at 320×568, 390×844, 568×320, 844×390; 100 % at 430×932. Reachable by scrolling at all. |
| E2.4 | No scroll affordance exists | `SOURCE_VERIFIED` | `#welcomeOverlay .welcomeScroll` declares `overflow-y:auto` with no fade, mask, shadow or chevron |
| E2.5 | Play tab primary CTA below the fold at 320×568 | `LIVE_MEASURED` + screenshot | 0 of 3 Play-tab actions fully inside the first viewport; `shots/tab_320x568_Play.png` shows the mission card cut at the metadata row |

---

## E3 — Running state and Pause (previous P1)

| # | Claim | Label | Evidence |
|---|---|---|---|
| E3.1 | Running state hides the sheet body | `LIVE_MEASURED` | `#sheet` class `sheet pack--focus-control isPlaying`; `#sheetBody` computed `display: none`. CSS `#sheet.isPlaying #sheetBody{ display:none !important; }` (warm-toy.css:4188) |
| E3.2 | The Pause control exists, is named, and is invisible | `LIVE_MEASURED` | `btnStartTimer`: `innerText` "Pause", `aria-label` "Pause timer", `disabled: false`, **height 0**, `visible: false` |
| E3.3 | Only two controls are visible while running | `LIVE_MEASURED` | `btnClose` "Close mission" 46×44 and `btnToggleDone` "Play for about 64s more" 336×56 |
| E3.4 | **Pause is not keyboard reachable** | `LIVE_MEASURED` | 12 real `Tab` presses in the running state visit only `btnClose` and `btnToggleDone`. `btnStartTimer` never receives focus (it is inside a `display:none` subtree). |
| E3.5 | The underlying pause logic is correct | `LIVE_MEASURED` + `SOURCE_VERIFIED` | Programmatic activation: label "Pause"→"Resume", `aria-label` "Pause timer"→"Resume timer", and back. Repo `check-mission-play-state`: **T09** pause clears the interval and freezes remaining (44→44 over 1.6 s); **T10** resume continues from remaining with exactly one interval; **T11** repeated pause/resume never stacks intervals |
| E3.6 | **Close discards the run** | `LIVE_MEASURED` + `SOURCE_VERIFIED` | `closeMission()` calls `resetTimerUI()` (app.js:5303), which sets `timerState="idle"; timerTotal=0; timerLeft=0; timerEndAt=0` (app.js:4108–4124). Live: closed at "Play for about 67s more", reopened the same mission → button "Start", `timerDisplay` "60s", `timerUI` `display:none` |
| E3.7 | Escape also closes and discards, with no confirmation | `LIVE_MEASURED` | Escape during a run → `body.modalOpen` false |
| E3.8 | Pausing does not pause the completion gate | `LIVE_MEASURED` + `SOURCE_VERIFIED` | Gate text fell 67 s → 63 s over 4 s while `timerState === "paused"`. `missionGateRemainingMs()` = `missionGateMsFor(id) - (Date.now() - missionOpenedAt)` (app.js:4018–4024) — wall clock from sheet open, independent of the timer. Repo **T15**: gate total = `min(max(time,45),75)`. |

**Verdict: FAIL — confirmed and escalated. No pause path exists for the user.**

---

## E4 — Timer, gate, completion, Undo

| # | Claim | Label | Evidence |
|---|---|---|---|
| E4.1 | Narration precedes the timer; Skip & Play starts it | `LIVE_OBSERVED` | First tap → "Skip & Play" (`aria-label` "Skip narration and start timer"); second tap → countdown → `isPlaying` |
| E4.2 | Repeated Start does not create duplicate timers | `LIVE_MEASURED` | 4 rapid activations, gate fell 67 s → 63 s across 4 s (exactly one interval) |
| E4.3 | The gate blocks early finish and explains why | `LIVE_OBSERVED` | Toast "Play it first! You can finish in 66s."; sheet does not enter `isComplete`. Repo **T14**: no done/xp/streak/Undo mutation while the gate is closed |
| E4.4 | Completion awards exactly once | `LIVE_MEASURED` | `doneSize 0→1`, `doneIds [1]`, `xp 0→10`, `streak 0→1`, `undoBarVisible true`; screen states "XP is earned once per mission". Repo **T18** two clicks in one tick never award twice; **T19** autoDone at Time's Up yields exactly one completion; **T20** replaying a done mission farms no XP |
| E4.5 | Undo fully reverts within the window | `LIVE_MEASURED` | Undo (68×40, visible) → `doneSize 1→0`, `xp 10→0`, `streak 1→0` |
| E4.6 | Undo is inert after the window | `SOURCE_VERIFIED` (repo suite) | **T22** Undo after expiry changes nothing (`barVisibleAtExpiry=false`, done 1→1, xp 10→10); **T23** a second Undo tap is a no-op |
| E4.7 | Undo survives sheet close inside the window | `SOURCE_VERIFIED` | `closeMission()` re-parents `#undoBar` to `document.body` when `_undoOffer` is live (app.js) |
| E4.8 | Undo/Next layout holds across viewports | `SOURCE_VERIFIED` (repo suite) | `check-undo-next-layout`: 5 pass, 0 fail, of 5 viewports |

---

## E5 — The 36 missions

| # | Claim | Label | Evidence |
|---|---|---|---|
| E5.1 | **36/36 opened as real sheets in the browser** | `LIVE_OBSERVED` | Each id 1–36 opened via `openMission(id)`, disclosures expanded, rendered text extracted, sheet dismissed between missions. `opened: 36/36` |
| E5.2 | 3 steps on 36/36 | `LIVE_MEASURED` | `#mSteps li` count = 3 for all 36 |
| E5.3 | Win condition, equipment, Parent Tip, Kids Challenge, phone-down, adult-nearby, illustration on 36/36 | `LIVE_OBSERVED` | Per-sheet extraction; 0 missing on each field |
| E5.4 | Schema and packs intact | `SOURCE_VERIFIED` (repo suite) | `check-mission-schema`: "36/36 missions satisfy the schema"; 6 packs × 6 |
| E5.5 | Equipment bounded and data-driven, no mismatch | `SOURCE_VERIFIED` (repo suite) | `check-mission-equipment`: "All 36 missions have bounded, data-driven equipment requirements" |
| E5.6 | Role cards on every mission needing 3+ players | `SOURCE_VERIFIED` (repo suite) + `LIVE_OBSERVED` | `check-mission-sheet-matrix`: "missions needing 3+ players: 8 (2, 19, 20, 21, 22, 23, 24, 27) — with a role card rendered: 8"; 36/36 conform |
| E5.7 | Quick round on 4 missions | `LIVE_MEASURED` | Visible on 7 (45 s), 11 (45 s), 31 (45 s), 36 (60 s) |
| E5.8 | Extended safety block on only 4 missions | `LIVE_OBSERVED` | *Take it gently / Start easier / How high, how far / Grown-up first / When to stop* present on 7, 11, 31, 36 only |
| E5.9 | **The fixed footer contradicts the mission instruction on 7/36** | `LIVE_OBSERVED` | Height: 7 ("arc HIGH — over both heads"), 11 ("as high and SLOW as you can"; own safety "Always throw UP — never AT each other"), 31 ("as HIGH as you can into the sky"), 35 ("JUST above your normal reach… JUMP and catch in the air"). Distance: 32 (Parent Tip "Set bases 8-10 big steps apart"), 33 ("Beat your previous distance record!"), 36 ("BOTH step back one big step"). Footer on all 36: "Throw below face level · keep 1-3 m distance · adult supervision required." |
| E5.10 | Bounded ladders inside the band were excluded | `LIVE_OBSERVED` | Mission 9 tops out at 3 big-kid steps (~1.5 m) → not counted as a contradiction |
| E5.11 | Screenshots captured for the named high-risk missions | `LIVE_OBSERVED` | `sheet_07_Rainbow-Throws.png`, `sheet_24_2v2-Squad-Count.png`, `sheet_26_Tiny-Space.png`, `sheet_31_Cloud-Chaser.png`, `sheet_35_Sky-High-Jump.png`, `sheet_36_Marathon-Rally.png`, plus short (`sheet_01_Speed-Demon.png`) and standard two-player (`sheet_19_Round-Robin.png`) |

---

## E6 — Accessibility

| # | Claim | Label | Evidence |
|---|---|---|---|
| E6.1 | All visible controls named across 4 tabs | `LIVE_MEASURED` | Play 8, Missions 19, Family 48, Grown-ups 13 controls; 0 unnamed except one bare `<a>` in Grown-ups |
| E6.2 | Repo a11y suite passes | `SOURCE_VERIFIED` | `check-a11y-controls`: "Every visible control is named, every input labelled, ids unique, zoom available" |
| E6.3 | Visible keyboard focus on 14/14 tab stops | `LIVE_MEASURED` | Real `Tab` traversal: solid 3 px `rgb(11,74,120)` outline, `:focus-visible` matches on every stop |
| E6.4 | **Methodology correction** | `LIVE_MEASURED` | A first pass using programmatic `element.focus()` reported no indicator. `:focus-visible` does not match programmatic focus; the result was invalid and was replaced by real `Tab` traversal. |
| E6.5 | Target sizes | `LIVE_MEASURED` | 0 controls under 24×24 on Play/Missions/Family; the two sub-24 items in Grown-ups are inline text links (WCAG 2.2 inline exception). Undo 68×40 — above the 24 px AA floor, below 44 px |
| E6.6 | Dialog contract | `SOURCE_VERIFIED` + `LIVE_MEASURED` | Welcome overlay `role="dialog" aria-modal="true" aria-label="Welcome to JUMVI Missions"`; repo `check-dialog-contract`: 12 pass, 0 fail, of 13 surfaces (13th is documented dead markup) |
| E6.7 | Reflow and text resize | `LIVE_MEASURED` | `scrollWidth - innerWidth = 0` at 200 % root font size (390×844) and at a 195 px viewport; nav still visible; body text still rendered. Repo `check-zoom-textresize`: Z06 "200% text on today: every primary control is still hit-testable", hard-clipped = 0 |
| E6.8 | Reduced motion | `SOURCE_VERIFIED` | 36 `prefers-reduced-motion` media rule blocks in the shipped CSS |
| E6.9 | Live regions behave | `LIVE_MEASURED` + repo suite | 7 regions, all `polite`: `welcomeMissionCount`, `offlineBanner`, `undoBar`, `teamsNowCard`, `missionPlayPanel`, `missionXpReward`, `statusLive`. `check-motion-liveregions`: 6 pass, 0 fail — "regions that spoke: missionXpReward=1, statusLive=2" (no spam) |
| E6.10 | Non-text contrast | `SOURCE_VERIFIED` (repo suite) | `check-nontext-contrast`: "Every required component boundary, state difference and focus ring is at least 3:1" |
| E6.11 | Screen reader | `NOT_TESTED` | No VoiceOver or TalkBack available in this environment |

---

## E7 — Family, profile, Grown-ups, persistence, offline, 3D

| # | Claim | Label | Evidence |
|---|---|---|---|
| E7.1 | Profile empty-name validation is real | `LIVE_MEASURED` | Through the real Edit form: `aria-describedby="profileEditNameError"`, error `role="alert"`, `hidden` false, text "Please enter a name.", focus returned to the input, `label[for]` "Child's name" |
| E7.2 | Grown-ups action order is practical | `LIVE_OBSERVED` | Kids & Settings → Mission Book PDF → Privacy & Safety → Help & Support → Check for Updates → Reset Progress → support@jumvi.co |
| E7.3 | Product Care topics and analytics attributes coexist | `LIVE_MEASURED` | `data-topic` present on `<details>`: `ball_not_sticking`, `ball_hard_to_remove`, `strap_fit`, `cleaning_storage`, `damaged_missing` |
| E7.4 | Reset is a deliberate 1200 ms hold | `SOURCE_VERIFIED` | `const HOLD_MS = 1200` (app.js:6331); fires `doReset()` only on the `HOLD_MS` timeout (app.js:6415); `holdConfirm` class + progress fill |
| E7.5 | **Daily Champion is one star per family per day, across profile and team changes** | `SOURCE_VERIFIED` (repo suite) | `check-daily-star-scope` **D1** team → solo → another team on one day yields exactly ONE star (ledger unchanged across all three scopes); **D2** a second child sees the family's star and playing does not mint another; **D3** an existing family that already earned keeps it; **D4** yesterday's claim does not block today's. Re-run to completion with a longer timeout: **exit 0, all 6 checks pass** |
| E7.6 | Offline keeps missions working | `LIVE_OBSERVED` | Banner "Offline — missions still work. Island needs a connection." shown; `openMission()` still opens a sheet while offline |
| E7.6b | Install / offline / update / reset paths are honest | `SOURCE_VERIFIED` (repo suite) | `check-install-offline-update-reset`: **15 pass, 0 fail, 1 informational, of 16**. Install state differentiated (`prompt` / `ios-manual` / `none`); update differentiates "already latest", "check failed" and "update found → reload" rather than toasting a false success |
| E7.6c | Profile / team isolation | `SOURCE_VERIFIED` (repo suite) | `check-profile-team-isolation`: **5 pass, 0 fail, of 5** — including F05, a new child never reuses a freed profile id |
| E7.7 | Responsive matrix passes repo thresholds | `SOURCE_VERIFIED` (repo suite) | `check-responsive-matrix`: 24 pass, 0 fail, 0 skipped, of 24 checks |
| E7.8 | 3D Hub renders and exits cleanly | `LIVE_OBSERVED` | With software WebGL (`--use-gl=swiftshader --enable-unsafe-swiftshader`): a real **390×844 canvas with a live WebGL context** draws the island; zone progress "Bullseye! · 0/6 complete", menu, GO TO NEXT MISSION and the first-run welcome modal all render; exit via "← Missions" returns `tab-hub3d` → `tab-today`; **0 page errors**. Screenshots `hub_entry_webgl.png`, `hub_exit_webgl.png` |
| E7.8b | **Correction** | `LIVE_MEASURED` | An earlier pass in this audit reported "canvas 0×0, WebGL did not initialise". Two harness errors, not product behavior: this audit's browser was launched without software-GL flags, **and** `querySelector('canvas')` matched an offscreen 0×0 helper canvas rather than the render target. Re-run with the flags the repo's own hub check uses, both canvases are present and both report a live WebGL context. |
| E7.8c | Hub failure modes all handled | `SOURCE_VERIFIED` (repo suite) | `check-hub-fallback`: **6 pass, 0 fail, 0 untested, of 6** — H01 no WebGL (refuses to start, drops back to the app, hides its own entry), H02 hub module aborted, H03 three.js aborted, H04 offline, H05 reduced motion honoured, H06 orientation change (canvas follows, frames continue, no overflow) |

---

## E8 — Prior hypotheses, adjudicated

The brief asked for a PASS / FAIL / INCONCLUSIVE / NOT TESTED on each carried-over hypothesis, without trusting the earlier reports.

| Hypothesis | Verdict | Basis |
|---|---|---|
| 320×568 and 390×844 onboarding helper-text ↔ Start CTA geometry | **PASS** (no occlusion) | E1.1–E1.6. The prior figures reproduce but are rect-vs-clip artifacts. A separate, real fold issue is filed as E2. |
| Visible Pause/Resume in the running state | **FAIL** | E3.2–E3.4, E3.6. Confirmed and escalated: no pause path exists at all. |
| 320 px Missions view — lazy-loaded illustration timing | **INCONCLUSIVE** | Illustrations rendered on 36/36 sheets and no console errors were seen, but load-timing under throttling was not instrumented. |
| 568×320 Family first viewport — visibility of main actions | **PASS (partial)** | 2 of 43 Family actions land in the first landscape viewport, none blocked by the nav on hit test. Usable but dense; the landscape fold issue is filed under E2. |
| Product Care ordering and `data-topic` attributes preserved together | **PASS** | E7.2 + E7.3 |
| Reset hold — 1200 ms deliberate press, profile-preserving scope | **PASS on duration** (`SOURCE_VERIFIED`, E7.4); **INCONCLUSIVE on scope** — the live hold test could not seed prior progress through a public API, so profile-preservation was not independently re-derived here |
| Daily Champion cannot be re-earned by switching profile or team on the same device | **PASS** | E7.5 — repo suite D1 and D2 test exactly this and both pass |

---

## E9 — Artifacts

- Screenshots: `screenshots/current_audit/` — 62 PNGs at DPR 2.
  - `onb_<viewport>_A_initial|B_levelchosen|C_scrolled.png` — 5 viewports × 3 stages
  - `tab_<viewport>_<Play|Missions|Family|Grown-ups>.png` — 5 viewports × 4 tabs
  - `run_01…run_11` — sheet → narration → countdown → running → early finish → gate open → completion → Undo → close-and-reopen
  - `sheet_NN_<Mission>.png` — the named high-risk missions plus one short and one standard two-player mission
  - `a11y_200pct.png`, `a11y_focus_tab.png`, `profile_validation.png`, `offline_banner.png`, `reset_hold.png`, `hub_entry.png`, `hub_exit.png`
- Data: `JUMVI_CURRENT_36_MISSION_BEHAVIOR_MATRIX.csv`, `JUMVI_CURRENT_BEHAVIOR_UX_SCORECARD.csv`, `JUMVI_CURRENT_PERSONA_SCORES.csv`
- Repo suites run: `check-onboarding-occlusion` (12/12), `check-responsive-matrix` (24/24), `check-mission-schema`, `check-mission-equipment`, `check-mission-sheet-matrix` (36/36), `check-mission-play-state` (T07–T28 observed), `check-a11y-controls`, `check-dialog-contract` (12/13), `check-zoom-textresize`, `check-motion-liveregions` (6/6), `check-nontext-contrast`, `check-undo-next-layout` (5/5), `check-daily-star-scope` (6/6), `check-profile-team-isolation` (5/5), `check-install-offline-update-reset` (15/16 + 1 informational), `check-hub-fallback` (6/6)
