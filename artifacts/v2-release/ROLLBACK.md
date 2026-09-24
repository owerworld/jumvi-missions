# V2 coexistence release / withdrawal

Status: prepared locally, not a live deployment ID. Root baseline is Worker `jumvi-missions`, version `efe6de8e-ca56-4ece-986e-a2485198af0a`, source `03f70223f59d020a5c6ddc3b226c8ccb54218eb7`. This baseline is NOT the V2 rollback target.

## Release boundaries

- Existing qr.jumvi.co Custom Domain stays on `jumvi-missions`. No main merge or deploy.
- Separate fixed Worker `jumvi-missions-v2-review`; proposed route `https://qr.jumvi.co/v2*` because Cloudflare route matches include queries. Application exact-path guard handles only `/v2` and `/v2/…`. Lookalikes `/v20`, `/v2-old` use unchanged same-host fetch to the existing Custom Domain Worker, no V2 headers, redirects or assets. Unit checks preserve original Request/response. Cloudflare edge behavior still requires rehearsal before this route is installed.
- Separate compatibility Worker `jumvi-v2-legacy-compat` proposed route `https://qr.jumvi.co/service-worker.js*`. Only exact pathname `/service-worker.js` is changed, including old `?v=` script URLs. Lookalikes return to existing same-host origin. Allowed body change: the separately hashed compatibility service worker only. Allowed headers: JavaScript MIME, no-store, Service-Worker-Allowed `/`, nosniff. No main/root app source changes.
- Compatibility patch preserves CORE_ASSETS, skips V2 requests and only deletes its own legacy-version caches. Initial original-v254 visit is separately protected with Vary:* on V2 responses; Cache.put rejects those writes. V2 strips Vary:* only on byte/hash/MIME-verified public responses in its own namespace.
- No new analytics, production data/secret, authenticated proxy, or same-origin security-isolation claim.

## Before release

Record exact commit; artifact manifest hash; review/compat/withdrawn Worker bundle hashes; route IDs and before-state; active root version/count/traffic; ten legacy public hashes; actual token resource scope; GitHub environment branch policy and checks; exact staging artifact verification. `gates.json` must contain actual evidence, not a renamed status. CI compares configured exact SHA + artifact, runs both engines and staging verification before deployment. Missing environment/credential or open mandatory human gate means no live deploy.

## Safe withdrawal

Keep the existing root Custom Domain and compatibility SW route. Deploy the prebuilt `wrangler.v2.withdrawn.json` artifact to the V2 Worker only; record its resulting version ID before release is considered rollback-ready. It returns HTTP410 for review entries but continues serving the reviewed SW and immutable versioned assets for open tabs. The V2 SW explicitly honors HTTP410 even with a previously cached shell. It does not clear IndexedDB, localStorage, other caches, or unregister the legacy worker. An already-open/offline V2 tab can keep running until online navigation: server rollback cannot revoke an offline document. Explain that limitation rather than forcing reload/data deletion.

Verify root and TR public bytes and offline copies, query aliases, V2 cached-page withdrawal, two tabs, legacy/V2 synthetic record preservation. Keep the compatibility SW available: blindly restoring original v254 can delete V2 caches on activation. Do not remove the V2 route while its installed worker/offline entries may still need the explicit withdrawal response. Never convert V2 IDB into legacy localStorage. Existing legacy UI will not show V2 histories; data remains for a later compatible release.

## Evidence and limits

Local Chromium/WebKit uses actual archived v254, preserved legacy shell hashes, synthetic legacy data, separate V2 IDB deletion, scoped worker, compatibility activation, TR/EN offline and cached-entry withdrawal. This is local same-origin proof, not live Cloudflare-route or physical phone acceptance. No live V2/compat/withdrawn version IDs exist yet. Do not call rollback READY until those exact artifacts and routes have been rehearsed on the authorized deployment path.

Sources: Cloudflare [routes](https://developers.cloudflare.com/workers/configuration/routing/routes/), [custom domains](https://developers.cloudflare.com/workers/configuration/routing/custom-domains/), [rollback limits](https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/); MDN [Cache.put](https://developer.mozilla.org/en-US/docs/Web/API/Cache/put).
