# JUMVI private insights — local review candidate

2026-10-04. Implementation is prepared and locally tested. **Not deployed; no real visitor collection enabled.** Local preview: `npm run preview`, http://127.0.0.1:8962/. Preview data are deterministic synthetic counts, prominently labeled. The preview server binds only loopback and is never deployed. The production Worker has no demo bypass.

## Purpose and scope

Help the owner understand US V2 mission discovery, starts and help usage, without creating customer profiles. V1 analytics keep their historical meaning and are not imported. This does not identify buyers, unique visitors, families, children, people online now, or individual journeys. Names/nicknames and saved personal history remain local-only.

The dashboard supports 7/28/90-day views, locale filters, a daily chart with an accessible table, all 36 canonical mission names, sortable counts and connection-error handling. Stop/resume counts are not abandonment metrics; no per-person conversion funnel is inferred.

## Exact data contract

Client body has exactly `v`, `event`, `mission`, `locale`. All are fixed enums. Any extra field causes rejection. Body limit 256 bytes, including streaming bodies without Content-Length. Server derives UTC day and increments a single aggregate row; it never saves an event record or precise event time.

| Event | When | Why |
| --- | --- | --- |
| app_open | Successful application boot, once per document | Measure loaded application opens, including reloads |
| mission_open | Initial loaded mission and explicit catalog selection | Compare mission entry/selection counts; history restoration is not another selection |
| round_start | Valid Start or Play again transition | Count requests to begin a round |
| help_open | Valid transition into Help from another screen | Assess instruction use |
| round_stop | Explicit Stop accepted | Understand use of the stop control |
| round_resume | Valid Resume accepted | Understand interrupted play recovery |
| completion_reported | Explicit report changes from not-complete to complete | Count self-reports, never measured physical success |

`mission`: m01–m36, except app_open uses `none`. `locale`: en-US or tr. `v`: 1. Stored columns: day, locale, mission, event, count. No version/SHA dimension, free text or exact timestamps. Report corrections can produce a later new completion report; counts are not unique tasks completed by people and are not the certificate ledger.

Country filtering uses only Cloudflare's platform-supplied `request.cf.country === 'US'`. Unknown and other countries silently return 204 without a write. Client country headers cannot override it. No city/state/GPS/IP/UA/referrer is extracted or stored by this application. IP-derived country is approximate and may reflect a VPN. The site remains accessible from other countries.

No player ID, nickname, report ID, operation ID, age, email, URL/query, fingerprint, visitor/session ID, session replay, ads or user-history export. Collector requests omit credentials and referrer, never retry, and never queue offline. DNT/GPC signals suppress sending and are respected server-side if supplied. Gameplay never awaits collection. The adapter defaults to disabled and is V2-only.

## Storage and access

Separate proposed Worker `jumvi-private-insights`, separate D1 `jumvi_usage_v2_us` (not created). No binding to `jumvi_events_v1`; no existing production secrets are copied. 90 calendar days including today, to support quarterly product iteration; daily deletion cron plus date-bounded reads. Validate the chosen retention during R8 review. Do not silently extend it or start exports/backups.

D1 Time Travel may retain recoverable database versions for 7 days on Free or 30 on Workers Paid, per provider documentation. The actual account tier is **not yet verified**. A database restore must run retention purge before dashboard access resumes. Never claim that every infrastructure copy disappears exactly at day 90. Worker request logging is disabled in the template, but Cloudflare edge/security/Access logs and retention need separate account verification and disclosure. This code alone cannot certify infrastructure-wide no-logging.

Proposed private dashboard origin: `insights.jumvi.co` (not provisioned or verified). Cloudflare Access should allow only the owner-supplied administrator email. Every dashboard asset and API request also verifies the Access JWT signature, RS256 algorithm, issuer, audience, expiry and email allowlist. Missing config/auth fails closed; workers.dev and preview aliases stay disabled. Administrator sign-in data belong to Access, separate from visitor metrics. No password or PIN in URLs. CSP, no-store, noindex and nosniff are set; SQL is fixed and parameterized.

## Activation gates and exact deployment sequence

LOCK 09 section 13 / R8 explicitly keeps V2 analytics disabled until measurement need, retention, notice and legal/technical review are complete. The present request authorizes preparing the system; it does not justify asserting those reviews already happened. No locked wording is changed.

