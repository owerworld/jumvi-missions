# V2 parent/customer experience review — 2026-09-30

Source before revision: `1774a73f90727f65a139e64eb48724f325c2241a`.
Reviewed V2 artifact: `98f86dbcd731c1c3` (797 manifest files).

## Changes

- Remove the duplicate featured-current-mission card from discovery. Preserve Back access and default access to all 36 missions. Existing six groups become optional toggle filters, combined with player count and optional unfinished filtering. No search field, forced choice, new identity, or persisted tracking.
- Make each discovery row one native button with its title, thumbnail, equipment count and selected-player completion indicator. Narrow space/text enlargement stacks image and text. Preserve font sizes, focus outlines and touch targets.
- Keep main-entry requirements, physical safety and canonical goals. Reduce decorative spacing and duplicate seated setup in m25. US m25 distance adds feet alongside the same 1–3 meter range.
- Use natural, factual EN-US/TR stop, report and save copy. Reported completion remains a user report; nothing claims measured catch/skill. Unsaved-report discard still uses the existing confirmation contract.
- Return from adult/management contexts directly through existing Back handling; remove the extra returning-screen step. Add optional-player certificate progress and explain certificate eligibility before a player exists. The 36 distinct locally reported completions condition is unchanged.
- Keep the local-only disclosure visible before player creation. Put the additional retention explanation in an accessible native disclosure. Add parent help for missed catches and the existing public support contact.

## Scope / contradiction check

JD/LOCK wording, canonical mission records, physical art/geometry, 17-state contracts, certificate eligibility, IDB schema, privacy/network payloads, audio, worker/routing configuration and root experience are unchanged. Group selection is optional and reversible. No new mission rule or distance is introduced. No product art was generated or silently accepted in this pass. Audio production remains deferred at the user's instruction.

## Verification

- Six new regression cases failed on the original build before fixes (`regression-before.log`).
- Final local contracts: 55/55 PASS (`contracts-final.log`).
- Final Chromium/WebKit browser suite: 184/184 PASS (`browser-final.log`), including 12 new parent UX cases. Earlier failed intermediate suite retained as `browser-full.log`; its obsolete copy/extra-Back expectations were updated, not the safety assertions.
- Normal and 200% text checks at 320/390/430 CSS pixels, accessibility automation, keyboard/focus, content/art integrity, offline/migration, save/delete/multi-tab, audio cancellation and privacy checks are included in that browser suite.
- Actual Chrome interaction: group filtering, whole-row mission selection, Help opening/return context, Start/Stop and entry inspected at measured `innerWidth=390`, `innerHeight=844`, root font `16px`. Saved browser JPEGs are evidence of desktop inspection, not phone testing. A preexisting browser zoom was compensated to the measured CSS viewport; no fresh native-menu 200% zoom PASS is claimed.
- m25 Start top measured at y=920.66 in this desktop entry. Scrolling is still required; this is explicitly not a claim that all entry actions fit the first viewport.
- Before publication, ten legacy public file hashes and main SHA remained unchanged (`before.json`). Root compatibility allowlist check passed.

## Limits / release review

This is a technical/customer-presentation improvement, not an objective 10/10 rating, child acceptance or M6 PASS. New real-family/field validation, native phone assistive technology and native-menu browser zoom coverage remain open. Existing human device feedback is preserved without inventing its device/browser details.

Prior working V2: artifact `25a1cdf320afef6f`, V2 Worker version `34deca09-7f9f-49eb-a835-cbcb5a17fbfd`. Existing V2-only withdrawal/rollback path remains available; root rollback is not authorized. Publication requires the exact committed SHA/artifact, successful isolated staging, remote integrity and live/root coexistence checks. Live evidence will be recorded separately after publication.
