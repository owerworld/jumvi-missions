# V2 final customer review — 2026-10-04

Scope: existing English US customer experience, Turkish review locale, locked game mechanics and local-only optional history. No new mission rules, certificate eligibility rules, tracking, assets, narration or design system.

## Findings and fixes

- The customer label override prevented fallback wrapping in long Turkish return labels and long nicknames. Reproduced at 320 CSS px with 200% root text size. Normal word wrapping remains preferred; words too wide for their container can now wrap without shrinking text or targets.
- An empty repository offered an actionable destructive delete-all control. Disable it in V2 until player/history/operation data exists. Preserve the legacy root cleanup behavior. Existing C-17 confirmation and actual deletion contract remain unchanged.
- A certificate image finishing after navigation could open a stale modal over a different screen. Reproduced with a held image response. Deduplicate pending requests and check document state, repository epoch, player revision and certificate eligibility immediately before display. Corrected history or deletion cannot enable a pending certificate.
- Disabled-to-ready button background interpolation briefly put dark text over a dark intermediate color. A deterministic mid-transition contrast test failed. Readiness-bound controls now switch foreground/background together; ordinary control feedback is retained.

## Verification

- Five initial Chromium regression failures recorded: EN/TR long-name wrapping, empty delete, late certificate, intermediate dark contrast.
- Final new tests: 12 Chromium/WebKit cases pass, including eligibility correction during loading. Certificate focused suite: 22 cases passed before the final readiness-only CSS change; complete CI suite required before publication.
- 60 core screen/theme/locale combinations and 28 extended combinations (certificate, history, destructive confirmation, guest, group, returning, interruption) assessed with axe and narrow/enlarged-text layout measurements. No final detected violations or overflow. This is automated WCAG coverage, not full accessibility certification.
- 36 missions × EN/TR: all entry/help images decode; 432 width/text entry checks (320/390/430 × normal/200% text) show no horizontal overflow. Normal 390 px Start document Y ranges from 687 to 1071; complex rules deliberately remain visible rather than hiding them to meet a fold target.
- Full local suite initially passed 276/278; two legacy cleanup regressions led to restricting empty-delete disabling to V2. Final customer + legacy repository recheck: 36/36 pass in Chromium/WebKit. Full final staging CI remains the publication gate.
- Native Chrome menu verified actual 200% zoom (innerWidth 904, innerHeight 429, root text 16px): Help, return, Stop work. This does not verify mobile-width browser zoom.
- Native Chrome live EN entry/menu/parent/management inspected. Evidence screenshots in review-assets/2026-10-04/final-customer. Synthetic player records are confined to disposable test browser contexts.
- PDF, narration, data isolation, migration, offline and certificate export coverage remains in the complete release suite and exact-file verification. No new art acceptance or physical-performance claim.

## Limits

Desktop responsive/device emulation is not physical phone QA. New physical iOS/Android Home Screen installation, OS text scaling, mobile-width native browser-menu 200% zoom, VoiceOver/TalkBack and child usability testing are not claimed. WebKit live-origin offline emulation remains unsupported; the release suite checks the identical artifact with a local origin outage separately. No M6 PASS or measured 10/10 claim.

Release only through the existing isolated branch/staging/exact-artifact V2 workflow. Preserve main, marketing and root experience; root service-worker compatibility is limited to the existing approved helper. Actual release receipt is recorded outside the source commit after verification.