1. Receive owner administrator email (question pending). Approve this seven-event daily-count contract/retention and complete children's-privacy review, including Cloudflare processing and current notice. An aggregate design is not a blanket COPPA exemption.
2. Verify actual Cloudflare account plan, D1 recovery retention, edge/security logging, Access sign-in retention and costs. New narrowly scoped deployment permissions are needed; existing V2 token must not be assumed to grant D1/new Worker permissions.
3. Create isolated staging D1/Worker and protected staging dashboard. No production binding. Apply schema; keep `COLLECTION_ENABLED=false` initially. Generate Access AUD and verify authorized/unauthorized real login, direct-origin and asset/API bypass rejection. Do not add wildcard email/domain access.
4. Validate synthetic US/non-US tests on staging using a test-only harness; never ship a header-based geography override. Test actual platform US traffic after review; do not mislabel local mocked CF metadata as live geography proof. Check quota/abuse protection and costs. Origin headers limit browser abuse, not forged server-side requests; numbers are not fraud-proof. Existing broad QR rate limit is not a complete collector abuse control.
5. Publish the reviewed full privacy notice with a clear entry-page link and parent-area access, without a blocking profile/consent fiction. Draft addendum is in `privacy-review.md`; it is not a complete legal policy. Gate remains closed until production disclosure is accurate.
6. Provision live D1/Worker and exact endpoint `https://qr.jumvi.co/v2/metrics`, with a more-specific route than the existing V2 catch-all. Route changes must preserve all existing app/root/marketing paths. Configure the separately protected dashboard origin. Deny query variants. Test GET/POST routing, no-cache and no secret/data bindings on V2/staging apps.
7. Deploy verified server with collection still disabled. Publish reviewed V2 client with the explicit enabled constant only after approval. Enable server collection last. Smoke with synthetic fixed fields, confirm only daily counters are written, verify non-US discard and disabled privacy signals. Validate root/V2 hashes and app/offline regression gates as appropriate to release.
8. No live milestone is claimed until protected URL and real US server filter have been verified. Record exact Worker versions, client SHA/artifact, Access policy ID, D1 ID and configuration receipt.

## Rollback

First set server `COLLECTION_ENABLED=false`; existing clients stop being counted immediately without an app rollback. Keep ingestion endpoint returning no-store 204 rather than a broken dependency. Then release the adapter-disabled client through normal V2 gates if needed. Revert only the new route/Worker/Access entries from the saved before/after receipt; preserve all existing V2 and legacy routes. Retention cleanup continues. Do not delete the database or run production rollback automatically.

## Files and validation

- `worker.mjs`: bounded collector, JWT-protected dashboard/API and daily retention job.
- `schema.sql`, `contract.mjs`: strict aggregate schema and fixed queries.
- `public/`: locally hosted dashboard, no third-party script/font/CDN.
- `wrangler.template.jsonc`: disabled/unbound review template, not a live config.
- `../src/client/media/usage-counts.js` + four insertions in main: disabled nonblocking adapter and primitive-only event wiring.
- `tests/metrics.test.mjs`: local SQLite/D1-shaped adapter and actual JOSE crypto tests; not remote Cloudflare D1 validation.
- `tests/browser.mjs`: Chromium/WebKit desktop emulation at 320/390/1280, filters/sort, 36 rows, page-overflow, axe and failure handling. Body text scaling is not OS text-size or browser-menu zoom.
- `../tests/browser/usage-disabled.spec.js`: real locally built V2 Help/Start/Stop/report flow, EN/TR, zero outbound measurement.

Run `npm ci --ignore-scripts && npm test` here. Preview requires no credentials and must stay loopback-only. Browser tests use the parent repository's Playwright/axe dependencies. For V2 regression tests first build with `JUMVI_BASE_PATH=/v2/ node tools/build-app.mjs` from repository root, then run its Playwright tests.

## Primary references checked 2026-10-04

- [FTC COPPA rule and current amendments](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
- [FTC FAQ: notice, minimization and internal-operations limitations](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
- [Cloudflare platform country property](https://developers.cloudflare.com/workers/runtime-apis/request/)
- [Cloudflare D1 Time Travel limits](https://developers.cloudflare.com/d1/platform/limits/)

The FAQ itself points to the amended rule for current requirements. This implementation/technical review is not a legal compliance certification.

## Valuation / buyer evidence exports

The authenticated `/api/report?days=7|28|90&locale=all|en-US|tr&format=json|csv` endpoint exports a dated UTC snapshot. JSON includes the schema, metric definitions, raw daily aggregate rows, period totals, and monthly totals **within the selected window only**. CSV repeats mode, generation time and coverage window on each data row. Download both together; an empty CSV contains only its header, while its companion JSON documents the disabled/empty state. Demo files are explicitly marked synthetic.

These are product-usage supporting records, not unique customers, MAU, retention cohorts, funnels, verified purchase counts, measured physical success, financial statements or a company valuation. No identifiers are added to make those claims possible. A future buyer should assess them alongside independently reconciled sales, profit, advertising, refunds, inventory and channel records.

After activation is separately approved, the owner should export each month before the proposed 90-day active retention window expires. Keep paired files in a controlled deal-room/archive, retain their generation timestamps and record instrumentation changes/outages. Overlapping exports are snapshots, not additive batches; compare a metric by day/locale/mission/event and keep the most recent snapshot, rather than summing duplicate rows. The current UTC day is provisional. No automatic long-term external archive or longer server retention was enabled by this change. Silent/no-event dates do not prove successful collection or zero visits.

Activation still requires the administrator address, real Access policy, R8 notice/retention/legal-technical review and infrastructure configuration checks. Adding export buttons does not close these gates.
