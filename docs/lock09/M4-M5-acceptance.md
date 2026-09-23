# M4 acceptance and M5 implementation

M4 PASS. All 36 canonical IDs and exact EN-US/TR locale records are bound to accepted mission art. Human real-product physical PASS for m04 and m34 was supplied in the task on 2026-09-23; it supersedes physical-open metadata in the immutable historical review records. Canonical wording and approved briefs remain unchanged. `catalog/m4-review/final-acceptance.json` is the acceptance addendum; runtime records are in `content/missions/`.

Optional narration is unavailable, with no TTS, automatic caller, result audio or inferred physical success. Personal history remains local-only under the approved R3 model.

M5 local validation: 36 unit/contract tests; 62 browser tests across Chromium and WebKit, including all 36 missions in both languages, corrupt art/content rejection, no forced activation, exact v254 direct upgrade with old tabs, rollback/forward and synthetic local data preservation. Service Worker shell/content caches are release-scoped with embedded hash/MIME allowlists. Previous and unrelated caches are retained. Ops/authenticated/error/mismatched responses are excluded. No runtime import of legacy code. Compatibility public assets are copied with baseline hashes for old open clients; prior M3 release files remain available.

Playwright is pinned to 1.63.0. The former 1.56.1 bundled WebKit crashed in native `WebCore::Navigation::initializeForNewWindow` during offline TR→EN navigation; the identical test passes with 1.63.0 WebKit 26.6. Physical Safari/VoiceOver/TalkBack, child, outdoor and actual-device checks remain release conditions. Browser automation is not equivalent to them.

M5 live staging verification remains required after this candidate is deployed by the existing isolated staging workflow. No production deploy authorization is implied. `main` required checks/branch protection remain an open release risk.

Technical references reviewed: https://developers.cloudflare.com/workers/best-practices/workers-best-practices/ ; https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/ ; https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting ; https://developer.mozilla.org/en-US/docs/Web/API/Clients/claim ; https://github.com/microsoft/playwright/releases . No forced skipWaiting/client takeover is used by the new Worker.
