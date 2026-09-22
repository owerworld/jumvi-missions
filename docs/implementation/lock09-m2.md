# M2 — First physical play slice

Scope: HF-01/03/04/05/06/07, m25 **development fixture**, LOCK 07 premium full-frame illustration derivatives, LOCK 06 tokens/font/icons, and LOCK 08 explicit state/audio behavior. This is not acceptance of a canonical 36-mission catalogue or a production translation.

- `content/missions/m25.json`: TR/EN-US copy copied verbatim from the CP dictionary in the approved premium renderer. EN-US remains a visual/development fixture. HF-05/06 operational EN text is implementation copy requiring later catalogue/i18n review.
- `content/asset-manifest.json`: four approved masters, original SHA-256, proportional 720×480 derivatives and output hashes. No crop, redrawing, product geometry change or new physical rule. PNG masters remain in the external locked package. WebP is lossless after proportional Lanczos downsampling (four derivatives total 1,223,294 bytes).
- Atkinson Hyperlegible Next source TTF and OFL are preserved; Lucide icons use the exact LOCK 06 tree/blob identities and shipped license.
- Three instruction illustrations are critical for this fixture. Text renders before illustration readiness; Start/Resume cannot bypass missing guidance. Optional result portrait and absent recorded narration do not gate play. Retry does not steal focus or reset the round.
- Start creates one digital round. Stop is immediate, with no confirmation, and leaves a persistent explicit Resume path. Resume preserves the round ID. Replay is a separate explicit intent. Help returns to the current valid state and originating control, including WebKit pointer activation.
- Report is an explicit complete/early declaration, available without Start. Correction keeps the report identity with a new revision. Report never creates a personal record. Early-stop response never claims completion. Real report loss on Leave/Replay uses C-17; Stop never does.
- `resume.js` writes a minimal, versioned, tab-scoped round summary only. No report, player, name or attribution is persisted. Corrupt, denied or mismatched storage has honest recovery. Reload/Back/hidden never auto-start or infer success. Legacy storage is neither read nor rewritten by this slice.
- `AudioController` separates preference and playback. There is no accepted recorded audio asset, so runtime exposes the approved unavailable/off behavior. No legacy narration, browser TTS, microphone, caller, timer, haptic or wake lock is connected. Synthetic media tests cover pending cancellation, late fulfillment/rejection, overlap and normal ending. Runtime audio requests are explicit; HF-07 has no Sound control.
- No SW is registered. Offline/migration, local record repository and the remaining views retain their milestone boundaries.

## Verification boundary

Node tests cover isolation/state/audio/resume semantics. Chromium and WebKit browser contracts cover first play, focus, help/stop/resume, reports/correction/discard, reload/Back/hidden, blocked storage, missing/slow critical art, duplicate/drag input, untouched synthetic legacy storage and TR/EN responsive geometry. 200% testing uses a 32px root font; it is an emulation, not physical-device or assistive-technology proof.

Real child, physical-product, outdoor and VoiceOver/TalkBack tests remain open. HF-01 Start is below the initial viewport by the approved content hierarchy; no safety text is hidden or shrunk. Large-text HF-04 controls remain in normal scroll flow. Actual device access remains R5, not a passed test here.

## M3 entry gate

LOCK 09 §7 (line 183) and §17 R3, LOCK 07 premium exclusions, LOCK 08 HF-08a/14a/17a exclusions, and the human LOCK 09 register entry leave unresolved: minimum player fields, data notice/purpose, retention/deletion (including pending operation envelopes), and conditional real authorization/protection. No later human decision closes these in the supplied instructions. M3 must stop as **HUMAN DECISION REQUIRED — R3**. No name, age, PIN, date of birth, consent mechanism or indefinite retention is invented. M4–M6 cannot be skipped ahead to under the sequential master instruction.

## Real staging regression closed

Live smoke found that the default Cloudflare HTML canonicalization redirected the adapter's `/tr/index.html` fetch back to `/tr/`, creating a loop. The local file server had not reproduced that platform behavior. Staging now sets `assets.html_handling: "none"` and maps only the explicit English/Turkish entry paths to their HTML files; unrecognized paths remain 404. A route regression contract plus actual Wrangler local and live staging checks verify it. Production configuration remains unchanged. Reference: https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/
