# Help language / family presentation — 2026-09-30

36 missions now have short visible TR / EN-US Help headings, separately from the original detailed approved image captions. Original captions remain alt text. Essential free-hand, ball-hold, target, landing and role cues are visible as short supporting text and unchanged canonical instructions. Only m07 and m30 first-frame duplicate Help notes are suppressed; original entry notes remain unchanged. No empty setup paragraph.

A deep comparison after stripping the three added Help presentation fields confirms every original presentation value unchanged. Canonical records, safety, goals, step mapping, entry hierarchy, artwork, controls, privacy, certificate rules and audio are unchanged.

New regressions failed before implementation (4 Chromium cases). New fixed focused suite: 8 PASS across Chromium/WebKit and TR/EN. Initial full suite: 190 PASS, two failures in the new assertion's uppercase Kesik match; corrected case-sensitive expectation, not application behavior. Final full-suite result recorded in release receipt. Contracts: 57 PASS.

Actual Chrome interaction confirmed m07 English and Turkish Help / return context. Browser captures recorded under this folder. Different tab zoom/viewports prevent claiming a matched-size height comparison from those Chrome captures. A temporary viewport override was reset. Desktop browser review is not real phone/child testing or fresh native-menu 200% zoom acceptance.

Rollback baseline: source 584fbc60a5b11e52663eab6a4ad0b20f039acc89, artifact 98f86dbcd731c1c3, V2 Worker 789f8304-9517-4693-91b5-7f4f143531dc. Release must use existing exact-SHA staged V2-only gates. Root main and ten public files checked before/after. No M6 PASS or objective 10/10 claim. Audio production remains deferred.
