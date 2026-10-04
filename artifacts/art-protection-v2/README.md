# JUMVI delivery artwork protection v2

User-authorized 2026-10-04. 69 current/fallback images retain the reviewed corner branding and XMP attribution, and add a keyed, reference-assisted DCT ownership signal. This is not DRM, an authorship certificate, tracking or authentication. No customer identifiers are embedded. Each signal is bound to a fixed asset path and a private local key, not a visitor.

The original accepted assets and v1 visible-branded copies are retained unchanged. Alpha and dimensions remain exact relative to v1. Hidden RGB changes are bounded to 4 levels out of 255 (observed maximum 3); minimum observed PSNR 47.731 dB. No mirroring, resizing, cropping or generated pose change occurs. The marker does change pixel values: v1's outside-stamp pixel-equality claim does not apply to v2. Delivery adds approximately 0.93 MB across the full 69-image set, not to the first screen alone.

## Generation and later comparison

Run `tools/protect-art-v2.py` with Pillow/NumPy and an explicit `--key-file` and `--evidence-dir`, both outside this checkout. The key must be a locally generated 32-byte file with owner-only access. It is never sent to GitHub, CI, Cloudflare or the app. Release builds consume pinned verified WebP derivatives; they need no watermark key or Python installation.

Use `tools/verify-art-mark.py --key-file PRIVATE_FILE --asset EXACT_MANIFEST_PATH --candidate SUSPECT_IMAGE` for a local comparison. Retain both the key and original reference; losing them prevents verification. Keep an owner-controlled encrypted backup separately. No cloud backup or external registration was performed.

## Evidence and limits

All 69 assets passed: original lossless export, metadata removal to PNG, JPEG qualities 90/75, whole-image resizing to 75%/50% with known-size realignment, and removal of the top/bottom 8% on an unchanged canvas. All four negative controls per asset stayed negative: unmarked, wrong key, unmarked JPEG75 and unmarked resize50. Full correlation/gain evidence remains local. These bounded tests are not universal attack-resistance or a false-positive-rate guarantee. Cropping with unknown alignment, screenshots with perspective/UI, repainting, heavy recompression or deliberate removal can defeat detection. A positive is supporting evidence only; a negative is inconclusive.

## Other layers

`src/art-delivery-policy.mjs` rejects explicit foreign image embedding (including WebP) and sets CORP/nosniff. Same-site app/PWA/Service Worker reads and referrer-free direct requests stay available. PDFs and QR entry navigation remain shareable. Referrers can be forged/omitted, so this is deterrence, not purchase authentication. Frame restrictions discourage foreign iframe clones. No right-click, keyboard, zoom, text selection or screen-reader blocking is added.

Current delivery excludes unused/rejected source images. Existing noindex and excessive-burst Cloudflare rules are separate layers. PDFs retain their original supplied bytes and branding; embedded PDF illustrations can still be extracted. Prior downloads, caches and old compatibility artifacts cannot be revoked by this change. The public GitHub repository still exposes unmarked source/history until GitHub Pro enables private-repository deployment environments. Do not bypass environment controls or rewrite Git history to hide this gap. Legacy GitHub Pages was separately disabled, with settings retained in the local change receipt.

Rollback: use the last successful V2 Worker version and matching manifest; do not regenerate accepted masters or publish the private key. The v1 visible-branded delivery artifacts remain available in Git for recovery.
