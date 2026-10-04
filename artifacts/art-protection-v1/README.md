# JUMVI delivery artwork protection v1

Authorized by user on 2026-10-04: add permanent JUMVI imprints by code, without redrawing accepted equipment/mechanics. The approved source files under assets/mission-illustrations remain byte-identical.

Only the 68 currently referenced mission images plus the product-still fallback are protected delivery candidates (69 total). The original JUMVI header wordmark is exempt. The build copies these derivatives, verifies source and derivative hashes, publishes matching dimensions/hash metadata, and does not ship unused/rejected source artwork. Canonical records and presentation mappings are unchanged.

Each copy has two small translucent JUMVI perimeter marks and XMP brand/reuse-contact information. The generator verifies every decoded pixel outside the imprint alpha mask, including transparency. No resizing, mirroring or generated pose changes occur. All derivatives are lossless WebP with the original dimensions. CI uses committed, hashed copies; it does not regenerate images with machine-dependent fonts.

This is attribution/deterrence, NOT DRM or an invisible forensic watermark. Cropping, editing and screenshots remain possible. Metadata can be removed. Prior releases, previously downloaded/cache copies and the supplied branded PDFs may contain extractable unmarked illustrations. Repository visibility was verified PUBLIC on 2026-10-04; originals and Git history remain accessible there. Making the current deployment use derivatives does not protect a public source repository. Repository visibility requires a separate reviewed change. Existing root experience and old-tab compatibility are not revoked. Search exclusion and request-burst rules remain separate controls; no new bot/captcha, purchase gate or visitor fingerprint is introduced.

To regenerate after an approved source edit: use tools/watermark-art.py with Pillow and the pinned local font. Update allowlist from the actual criticalPaths graph, review visible results, then build. A new source hash must never silently reuse an old derivative.
