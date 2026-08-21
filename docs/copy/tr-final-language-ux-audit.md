# JUMVI Final Turkish Language + UX Audit

Baseline: `80b2ff167b25ef8f1cfff30d72ed0507a72fd0f3`; cache target: v240.

## Executive Summary

Reviewed 514 Turkish user-facing strings across the shell, mission data,
onboarding, family, grown-up, accessibility, TTS labels, and 36 illustrations.
497 are kept, 9 safe changes are implemented, 3 shared brand tokens are
intentional English, and 5 subjective tone choices remain review-later.
Certificate and Mission Book remain separate binary-asset review gates.

Recurring issues were a few overly cute/marketing-like parent tips and English
text inside shared mission diagrams. The runtime Turkish layer now localizes
the instructional Mission 15 and Mission 28 surfaces without duplicating art.

## Turkish Style Guide

- Put the physical action first; use short, everyday Türkiye Turkish.
- Prefer `at`, `yakala`, `bir adım geri git`, and `tekrar dene` over formal
  instructional language.
- Keep safety calm, literal, and short. Use all caps only for real game calls.
- Use `oyuncu` generally, `arkadaş` for a two-player turn, and `takım arkadaşı`
  for a team role. Keep warmth in helpful tips, not functional controls.

## Mission Audit

All 36 mission title, three-step, win, safety, and tip fields were reviewed
for mechanical parity, spoken naturalness, and `tr-TR` TTS. IDs, pack keys,
counts, timing, ages, equipment, and sequence are unchanged.

| IDs | Decision | Implemented Turkish copy |
| --- | --- | --- |
| 1 | CHANGE-SAFE | Daha küçük bir çocukla oynuyorsanız yavaşlayın; önce eğlence. |
| 6 | CHANGE-SAFE | Yüksek sesle saymak, sayıları pratik etmenin eğlenceli bir yoludur. |
| 10 | CHANGE-SAFE | Atarken yumuşakça öne adım atın, sonra arkadaşınızın sırası için başlangıca dönün. |
| 15 | CHANGE-SAFE | Yüksek sesle söylemek, gözlerinizi topta tutmanıza yardımcı olur. |
| 16 | CHANGE-SAFE | Düzenli saymak zamanlamayı kolaylaştırır. |
| 18 | CHANGE-SAFE | Daha küçük oyuncular için harika bir ilk görev; her yakalamada özgüven kazanırlar. |
| 19 | CHANGE-SAFE | Dört raket ve dört oyuncuyla keyifli bir grup oyunu olur. |
| 2–5, 7–9, 11–14, 17, 20–36 | KEEP | Existing Turkish remains natural and mechanically clear. |

## UI Audit

Onboarding, mission controls, family, grown-up, install, offline, privacy,
certificate, island, and RLGL strings were reviewed. One family helper is
improved: `Kazandıklarına göz at`. `Hızlıca yardım al.` is kept. Turkish
metadata, manifest, routing, `lang=tr`, and `Content-Language: tr` remain in
the Worker path.

## Illustration Localization Audit

**36/36 illustrations reviewed.** Geometry, equipment, ball count, and motion
markup are unchanged. The `/tr` DOM map localizes all 99 language-bearing
illustration tokens without changing English source drawings; the deterministic
coverage check reports zero unmapped tokens.

- Mission 15 bubble: `I SEE IT!` → `GÖRDÜM!`; its two-state physical sequence
  remains unchanged.
- Mission 28 retains exactly three slides, scroll snap, controls, live region,
  and reset-on-open behavior. Directions, captions, titles, descriptions,
  controls, and slide labels have Turkish mappings.
- Mission 35 geometry is unchanged; no textual localization is required.
- `tools/check-tr-illustrations.mjs` guards 36 entries and the M15/M28
  instructional/accessibility mapping contract.

## Static Asset Audit

- **Certificate:** `STATIC_ASSET_REVIEW_REQUIRED`. The Turkish template exists
  at the required dimensions, but the gold `BAŞARDIN!` plaque retains a visible
  cleanup artifact documented in `docs/audits/tr-static-assets.md`.
- **Mission Book:** `BLOCKED_ASSET_REVIEW`. `/tr/mission-book.pdf` is absent;
  a correct 21-page Turkish PDF requires a Turkish embedded font and visual
  validation of every page. An English fallback is not treated as complete.

## Validation

`tr-TR` speech is retained by the locale wrapper; the Turkish path does not
call English prerecorded Coach Leo audio. No Turkish audio was generated.
No product-wide `3–8` claim remains in runtime Turkish copy; the product range
is 3–12 and mission-specific minimum ages remain mission-specific.
