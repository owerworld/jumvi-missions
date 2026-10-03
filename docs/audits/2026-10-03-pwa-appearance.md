# V2 PWA / appearance / US mobile coverage — 2026-10-03

## Scope and findings

User requested reliable Home Screen usage, system light/dark preference in profile, mobile optimization grounded in US phone research. Canonical content/art/audio, certificate eligibility, identity and locked contracts unchanged. No new permissions, tracking, cloud data, forced service-worker activation or orientation lock.

Before: V2 manifest had no icons, launch colors or Apple touch icon; installed label was JUMVI Review. Initial service-worker registration could return before installation completed, causing prepareOffline to return false. An existing old active worker could receive a new-release cache message it cannot handle. No appearance preference existed.

After: reuse existing approved JUMVI PNG icons, immutable under V2 release assets (192,512,maskable,Apple). Stable id/scope /v2/ unchanged; EN and TR launch paths retained. Product name JUMVI. No external CDN or new root asset route. Standalone presentation with full zoom support, safe-area padding and dynamic viewport minimum height. No fixed controls over keyboards.

Appearance follows OS by default and reacts to changes. Optional Light/Dark override in profile, stored as jumvi-v2:appearance.v1 only in V2. Existing root preference cannot leak. Storage failure keeps current session usable. Clear/storage events return to system. Dark semantic colors, controls, native selects/dialogs, focus rings and brand contrast; equipment imagery never inverted. Theme-color changes with preference. System CSS fallback precedes JS. No promise that every operating system updates the installed splash screen color dynamically.

Offline preparation waits (bounded 30s) for initial/update installation, then requests verified mission bytes from waiting/active workers with matching release replies. Does not skipWaiting, claim clients, reset history, clear older caches or claim all36 missions are downloaded. Existing release hash/MIME checks, API exclusions and rollback behavior retained. Optional profile installation guidance explains prepared-only offline and possible separate Home Screen/browser local history; does not promise device sync.

## Research and coverage decisions

- Statcounter US mobile vendor web-usage share, September2026: Apple53.58%, Samsung28.11%, Motorola3.49%, Google3.16%. This is sampled web usage, NOT installed model ownership or unit sales. https://gs.statcounter.com/vendor-market-share/mobile/united-states-of-america
- Counterpoint Market Pulse US sell-through directory through July2026 lists iPhone15/16/17 families, GalaxyS24/S25/S26 and A-series, Pixel8/9/10. Public directory does not give a reliable ranked installed-base list. Do not call test presets the most-owned phones. https://dir.counterpointresearch.com/smartphones/us
- Model-specific priority is therefore an inference: prioritize iPhone Safari/Home Screen + Samsung Chrome/Samsung Internet; cover small older iPhone and budget Android dimensions, larger iPhone, Pixel, landscape and text enlargement. Safari/WebKit automation is not physical Safari; Chromium is not Samsung Internet.
- Google manifest/icon guidance: https://web.dev/learn/pwa/web-app-manifest
- Apple/WebKit Home Screen and data isolation: https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/ and https://webkit.org/blog/14787/webkit-features-in-safari-17-2/
- Safari26 Home Screen user choice: https://webkit.org/blog/17333/webkit-features-in-safari-26-0/

Automated coverage: Chromium + WebKit, TR/EN, widths320/360/375/390/393/402/412/430/440 and852landscape;100%and200%root text (not browser-menu zoom); touch device presets iPhone13Mini, iPhone16, iPhone16ProMax, GalaxyS24, Pixel8, portrait/landscape. Generic widths cover reflow, not claims to reproduce exact new devices. Existing suite covers audio/offline/cache/update/old tabs/records/Back/certificate/root coexistence.

## Acceptance limits

Native desktop browser visual check is additional to automation. Physical iPhone/Android installation, launch from OS icon, standalone safe-area and keyboard under real OS, OS text size, Samsung Internet and actual slow-device behavior remain physical QA. Do not report those as passed or M6 PASS. User's earlier phone feedback remains exactly what they reported; no inferred model/OS/browser.

Production token remains expired; changes can be checked on isolated staging only until the approved credential is renewed. Do not rerun the obsolete production source job.
