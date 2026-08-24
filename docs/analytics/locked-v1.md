# JUMVI analytics — Locked v1

This is the reference document for the analytics system as of the "Locked
v1" R&D dashboard follow-up: what it measures, what it deliberately does
not, and why. If you're adding a new event or changing the panel, read this
first — then update it alongside your change.

## 1. Privacy invariants (hard, non-negotiable)

These are enforced by two automated tests, not just this document:
`tools/check-beacon-schema.mjs` and `tools/check-analytics-compliance.mjs`,
both run on every change to the analytics code paths.

- **No identity, ever.** No child name, parent name, email, phone, address,
  profile id, team id, Amazon order id, Amazon buyer id, review
  status/rating/text, exact birthdate, GPS, IP address, or persistent
  device id/UUID/fingerprint reaches any column. `src/worker.js`'s
  `buildDataPoint()` builds every row from a hardcoded switch statement —
  extra properties in the payload are read never, not filtered; the column
  layout comes from this file, not from what the client sent.
- **No request-level identity signals.** `src/worker.js` never reads
  `request.cf`, `CF-Connecting-IP`, `User-Agent`, `Referer`, or cookies. The
  only header it ever reads is `Authorization`, for the `/analiz` password
  gate — unrelated to analytics.
- **No review solicitation, no review tracking.** There is no
  `review_prompt_shown`, no star-rating capture, no "enjoying JUMVI? leave a
  review" flow, and no logic that routes a "happy" vs "unhappy" user
  differently based on behavior. `tools/check-beacon-schema.mjs` asserts a
  `review_prompt_shown` payload is rejected by the Worker; it was never
  wired client-side to begin with.
- **No third-party trackers.** No Meta/Facebook Pixel, Google
  Analytics/Ads/GTM, TikTok Pixel, Hotjar, or session-replay vendor is
  loaded anywhere in the shipped app. `trackEvent()` in `app.js` is a
  **dormant** Plausible marker (see §2) — Plausible itself was removed
  years ago and nothing loads it.
- **Everything is fire-and-forget.** A dropped beacon, a failed write, an
  unreachable endpoint — none of it can break gameplay. `beacon()` and the
  Worker's `writeDataPoint()` call are both wrapped in empty-catch `try`
  blocks on purpose.
- **The Worker is the security boundary, not the client.** `app.js`'s
  `BEACON_EVENTS` Set is a courtesy (skip pointless network calls for events
  the server will reject anyway) — the actual defense is
  `buildDataPoint()`'s switch statement in `src/worker.js`, which is public
  and must assume a hostile client.

## 2. `trackEvent()` vs `beacon()` — two different, unrelated systems

`app.js` has two analytics-shaped functions with easily confused roles:

