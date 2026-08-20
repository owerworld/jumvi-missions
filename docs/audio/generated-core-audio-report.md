# Coach Leo v3 core English audio report

Date: 2026-08-21

## Generation configuration

- Voice ID: `1gbH6VxjZn6Gd7Kpz9qh`
- Voice name: `Coach Leo v1`
- Model: `eleven_v3`
- Output format: `mp3_44100_128`
- Voice settings: omitted from every request so ElevenLabs applied the voice's stored settings.

## Result

- Generated correct: **48**
- Replaced invalid: **31**
- Newly added: **17**
- Skipped existing production: **39** (35 mission narrations and 4 RLGL cues)
- Failed: **0**
- Optional clarification clips generated: **0**
- Turkish clips generated: **0**

## Final core inventory

### Mission coaching (40)

```text
assets/audio/coach-leo/en/mission-coaching/01-speed-demon-en.mp3
assets/audio/coach-leo/en/mission-coaching/03-quick-slap-en.mp3
assets/audio/coach-leo/en/mission-coaching/04-switcharoo-en.mp3
assets/audio/coach-leo/en/mission-coaching/05-statue-mode-en.mp3
assets/audio/coach-leo/en/mission-coaching/06-number-echo-en.mp3
assets/audio/coach-leo/en/mission-coaching/07-rainbow-throws-en.mp3
assets/audio/coach-leo/en/mission-coaching/08-the-landing-pad-en.mp3
assets/audio/coach-leo/en/mission-coaching/09-step-back-challenge-en.mp3
assets/audio/coach-leo/en/mission-coaching/10-power-step-en.mp3
assets/audio/coach-leo/en/mission-coaching/11-sky-floater-en.mp3
assets/audio/coach-leo/en/mission-coaching/12-heart-high-en.mp3
assets/audio/coach-leo/en/mission-coaching/14-tempo-master-en.mp3
assets/audio/coach-leo/en/mission-coaching/15-spotlight-eyes-en.mp3
assets/audio/coach-leo/en/mission-coaching/16-1-2-3-go-en.mp3
assets/audio/coach-leo/en/mission-coaching/17-mirror-mode-en.mp3
assets/audio/coach-leo/en/mission-coaching/18-count-to-10-en.mp3
assets/audio/coach-leo/en/mission-coaching/19-round-robin-a-en.mp3
assets/audio/coach-leo/en/mission-coaching/19-round-robin-b-en.mp3
assets/audio/coach-leo/en/mission-coaching/20-crab-walk-relay-a-en.mp3
assets/audio/coach-leo/en/mission-coaching/20-crab-walk-relay-b-en.mp3
assets/audio/coach-leo/en/mission-coaching/21-captain-says-a-en.mp3
assets/audio/coach-leo/en/mission-coaching/21-captain-says-b-en.mp3
assets/audio/coach-leo/en/mission-coaching/22-spin-squad-a-en.mp3
assets/audio/coach-leo/en/mission-coaching/22-spin-squad-b-en.mp3
assets/audio/coach-leo/en/mission-coaching/23-mix-it-up-a-en.mp3
assets/audio/coach-leo/en/mission-coaching/23-mix-it-up-b-en.mp3
assets/audio/coach-leo/en/mission-coaching/24-2v2-squad-count-a-en.mp3
assets/audio/coach-leo/en/mission-coaching/24-2v2-squad-count-b-en.mp3
assets/audio/coach-leo/en/mission-coaching/25-chill-catch-en.mp3
assets/audio/coach-leo/en/mission-coaching/26-tiny-space-en.mp3
assets/audio/coach-leo/en/mission-coaching/27-secret-signal-en.mp3
assets/audio/coach-leo/en/mission-coaching/28-mind-reader-en.mp3
assets/audio/coach-leo/en/mission-coaching/29-stuck-foot-catch-en.mp3
assets/audio/coach-leo/en/mission-coaching/30-left-or-right-en.mp3
assets/audio/coach-leo/en/mission-coaching/31-cloud-chaser-en.mp3
assets/audio/coach-leo/en/mission-coaching/32-home-base-en.mp3
assets/audio/coach-leo/en/mission-coaching/33-how-far-can-you-throw-en.mp3
assets/audio/coach-leo/en/mission-coaching/34-chase-the-ball-en.mp3
assets/audio/coach-leo/en/mission-coaching/35-sky-high-jump-en.mp3
assets/audio/coach-leo/en/mission-coaching/36-marathon-rally-en.mp3
```

### Mission, system, countdown, and hub (8)

```text
assets/audio/coach-leo/en/missions/13-silent-mode-en.mp3
assets/audio/coach-leo/en/system/times-up-check-phone-en.mp3
assets/audio/coach-leo/en/game-cues/countdown-3-en.mp3
assets/audio/coach-leo/en/game-cues/countdown-2-en.mp3
assets/audio/coach-leo/en/game-cues/countdown-1-en.mp3
assets/audio/coach-leo/en/game-cues/countdown-go-en.mp3
assets/audio/coach-leo/en/hub/hub-greeting-1-en.mp3
assets/audio/coach-leo/en/hub/hub-bubble-1-en.mp3
```

## QA

- All 48 core files exist, are non-empty MP3, 44.1 kHz mono, 128 kbps, and have non-zero sane durations.
- SHA-256 verification found no duplicate files in the 48-asset core set.
- `node tools/check-coach-leo-audio.mjs`, JavaScript syntax checks, and cache-lock validation passed.
- Interactive mobile runtime checks at 390×844 and 320 px are pending final human QA: the local browser surface was blocked by an enforced security check, and was not bypassed.
- The 39 pre-existing production narration/RLGL files were not modified.
- Cache version moved from `jumvi-missions-v237` to `jumvi-missions-v238`; versioned script URLs were updated for returning browsers.

Ready for final human audio QA; no merge or deployment was performed.
