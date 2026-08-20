# JUMVI US English Copy Audit

Baseline reviewed: `df189f3fa7c1be3f719e20399abdedd4573de532` (`jumvi-missions-v238`).

## Executive Summary

- **483** user-facing English strings reviewed: 180 mission fields and 303 UI,
  onboarding, family, grown-up, hub, install, error, and accessible-label strings.
- **439 KEEP** — clear, natural, and appropriately warm.
- **2 CHANGE-SAFE** — screen-only labels implemented below.
- **22 DEFER-AUDIO** — wording can improve, but the screen text is coupled to
  approved prerecorded Coach Leo audio. No audio was changed or generated.
- **20 REVIEW-LATER** — subjective brand/competition choices, not defects.

Recurring opportunities are overuse of all-caps for ordinary actions, a few
win conditions phrased as competition rather than completion, and tips that
lean on hype or insider language. The released mission text is otherwise
unusually concrete for an active-play product. `big-kid steps` is retained: it
is an intentional, child-friendly approximate measurement and is consistently
used in the mission system.

## Editorial Rules

1. Put one physical action first in each instruction; preserve required count,
   timing, direction, and safety information.
2. Use short, literal labels for controls. Put warmth in Coach Leo, mission
   names, useful tips, and celebrations—not navigation.
3. Write win conditions as a finish line (for example, “Reach 10 catches”)
   unless competition is essential to the game.
4. Keep safety calm, direct, and specific. No jokes or hype in safety text.
5. Use **partner** for two-player mechanics, **teammate** for teams, **player**
   for general runtime, and **child/family** on grown-up surfaces.
6. Reserve all caps for real game signals such as GREEN LIGHT, RED LIGHT, and
   FREEZE. Sentence case is the default.
7. Do not edit visible English that would materially disagree with approved
   recorded narration or reminders. Mark it for a coordinated audio release.
8. Every English-source edit must retain the existing Turkish translation key;
   Turkish wording is out of scope.

## Mission Audit

All 36 titles are **KEEP**. Every step, win, safety, and tip was reviewed for
US naturalness, spoken comprehension, physical accuracy, and tone. All fields
are `AUDIO_COUPLED_EXACT` or `MULTI_COUPLED`: full narration is prerecorded;
several replay/reminder lines also use the new Coach Leo clips. Therefore the
only changes recommended below are deliberately **not implemented**.