- **`trackEvent(name, props)`** — calls `window.plausible(...)` if it
  exists. It never does: Plausible was removed in Faz 0, no script tag
  loads it, and the CSP wouldn't allow it if one tried. Every one of its
  ~48 call sites (plus the 3D hub's `track()` bridge) is a **no-op**, kept
  in place as a historical marker of what was once measured. **Never wire
  this to the beacon** — routing 48 legacy names into a 35-event
  server-enforced allowlist would blow past it on day one.
- **`beacon(name, props)`** / **`beaconOnce(key, name, props)`** — the real,
  first-party pipeline. Posts to `/api/beacon`, which `src/worker.js`
  validates against its own allowlist before writing to Analytics Engine.
  This is the only system that reaches a server.

One naming collision exists on purpose: `first_mission_start` is both a
dormant `trackEvent()` call (from an earlier hub-vs-2D funnel experiment)
**and** a real `beacon()` call added in Locked v1, fired at the same call
site in `openMission()`. They don't interact — one goes nowhere, the other
goes to WAE.

## 3. Event taxonomy

### Active — measured today, preserved by the weekly snapshot

| Event | Prop | Notes |
|---|---|---|
| `app_open` | — | once/session |
| `app_first_open` | — | once/device, forever (reach) |
| `return_visit` | `n` ∈ {2,3,5,10} | retention thresholds only |
| `welcome_complete` | — | once/device, forever (activation funnel) |
| `mission_start` | `id` | once/mission/session |
| `mission_complete` | `id` | |
| `mission_entry` | `id`, `source` ∈ {today,browse,random,resume,coach,island} | every open, not de-duped |
| `mission_unfinished_exit` | `id` | deliberate exit only — see §4 |
| `mission_undo` | — | the 5s Undo on a completion |
| `first_mission_start` | — | once/device, forever |
| `first_mission_complete` | — | once/device, forever |
| `timer_start` | `id` (in `double1`) | |
| `help_open` | `reason` (6-value enum) | in-mission help panel |
| `player_count` | `n` ∈ {2,3,4} | |
| `pack_view` / `pack_complete` | `pack` (6-value enum) | |
| `badge_earned` | `badge` (11-value enum) | |
| `daily_pick_tap` | — | Today card / Coach Pick tap |
| `certificate_made` | — | |
| `share_tap` | `channel` ∈ {whatsapp,native,copy} | |
| `speak_on` | — | read-aloud enabled |
| `score_saved` | — | |
| `dashboard_open` | — | Family tab opened (see §5 on the label) |
| `missionbook_get` | — | |
| `profile_add` / `profile_delete` | — | event only, never a name |
| `progress_reset` | — | |
| `team_create` | `kind` ∈ {adult,sibling} | shape of the pairing, never who |
| `team_switch` | — | |
| `level_up` | `level` ∈ {2..7} | |
| `hub3d` | `step` (7-value enum) | Leo's Island funnel |
| `product_care_open` | `topic` (7-value enum) | see §6 for why 7, not the originally proposed 9 |
| `home_add_tap` | — | install **intent**, not observed success — see §7 |
| `standalone_open` | — | once/session |

### Legacy — accepted by the Worker (append-only contract), nothing emits it

| Event | Why it's frozen, not deleted |
|---|---|
| `quickplay_start` | Play Modes / Quick Play was removed from the product entirely (`play-modes.js` and friends deleted — see the comment above `BEACON_EVENTS` in `app.js`). Removing the Worker case would be a schema rename, which the frozen-schema rule forbids; a stray/replayed row must still be countable, not silently dropped. `generate-weekly-snapshot.mjs` still queries it, into `legacy`, not `features` — the panel never presents it as a live feature. |

`tools/check-event-coverage.mjs` fails CI if a new event is added to the
Worker's allowlist without an explicit decision recorded in that file's
`SNAPSHOT_HANDLED` or `LEGACY_EVENTS` — see that file's own header for the
incident that motivated it: `generate-weekly-snapshot.mjs` silently did not
preserve seven already-live events (`welcome_complete`, `quickplay_start`,
`team_create`, `team_switch`, `profile_delete`, `mission_undo`, `level_up`)
for an unknown number of weeks before this fix, and their pre-fix rows are
gone for good once WAE's 90-day window closes.

## 4. Why `mission_unfinished_exit` never fires on backgrounding

JUMVI's entire premise is "read the mission, then put the phone down and go
play." If closing the mission view on `visibilitychange`/tab-hide/phone-lock
counted as an "unfinished exit," the single most common healthy interaction
with this product — reading a mission, locking the phone, playing outside,
coming back later to mark it done — would look identical to abandonment in
every chart.

`app.js`'s `visibilitychange` handler pauses the timer, cancels narration,
and stops any active TTS/RLGL audio — it never calls `closeMission()`.
`mission_unfinished_exit` is wired **inside** `closeMission()`, which only
ever runs from a deliberate product control: the Close/Back button, the
in-app history-back gesture, or a Next/Random flow that closes the current
mission before opening another. A per-open-cycle flag
(`_missionExitBeaconed`, reset in `openMission()`) prevents a double-fire if
`closeMission()` is somehow invoked twice for the same close.

## 5. `dashboard_open` → "Family / progress opened"

The event name is frozen (renaming it would split history), but what it
measures moved: the "stats" tab was retired as a bottom-nav destination and
its content — badges, family progress, teams — now lives on the tab
labeled **Family** internally called `modes` for historical reasons
(`app.js`'s `switchTab()` still remaps a legacy `stats` deep link to
`modes`). The panel labels this event "Aile / ilerleme açıldı" rather than
the old "Ebeveyn paneli" ("parent panel"), matching what a reader would
actually see if they opened the app today.

## 6. `product_care_open` — 7 topics, not the 9 originally proposed

An earlier draft of this feature's spec proposed 9 topics
(`ball_not_sticking`, `ball_hard_to_remove`, `strap_fit`,
`missing_catches`, `need_more_space`, `instructions_unclear`,
`mission_too_hard`, `indoor_play`, `cleaning_storage`). Checked against the
actual current UI (`index.html`'s "Product Care & Quick Help" accordion in
Grown-ups), three of those don't correspond to any real Product Care item —
`need_more_space`, `instructions_unclear`, and `mission_too_hard` are
already `help_open`'s own reasons, fired from **inside a mission**, not
from Grown-ups. Meanwhile the real accordion has a 7th item with no
proposed topic at all: "Something is damaged or missing."

`PRODUCT_CARE_TOPICS` was built from the actual 7 `<details>` elements
instead: `ball_not_sticking`, `ball_hard_to_remove`, `strap_fit`,
`missing_catches`, `indoor_play`, `cleaning_storage`, `damaged_missing`.
Each element carries a `data-topic` attribute in `index.html`; `app.js`
binds one `toggle` listener per element and fires on open only (`<details>`
fires `toggle` on both open and close).

## 7. `home_add_tap` / `standalone_open` — intent and state, not success

Neither iOS Safari nor iOS Chrome/Firefox/Edge exposes a "the user actually
finished Add to Home Screen" event — only the app itself can observe, via
`display-mode: standalone`, that it's now running installed, and only on
the **next** launch, not the moment of installation. So:

- `home_add_tap` fires the instant `runInstallAction()` is invoked (a real
  tap on the install/instructions control), for **both** the Android/
  Chromium `beforeinstallprompt` path and the iOS manual-instructions path.
  It measures intent, never success.
- `standalone_open` fires once per session, at boot, if
  `matchMedia('(display-mode: standalone)').matches` (or iOS's
  `navigator.standalone`) is already true — a same-session signal that this
  launch is already installed.

Do not derive an "install conversion rate" from these two numbers; they
answer different questions on different timelines and were never designed
to be divided by each other.

## 8. Mission Lab: event ratio, not cohort conversion

`mission_start` and `mission_complete` are **not** user-linked — there is
no id connecting one device's start to that same device's complete. The
snapshot's `recorded_completion_ratio` (and the panel's per-mission
percentages) are `sum(completes) / sum(starts)` over the whole population
for the week, which can legitimately exceed 100% (a mission started the
previous week and completed this week, multiple short replays, etc.). The
panel states this explicitly next to the mission grid and never calls a
weak ratio "bad" — missions below `CONFIG.minStartsForAlert` (5) don't
alert at all, and a below-average one is labeled "inceleme adayı"
(investigation candidate), not a definitive verdict.

