# M6 local visual and presentation pass — human review required

**Scope.** Isolated `codex/lock09-implementation` worktree only. No push, staging publish, production publish, mission-rule revision, root experience change, or human art acceptance. The live `/v2/` is not this local build.

## What actually changed

- **Help structure:** 23 missions now put every canonical instruction next to the correct visual moment exactly once. An explicit per-mission `frameStepMap` replaces the unsound assumption that equal numbers of rules and frames mean the same sequence. m03's toss and paddle tap appear with frame 1, the sticky catch with frame 2, and frame 3 remains the detach moment. The other 13 missions retain their full canonical lists until safe frame alignment is known. No canonical mission JSON or rule changed.
- **Selected-player progress:** Each mission reported complete is now visible by name and saved report count before the long individual-record history. The certificate progress and, when eligible, preview button appear near the top of the selected player's mobile view. The two-paragraph privacy disclosure remains on player-list and new-player screens and is not repeated above the already-selected player's progress. Shorter TR/EN report-count copy reduces repeated document text.
- **m03 art:** Original first frame remains packaged. A v3 product/motion candidate was substituted **only by local browser request interception** and captured at app scale in entry, Help, and active views. It distinguishes airborne toss from paddle tap better than the current frame; small-screen strap angle and timing still need human/physical visual acceptance.
- **m05, m09, m13 art:** Original art remains packaged. Versioned separate candidates were generated, product/mechanics screened, and substituted only in isolated local browser contexts for entry, Help and active screenshots. m05 shows a one-ball blue-front catch with freeze posture; m09 shows one-ball backward steps; m13 shows closed mouths, a blue-front sticky catch and silent finger count. These are **candidates**, not production-ready assets. Rejected m09 two-ball, m13 open-mouth/black-background and m14 double-ball outputs were not wired in.

## Visual scope accounting

| Measure | Before | After this pass |
|---|---:|---:|
| Repeated entry hero mappings in packaged app | 28 | **28**; original assets intentionally preserved |
| Local replacement candidates viewed in real app layout | 0 | **3** (m05, m09, m13) |
| Separate m03 timing candidate viewed in real app layout | 0 | **1** |
| Help sequences with explicit canonical-to-frame mapping | 0 | **23** |
| Human-accepted replacement hero art | 0 | **0** |

The 28 mission-specific movement gaps remain release blockers until the required art is produced and accepted. `VISUAL_CORRECTION_REGISTER.md` records the specific action, why the current image fails, and the exact scene needed for each one. The other eight missions are not auto-accepted.

## Customer path evidence

- **Entry → Help → Start/active:** `m03-candidate-entry-tr-390.png`, `m03-candidate-help-tr-390.png`, `m03-candidate-active-tr-390.png` are local Chromium captures with a verified candidate image substitution and asset-byte check. Equivalent captures exist for m05/m09/m13. Baseline m03 entry/Help captures are in `all-missions/`.
- **Optional record → selected player → progress → certificate:** `screenshots/history-390-tr-synthetic.png`, `screenshots/progress-35-of-36-viewport-synthetic-qa.png`, `screenshots/progress-36-of-36-viewport-synthetic-qa.png`, `screenshots/certificate-preview-synthetic-qa.png`, `screenshots/certificate-synthetic-qa.png`. All records/player labels are synthetic browser fixtures, no real user data.
- **Certificate decision:** The user explicitly approved the condition in this thread: the same local player must save explicit “completed” reports for 36 different canonical missions; no measured physical-skill claim; legacy records excluded. This human decision supports the threshold. The PNG presentation and final release remain subject to human review.

## Tests and practical limits

- Local state/accessibility/isolation tests: **52/52 passed**.
- Full local Chromium suite after help/progress change: **73/73 passed**. After the final disclosure-placement tweak, focused Chromium tests: **8/8 passed**. Focused WebKit tests covering catalogue integrity, certificate/progress, accessibility and customer path: **12/12 passed**.
- TR/EN automated text enlargement and 320/390/430 responsive checks passed. In actual desktop Chrome UI, the browser toolbar exposed **“Yakınlaştır: %200”**. At effective `innerWidth` 320/390/430 CSS px, TR and EN active Help/Stop buttons had no horizontal overflow; 320 CSS px controls measured 104 px high and 390/430 measured 64 px. This was desktop Chrome with a viewport override, **not a real phone**. The browser screenshot was observed live; no exportable PNG from that native-zoom UI was produced.
- Real phone, child comprehension, outdoor legibility, physical paddle fit/strap continuity and candidate visual acceptance: **NOT TESTED / HUMAN REVIEW REQUIRED**. The 28 remaining distinct-motion hero scenes and m03 first-frame acceptance block a visual-completeness claim.
- No release or deployment action occurred. Local build manifests identify the new `/v2/` build, but this report does not treat it as live.

## Remaining blockers by type

| Type | Open item |
|---|---|
| Implementation | No known failing automated contract in the changed surfaces. |
| Visual production | 28 packaged heroes still need distinct mission movement; three local candidates exist and must not be counted as accepted. m14 candidate rejected for two balls per temporal panel. |
| Visual candidate | m03 v3 timing and strap angle; m05/m09/m13 product hand/strap and mobile comprehension. |
| Human/physical evidence | Real JUMVI product handling, candidate art acceptance, child/parent task interpretation. |
| Test not performed | Real iPhone/Android, screen-reader gesture experience, outdoor device viewing, local Chrome 200% screenshot export. |

**Decision:** M6 remains **PILOT / CUSTOMER PRESENTATION REVIEW REQUIRED**, not PASS. No expanded publication approval is inferred.
