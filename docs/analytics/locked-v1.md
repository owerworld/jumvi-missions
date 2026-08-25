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
| `mission_entry` | `id`, `source` ∈ {today,browse,random,resume,coach,island,next,family,unknown} | every genuine entry, not de-duped — NOT fired on an internal same-mission refresh (see §9b) |
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
gone for good once WAE's three-month retention window closes (Cloudflare
documents this as a rolling retention period, not a guaranteed exact day
count).

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

## 9. `mission_entry` scope: total-by-source AND a full per-mission cross-tab

An earlier draft of this feature only kept `mission_entry_sources` — a flat
total by source for the whole week — and left "which mission gets found how"
uncomputed, reasoning that there wasn't yet real traffic to justify the
extra GROUP BY dimension. Review follow-up overturned that: "which mission
is found how" is exactly the kind of question this snapshot exists to
answer before the raw rows expire, and the cardinality is bounded (36
missions × 9 sources = 324 cells at most), so there's no real cost to
keeping it.

Every mission in the snapshot's `missions` map now carries an
`entry_sources` object with all 9 source counts (zero-filled, even for a
mission with no `mission_entry` rows at all — see `zeroEntrySources()` in
`tools/generate-weekly-snapshot.mjs`), alongside the unchanged top-level
`mission_entry_sources` total for the dashboard overview. Both come from
one query (`GROUP BY source, mission`) and one pure fold function,
`applyMissionEntryRows()`, unit-tested against a synthetic fixture in
`tools/check-mission-entry-sources.mjs`.

## 9b. Every production `openMission()` call site is explicitly classified

A previous version let an unclassified call silently default its
`mission_entry` source to `"browse"` — which would have quietly credited
the Browse tab with every call site nobody had gotten around to labeling.
Fixed by (1) auditing all 23 real `openMission()` call sites in `app.js`
and `jumvi-hub-app.js` and giving each one an explicit second argument, and
(2) changing the runtime fallback to `"unknown"`, which should now only
ever fire on a genuine bug.

A second, later correction went further: `openMission()` is not only used
for real navigation — 3 of the 23 call sites reuse it to refresh/re-render
the mission sheet that is **already open** (undo, un-mark done,
post-completion redraw), where no navigation happened at all. An earlier
pass here still fired a full `mission_entry` on those 3 sites, just labeled
`"unknown"` — which double-counted every undo or refresh as if it were a
fresh discovery. `openMission(id, source, opts)` now takes a third
`opts.trackEntry` argument (default `true`); the 3 refresh sites pass
`{ trackEntry: false }`, which skips both the `mission_entry` beacon and the
`_missionExitBeaconed` reset — an internal refresh must not let a
genuinely-abandoned visit fire `mission_unfinished_exit` a second time
either. `mission_start`, `first_mission_start`, and all timer/audio/UI
behavior are untouched by this — the gate wraps only the entry-analytics
block. See `tools/tr-qa/mission-entry-refresh.mjs` for the runtime proof.