## 9. `mission_entry` scope: by-source counts, not the full cross-tab

`mission_entry_sources` in the snapshot is a flat count by source (today /
browse / random / resume / coach / island) for the whole week. A
per-mission × per-source breakdown ("how many people found mission 7 via
Random specifically") is **not** computed in this version — it would be a
second GROUP BY dimension on top of an already-large per-mission map, and
there isn't yet real traffic to validate that the extra complexity is
worth it. The raw `mission_entry` rows carry both `id` (in `double1`) and
`source` (in `blob2`) and sit in Analytics Engine for 90 days regardless,
so that finer breakdown can be added to a future snapshot schema version
without losing anything, as long as it ships before the 90-day window on
the weeks it would apply to.

## 10. Amazon / units-sold safety

If a manual `unitsSold` figure is ever entered into the panel's `CONFIG`
block, it is a single, hand-typed **aggregate** number ("142 units sold
this week") — never order-level data, never joined to `app_first_opens` at
the row level. Any resulting percentage in the funnel is always rendered
with a "yönsel tahmin" (directional estimate) qualifier inline; see
`renderFunnel()` in `assets/analiz/index.html`. `app_first_opens` itself is
never labeled "customers," "unique buyers," or "unique people" anywhere in
this codebase — see the methodology note embedded in every snapshot file.

## 11. Snapshot schema versions

- **v1/v2** (Faz 1/2): the original funnel + content/feature events +
  reach/retention + Faz 2F family counters. Files on disk at this schema
  are **not** rewritten when the generator changes — a v3-only field simply
  doesn't exist in them.
- **v3** (Locked v1): adds `activation_milestones`, `family`,
  `mission_entry_sources`, `product_care_topics`, `legacy`, and an `exits`
  field per mission inside the existing `missions` map. The panel checks
  `snapshot_schema >= 3` (`hasV3()`) before rendering any v3-only section
  and shows "bu şema sürümünde yok" ("not available in this snapshot
  schema") instead of a fabricated zero when it isn't.

## 12. Backfilling 2026-33 / 2026-34

Neither week's snapshot exists yet as of this document. To generate them
(after this PR merges and the required secret/repo-setting are in place —
see the PR description):

```bash
# Locally, with CLOUDFLARE_API_TOKEN set (or `wrangler login` first):
node tools/generate-weekly-snapshot.mjs --week 2026-33
node tools/generate-weekly-snapshot.mjs --week 2026-34
```

Or, from GitHub: Actions → "Weekly Analytics Snapshot" → **Run workflow** →
set the `week` input to `2026-33` (then run again for `2026-34`). Each run
opens (or force-pushes onto an already-open) a PR with the new snapshot —
review the numbers, then merge; this workflow never merges on its own.
