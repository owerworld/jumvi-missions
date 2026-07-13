# Coach Leo Onboarding Tour

An animated, once-per-device guided tour (coachmark / spotlight) shown to first-time
visitors on the home screen. Vanilla JS + CSS keyframes — **zero runtime dependencies**.

## Files
- `leo-tour.js` — self-initialising tour engine (inline flat-vector Coach Leo SVG,
  spotlight, steps, analytics, a11y). Loaded `defer` from `index.html`.
- `leo-tour.css` — all styling + keyframe animation (no inline styles).
- Precached in `service-worker.js` (`CORE_ASSETS`).

## Behaviour
- Triggers on the first visit to the home screen, after the welcome/age overlay is
  gone + a ~600 ms delay. Shows **once per device**, then never again.
- Steps (max 5): Welcome → Missions → Badges → Certificate → 3D teaser.
  Each step resolves its target from an ordered selector list and spotlights the
  first **visible** one; a step with no visible target auto-skips silently
  (e.g. the 3D teaser when no 3D entry point exists in the DOM).
- Fully skippable: **Skip tour** button, **Esc**, or tapping the dark overlay.
- Respects `prefers-reduced-motion` (static Leo, instant transitions, still usable).
- "Replay Coach Leo tour" is injected into Profile → Settings (if that UI exists).

## Persistence (COPPA)
- Only a **device-level** localStorage flag: `jumvi_tour_done=1`.
  Shared across child profiles — switching profiles does **not** re-trigger it.
- No PII, no new data collection.

## Analytics (Plausible, existing setup)
- `tour_started`, `tour_step` `{ step }`, `tour_completed`, `tour_skipped` `{ step }`.

## Testing
Reset the flag to see the tour again:

```js
localStorage.removeItem('jumvi_tour_done')
```

Or drive it manually from the console:

```js
window.leoTour.reset();   // clear the flag
window.leoTour.start();   // show the tour now
```