Three enum values exist beyond the original six: `"next"` (the in-sheet
Next button, both the smart-pick and linear-fallback paths, outside a
hub-pack run — those stay `"island"`), `"family"` (the Family Board's
36-tile grid — a real, distinct discovery surface, not the Browse tab's
Mission Path), and `"unknown"` (the honest fallback for a genuine call site
that isn't one of the other eight — see the table below).

| Call site | Source | Why |
|---|---|---|
| Browse tab's Mission Path row tap | `browse` | The actual current Browse UI (v32 renamed the old vertical path to a compact list row; same missions, same order, same surface) |
| Legacy `#list` card tap (hidden, `applyBrowseView()` always shows the Path instead) | `browse` | Same surface, old renderer — kept for the rare case something still reaches it |
| Daily Play / Daily Replay / header "Play Today" buttons | `today` | The Today card's own controls |
| Welcome/onboarding → first mission after picking a level | `today` | Sets up and opens the same `dailyIdStored` mission the Today card would |
| Coach Pick card + its alt-suggestion link | `coach` | Explicit Coach Leo recommendation |
| Both "Random" buttons (from-pack, from-all) | `random` | |
| "Continue where you left off" (Resume) button | `resume` | |
| Leo's Island gate opening a mission; the in-hub pack "Next" flow | `island` | Only ever active while `window._hubMissionFlow` is set |
| The in-sheet "Next" button (smart pick, and its linear fallback) | `next` | Distinct from Island's own pack-aware "next", which stays `island` |
| Family Board's 36-tile grid | `family` | A real, distinct discovery surface — a genuine user tap into a mission, just not the Browse tab |
| Seasonal collection list (Indoor/Outdoor Edition) | `unknown` | A curated modal list, not Browse — real entry, no enum value dedicated to it yet |
| Mark-undone reopen; toggle-done "un-mark done" reopen; post-completion non-hub-flow redraw | *(suppressed — `{ trackEntry: false }`)* | Not a new discovery event at all: an in-place refresh of the mission sheet that is already open. No `mission_entry` fires. |

**On the seasonal-list `unknown` call**: a real, distinct surface that
doesn't cleanly fit any of the other eight values. Rather than invent a
`"seasonal"` enum value for a comparatively minor surface before there's
real data to justify it, it's honestly labeled `unknown` for now — visible
in the dashboard as a real (if unattributed) number, never silently folded
into `browse`. If it turns out to matter, promoting it to its own enum
value is a small, additive follow-up (the same shape as adding `next` and
`family` was).

## 9c. `timer_start` / `help_open` / `mission_undo` mission attribution

`timer_start` has carried a mission id in `double1` since Faz 1 — no schema
change needed, just a new per-mission snapshot query
(`missions[id].timer_starts`).

`help_open` and `mission_undo` did not carry a mission id before this
review follow-up. Both now accept one **optionally** in `double1`,
additive and backward-compatible: `src/worker.js`'s `buildDataPoint()`
still writes a valid row with no doubles when the id is absent or invalid,
exactly as it always did. Since real mission ids start at 1, a `double1` of
0 on a row can only mean "not attributed" (an older row, or — help_open's
in-mission panel excepted — a genuine case where no mission was open),
never a real mission's id.

The snapshot tracks this explicitly rather than silently reading old data
as "zero for every mission": a top-level `attribution` object records
`{ attributed, unattributed }` counts for both events, generated by
`applyAttributedPerMissionCount()`. A week generated entirely before this
deploy will show 100% unattributed for both — that is expected, and is not
a data-quality bug to chase.

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

## 13. Historical backfill semantics: availability vs. true zero

`--week` can point at any past ISO week, including one that predates an
event's own existence — 2026-33 and 2026-34 both predate Locked v1 entirely
(merged 2026-08-25; those weeks close 2026-08-16 and 2026-08-23). Before this
section's fix, a week like that queried WAE, got an empty result set for
`mission_entry`/`product_care_open`/etc., and wrote the ordinary `Number(0)`
— indistinguishable from "this was live and nobody used it." For product/R&D
that distinction is not cosmetic: `mission_entry_sources: {today:0,
browse:0, ...}` on a historical week reads as a dead feature, when the
honest answer is "mission_entry did not exist yet."

**The rule:** a field is `null`, never a fabricated `0`, for any portion of a
week before its own production cutoff. `0` still means exactly what it
always meant — measured, and nobody triggered it.

### The instrumentation registry

`tools/generate-weekly-snapshot.mjs` carries an `INSTRUMENTATION` map of
named cutoffs, each the exact **production deploy instant** (the commit that
reached `main`, not a PR branch's own authored timestamp — a branch can sit
for days before anything on it is live):

| Cutoff | Instant | Commit | Gates |
|---|---|---|---|
| `FAZ1` | 2026-08-07T00:03:48Z | `43d7283` | `app_open`, `mission_start`, `mission_complete`, `help_open`, `player_count` |
| `FAZ2` | 2026-08-07T23:55:47Z | `91eb42a` | the 16-event batch, `app_first_open`, `timer_start` (with a mission id from day one) |
| `FAZ2B` | 2026-08-15T14:26:03Z | `50c5e99` | `welcome_complete`, `quickplay_start` |
| `FAZ2F` | 2026-08-17T08:11:29Z | `3b876f5` | `team_create`, `team_switch`, `profile_delete`, `mission_undo` (EVENT only), `level_up` |
| `LOCKED_V1` | 2026-08-25T13:03:32Z | `0d95331` (PR #37's **merge**) | `mission_entry`, `mission_unfinished_exit`, `product_care_open`, `home_add_tap`, `standalone_open`, `first_mission_start`, `first_mission_complete`, AND the `help_open`/`mission_undo` mission-id **attribution** |

Every instant was read off `git log -S"<event>" -- src/worker.js`, not
guessed. Two fields can share the same event but different cutoffs — most
notably `help_open` (event: `FAZ1`, mission-id attribution: `LOCKED_V1`) and
`mission_undo` (event: `FAZ2F`, mission-id attribution: `LOCKED_V1`): the
global `help_opens` reason breakdown and `family.mission_undo` count are
real for any week back to their own event's cutoff, even on a week where the
**per-mission** breakdown (`missions[*].help_opens`/`undos`,
`attribution.help_open`/`mission_undo`) is unavailable. `EVENT_CUTOFF` and
`ATTRIBUTION_CUTOFF` in the generator model these separately — see that
file's own header comment for the full table, including every event this
applies to.

### Three states, not two

For a given week `[monday, monday+7d)` and a field's cutoff instant:

- **`available`** — cutoff at/before the week starts. Ordinary numbers,
  exactly like today. No entry in `availability` at all — an always-live
  field (nearly everything, for any real-world week) never appears there,
  keeping the block bounded to genuine historical gaps.
- **`not_collected`** — cutoff at/after the week ends. The field is `null`
  in the snapshot; `availability.<key> = { status: "not_collected",
  available_from: "<cutoff>" }`.
- **`partial`** — cutoff falls inside the week. The real WAE number IS kept
  (trustworthy: an event that didn't exist yet simply has no rows before the
  cutoff, so there's no over- or under-counting risk) — only
  `availability.<key> = { status: "partial", available_from: "<cutoff>" }`
  is added, so a reader knows not to treat it as a full week's measurement.
  2026-33 straddles `FAZ2B` (`welcome_complete` is partial there); 2026-34
  straddles `FAZ2F` (`family.mission_undo`'s total is partial there, while
  its mission-id attribution is still fully `not_collected` — `LOCKED_V1` is
  weeks later).

`activation_milestones` mixes two different cutoffs in one object
(`welcome_complete` is `FAZ2B`, the other four are `LOCKED_V1`) — each key is
tracked and gated independently rather than treating the object as
all-or-nothing.

### What this does NOT do

It never touches a week's real, already-live totals. `app_opens`,
`mission_starts`, `mission_completes`, `recorded_completion_ratio`, and the
`help_opens` reason breakdown are exactly what WAE returned — 2026-34's real
0.10 completion ratio (356 starts, 34 completes) stays 0.10; this is a
review candidate for product to look at, not a bug this generator "fixes" by
reshaping historical numbers.

### `/analiz`

`assets/analiz/index.html`'s `hasV3(snap)` already distinguished "wrong
schema entirely" (a v2 file) from a v3 field's contents. `unavailable(v)`
(`v === null`) is the second, narrower check every v3-aware renderer now
makes before formatting a number: `renderEntrySources`, `renderProductSignals`,
`renderFamily`, `renderDataHealth`'s unknown-source alert, and
`renderMissionDetail`'s per-mission stats/entry-source rows. `null` renders
as `bu dönemde henüz ölçülmüyordu` (or a topic-specific variant, e.g. "Product
Care sinyalleri bu dönemde henüz toplanmıyordu"); a real numeric `0` still
renders as `0`. A `partial` entry in `availability` additionally surfaces one
small note naming the exact cutoff, via `partialNote()`, so a partially
measured week is never silently presented as a fully measured one.

See `tools/check-snapshot-availability.mjs` for the deterministic proof: a
fully historical week, a fully post-cutoff week, a week straddling a cutoff,
the `help_open`/`mission_undo` event-vs-attribution split, the real 2026-33/
2026-34 totals staying untouched, and the dashboard rendering both states
correctly with no `null`/`NaN` ever leaking into visible text.
