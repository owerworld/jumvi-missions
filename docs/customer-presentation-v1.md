# M6 customer presentation pilot v1 — HUMAN REVIEW REQUIRED

Base commit: a1d022c27a717b4198f99c78da2b47397ea8c2ac.
Scope: local implementation candidate only. No push or deployment authorization for this revision. Preserve JD01–15, LOCK01–09 and all canonical content. This is not M6 PASS and does not supersede accepted source-art approvals.

`content/customer-presentation-v1.json` supplies separate entry hero, help frames and short active reminder mappings for m25, m07, m20 and m30 only. Each overlay is bound to the canonical record SHA256. The other 32 missions retain their existing art mapping and renderer. Global bug fixes affect navigation focus/scroll and control-label wrapping; equipment arrays display alternatives, not ranges.

- m25 uses the already approved LOCK07 natural seated scene, blue-front contact and free-hand detach images.
- m07 hero v1 was rejected because the boy's paddle/free hands contradicted the frame contract. Candidate v2 corrects the arm roles: right paddle, left free for both illustrated players. Exactly two players/two handle-free paddles/one ball; gentle high arc toward blue front. Human review remains required; this is not proof of child comprehension.
- m20 native SVG actor groups were extracted from the accepted recovery sources without changing pose, hand, equipment, ball or mirroring. Review-board text was removed from the derivative and replaced with localized HTML captions. Two queues and the changed front/back order remain visible. Separate detach/catch details avoid repeating the entire technical board in every step.
- m30 preserves the receiver's anatomical right and paddle hand; no mirror transform. The hero includes head and both hands. Native localized text explains whose right is meant and that neutral returns do not count.

Each new image's source hash, transformation, dimensions and byte hash are recorded in `content/asset-manifest.json`. Existing accepted WebP files were not modified. Pilot assets are candidates, not automatically accepted because their integrity checks pass.

Navigation reading positions are in-memory, per document and per mission/screen/round. Entering a different context starts at the heading. RETURN/BACK restore a known reading position and trigger without an extra focus scroll. Same-view render preserves current position. No player data or reading-position telemetry is added.

Active controls retain locked font and target minimums. Narrow browser viewports now receive the existing compact icon/label treatment even when root font remains 16px. Labels wrap at word boundaries; no font reduction, truncation, zoom restriction or fixed control bar is introduced. Browser 200% zoom and root text 200% must be reviewed separately; unit checks are not visual acceptance.

The overlay and every displayed pilot asset are included in the immutable release and mission offline manifest. Missing/corrupt required art still gates start/resume. Worker/config/routes, identity/persistence/privacy, audio behavior and the unsaved-report warning are unchanged.

Test: `npm run build` and `npm test`. Customer browser evidence and source-native derivative archive are outside the production package under the parent workspace's `work/m6-pilot-20260924/`. No real-device QA is implied.