| Mission | Steps | Win | Safety | Tip | Decision / rationale |
| --- | --- | --- | --- | --- | --- |
| 1 Speed Demon | KEEP | DEFER | KEEP | DEFER | “beat your best” is competitive; “Tiny humans?” is less natural than “Playing with a younger child?” |
| 2 Red Light, Green Light | KEEP | KEEP | KEEP | KEEP | Game signals are correctly emphatic; caller remains authoritative. |
| 3 Quick Slap | KEEP | DEFER | KEEP | KEEP | “10 … wins” could become a completion target. |
| 4 Switcharoo | KEEP | DEFER | KEEP | KEEP | “First to 12 … wins” is clear but needlessly competitive for a pair activity. |
| 5 Statue Mode | KEEP | KEEP | KEEP | KEEP | Clear physical sequence; FREEZE is a game signal. |
| 6 Number Echo | KEEP | KEEP | KEEP | DEFER | “Sneaky math” is cute but parent-directed and slightly wink-wink. |
| 7 Rainbow Throws | KEEP | KEEP | KEEP | KEEP | Arc, distance, and safety are all immediately clear. |
| 8 The Landing Pad | KEEP | DEFER | KEEP | KEEP | “8 perfect landings wins” can become “Make 8 clean landings.” |
| 9 Step-Back Challenge | KEEP | KEEP | KEEP | KEEP | Measurement and progression are clear. |
| 10 Power Step | KEEP | KEEP | KEEP | DEFER | “real athlete/pro pitchers” is unnecessary status language. |
| 11 Sky Floater | KEEP | KEEP | KEEP | KEEP | Calm, clear, age-appropriate. |
| 12 Heart-High | KEEP | KEEP | KEEP | KEEP | “Chest-height” is precise; safety correctly redirects aim to paddle. |
| 13 Silent Mode | KEEP | KEEP | KEEP | KEEP | Preserve exactly: pre-play narration is approved and gameplay must stay silent. |
| 14 Tempo Master | KEEP | KEEP | KEEP | KEEP | Clear count and movement limit. |
| 15 Spotlight Eyes | KEEP | KEEP | KEEP | DEFER | “eyes lock on” is less natural than “keep your eyes on the ball.” |
| 16 1 — 2 — 3 — GO! | DEFER | KEEP | KEEP | DEFER | “Ball flies on 3, exactly!” and “pro skill unlocked” are weaker US phrasing. |
| 17 Mirror Mode | KEEP | KEEP | KEEP | KEEP | Clear matching mechanic. |
| 18 Count to 10 | KEEP | KEEP | KEEP | DEFER | “tiny humans” is less natural than “younger players.” |
| 19 Round Robin | KEEP | DEFER | KEEP | DEFER | Record/party language is optional brand voice; no mechanics issue. |
| 20 Crab Walk Relay | KEEP | DEFER | KEEP | KEEP | “Both lines hit 20 passes together” can be “Reach 20 passes together.” |
| 21 Captain Says | KEEP | KEEP | KEEP | KEEP | Team role and rotation are clear. |
| 22 Spin Squad | KEEP | KEEP | KEEP | KEEP | “SPIN!” is a legitimate in-game cue. |
| 23 Mix It Up | KEEP | DEFER | KEEP | KEEP | “Most clean swap cycles wins” is grammatically weak; completion wording needs product decision. |
| 24 2v2 Squad Count | KEEP | KEEP | KEEP | KEEP | Shared-total framing is strong and cooperative. |
| 25 Chill Catch | KEEP | KEEP | KEEP | KEEP | Appropriate indoor safety and warmth. |
| 26 Tiny Space | KEEP | KEEP | KEEP | KEEP | PLANTED is understandable here; core rule is clear. |
| 27 Secret Signal | KEEP | KEEP | KEEP | KEEP | Clear action sequence. |
| 28 Mind Reader | KEEP | KEEP | KEEP | REVIEW-LATER | “Pro tip” is familiar; keep unless the broader brand tone is simplified. |
| 29 Stuck-Foot Catch | KEEP | KEEP | KEEP | REVIEW-LATER | “ANY space” overpromises slightly; not a blocking clarity issue. |
| 30 Left or Right! | KEEP | KEEP | KEEP | KEEP | Direction and caller swap are clear. |
| 31 Cloud Chaser | KEEP | KEEP | KEEP | KEEP | Outdoor direction and safety are unambiguous. |
| 32 Home Base | KEEP | KEEP | KEEP | KEEP | Concrete examples make “base” clear. |
| 33 How Far Can You Throw? | KEEP | DEFER | KEEP | KEEP | “Beat your previous distance record” is competitive but clear. |
| 34 Chase the Ball! | KEEP | DEFER | KEEP | KEEP | “7 running catches wins” can become “Make 7 running catches.” |
| 35 Sky High Jump | KEEP | KEEP | KEEP | KEEP | Timing and ground safety are clear. |
| 36 Marathon Rally | KEEP | KEEP | KEEP | REVIEW-LATER | “beat your distance” is optional competitive framing, not a defect. |

### Deferred audio recommendations

These should be updated only in a coordinated script + audio re-record release:

- 1 tip: “Playing with a younger child? Slow it down and keep it fun.”
- 8 win: “Make 8 clean landings.”
- 15 tip: “Saying it out loud helps you keep your eyes on the ball.”
- 16 step: “Throw on 3.”
- 20 win: “Reach 20 passes together.”
- 23 win: “Complete as many clean swap cycles as you can.”
- 34 win: “Make 7 running catches.”

## UI, Onboarding, Family, and Grown-ups Audit

The first-open path is strong: “Start Mission,” “Choose another,” equipment
counts, and “When play starts, eyes on the ball—not the screen” are concise
and actionable. Install/offline, profile, privacy, care, and support language
is calm and parent-appropriate. ARIA labels reviewed are literal and useful.

Family surfaces mostly emphasize shared progress and playing together. “Team
Standings,” streaks, records, and champion labels deserve a future product-tone
review, but no scoring or progression labels were changed here. They are
`REVIEW-LATER`, not copy defects.

### Implemented safe UI edits

| Current | Decision | Recommended | Coupling | Turkish handling |
| --- | --- | --- | --- | --- |
| Collect moments you earned | CHANGE-SAFE | See what you've earned | SCREEN_ONLY + LOCALIZATION_COUPLED | Existing Turkish text retained under new exact key. |
| Get unstuck quickly. | CHANGE-SAFE | Get help quickly. | SCREEN_ONLY + LOCALIZATION_COUPLED | Existing Turkish text retained under new exact key. |

## Coach Leo Voice Audit

Coach Leo’s recorded lines are treated as final approved production assets.
The countdown, timer-end, Mission 13 pre-play, hub lines, reminders, and
mission narrations were not changed. The strongest tone issues are the deferred
mission phrases above; changing them now would create a visible/audio mismatch.

## Validation Notes

- No mission ID, pack, player count, time, age, equipment, XP, badge, or rule
  changed.
- Turkish visible wording is unchanged. Two English exact-string keys were
  added in `EXACT_EXTRA` solely to preserve the prior Turkish rendering.
- This source release changes precached `index.html` and `/tr` inputs, so the
  cache is intentionally bumped exactly once from v238 to v239.
