# Menu and certificate local review

User asked for more useful menus, ElevenLabs coach recordings, and the existing qr.jumvi.co certificate. User subsequently explicitly deferred audio: “şimdilik sesi geçelim”. No new speech/audio was created or added. ElevenLabs UI was signed in, showed unpaid-invoice warning and 17,001 credits; attempts in v3 and recommended Multilingual v2 returned no output. Billing causality is not proved. No payment, new credential or billing change was performed.

## Implementation
- Discovery supports title search (Turkish locale-aware case matching) and 2/3/4-player filters derived solely from existing canonical player metadata. All missions remain accessible by clearing filters. No skill taxonomy, new mission rule, required profile or recommendation inference introduced.
- Filters are transient module state per locale, retained on in-app/browser return. Nothing sent in URL, network payload or telemetry. A single-column form uses existing color/spacing/child touch tokens. Each repeated Open mission control has a mission-specific accessible name.
- Certificate artwork derives from the repository's existing legacy TR star template, also visually verified at https://qr.jumvi.co/tr/certificate-template.webp in Chrome. This is **an adapted background, not byte-identical use**: old claims/age text removed using imagegen; original assets untouched. PNG text and nickname drawn locally; TR/EN explanatory scope retained. No score/star tracking or measured skill claim introduced. Previously approved 36 distinct V2 completion reports per local player remains unchanged.
- Build includes certificate as a release-addressed asset, with integrity-controlled SW runtime caching; it stays optional to Start. Offline rendering checked after its first verified fetch. No new server endpoint, network nickname transmission, or remote profile.

## Evidence / limits
- Chrome UI: search Heykel → open m05 → browser Back preserved query and matching result.
- Browser automation: TR/EN search, player filtering, clearing, return, 320/200% root-text reflow; certificate 35/36 gate, correction revocation, PNG, privacy and offline.
- Existing original template files retained. Derived raster is a presentation candidate; generated cleanup is not pixel identity proof.
- Real phone/child/field and actual browser-zoom tests are not newly performed. This is no visual acceptance or M6 PASS.
- Local isolated branch only; no push/staging/production deployment and no route/config change.

## Validation results
- 53/53 contracts/accessibility-structure/isolation tests pass on final source.
- 14/14 focused Chromium/WebKit menu/certificate/privacy/offline tests pass on final source, including child input height ≥56 CSS px, 320/200% root-text and browser Back filter retention.
- 46/46 catalogue/reflow/navigation regression tests passed in both engines before the final menu-only minimum-height token adjustment; affected menu cases then rerun in the 14 final tests. No new browser zoom/real-device result inferred.
- Root local test package: dd815f85d403d9f7. V2 local package: 272ddcaccf45c507,555 public files.
- Synthetic certificate PNG is explicitly named QA ÖRNEK; it is not a real customer's accomplishment.
