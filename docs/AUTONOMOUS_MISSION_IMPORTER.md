# Approved Mission Batch Importer

`tools/import-approved-missions.mjs` takes an already-approved mission batch
(Lab → Auditor output) and integrates it into `data.js` using the exact
current mission model — the same generic mission-card pipeline every existing
mission already renders through. It does not design missions, does not
create packs, and does not commit, push, open a PR, merge, or deploy. Those
stay explicit human actions, always.

This document is the operating manual. The machine-readable contract for the
batch itself lives in [`data/approved-mission-batch.schema.json`](../data/approved-mission-batch.schema.json).

## Why this exists

Every mission total in the app (`missions.length`, per-pack badge
completion, the champion badge, `data/missions-meta.json`) is already
*derived*, not hardcoded — see the "dynamic mission catalog" hardening. That
means the app itself doesn't need code changes when the catalog grows. What
was still missing was a *safe, repeatable, reviewable way to grow it*: a
human copying `m(37, ...)` into `data.js` by hand, forgetting to regenerate
`missions-meta.json`, forgetting to bump the service worker's cache name, or
fat-fingering a duplicate id. This importer is that missing, reusable step —
built once, reused for every future approved batch.

## The batch contract

A batch is a JSON array of candidate missions. Every field maps 1:1 onto
`data.js`'s `m(id, pack, title, difficulty, players, time, age, steps, win,
safety, tip, equipment)` helper, minus `id` (the importer always assigns
that itself) plus one addition, `auditor_verdict`:

```json
[
  {
    "title": "Example Placeholder Alpha",
    "pack": "Aim Master",
    "difficulty": 2,
    "players": "2",
    "time": "90s",
    "age": "5+",
    "equipment": { "paddles": 2, "balls": 1 },
    "steps": ["Step one", "Step two"],
    "win": "Win condition text.",
    "safety": "Safety line text.",
    "tip": "Tip text.",
    "auditor_verdict": "APPROVED"
  }
]
```

Field rules (enforced by the schema *and* by the importer's own validation,
which mirrors `tools/check-mission-schema.mjs`'s rules for `data.js` itself):

| Field | Rule |
|---|---|
| `title` | Non-empty, unique against every existing mission and every other candidate in the batch (case-insensitive) |
| `pack` | Must be an **existing** key in `data.js`'s `PACKS` — see [New packs](#new-packs-are-out-of-scope) |
| `difficulty` | `1`, `2`, or `3` |
| `players` | `"N"` or `"N–M"` — **en dash** (U+2013), not a hyphen |
| `time` | `"Ns"` |
| `age` | `"N+"` |
| `equipment.paddles` | An integer, or a `[min, max]` pair; must cover the max of `players` |
| `equipment.balls` | A positive integer |
| `steps` | 1–3 non-empty strings (the mission sheet renders at most 3) |
| `win` / `safety` / `tip` | Non-empty strings |
| `auditor_verdict` | `"APPROVED"`, `"REJECTED"`, or `"NEEDS_REVISION"` — **only `APPROVED` may be imported** |
| `suggested_id` *(optional)* | A sanity hint only. The importer always assigns the real id itself and flags this field if it collides with anything |

A runnable example — some `APPROVED`, one `NEEDS_REVISION`, one with an
invalid pack — lives at
[`tools/fixtures/approved-mission-batch.example.json`](../tools/fixtures/approved-mission-batch.example.json).
**It is a fixture for demos and tests, not a real candidate batch.**

## Running it

```sh
# DRY_RUN — the default. Reads data.js + src/worker.js, reports, writes nothing.
node tools/import-approved-missions.mjs path/to/batch.json

# Same, machine-readable
node tools/import-approved-missions.mjs path/to/batch.json --json

# APPLY — requires the approval gate (see below)
node tools/import-approved-missions.mjs path/to/batch.json \
  --mode=apply --approved-by="Jane Auditor" --approved-count=3
```

A `DRY_RUN` report shows exactly what an `APPLY` of the same batch would do:

```
Approved-mission-batch import plan (DRY-RUN)

  current mission count   36
  proposed mission count  38 (+2)
  mission id ceiling      200 (src/worker.js MISSION_ID_MAX)

  proposed new mission ids:
    37  [Aim Master]  Example Placeholder Alpha
    38  [Beach/Park]  Example Placeholder Beta

  target packs / resulting pack counts:
    Aim Master       6 -> 7 (+1)
    Beach/Park       6 -> 7 (+1)

  files that WOULD change:
    data.js (new mission entries appended)
    data/missions-meta.json (regenerated from the new data.js)
    service-worker.js (CACHE_NAME bump — data.js content changed)
    tools/core-assets.lock (regenerated for the CACHE_NAME bump)
    index.html (data.js/app.js cache-busting ?v= query strings)

  validation:
    approved+valid   2
    not APPROVED     1  (skipped, not an error)
      batch[2] "Example Placeholder Gamma (needs another pass)" — verdict: NEEDS_REVISION
    invalid          1  (BLOCKS those candidates only)
      batch[3] "Example Placeholder Delta (bad pack)":
        - pack "Water Balloon Blitz" does not exist in data.js's PACKS — this importer does not create new packs

  test plan (run after a real APPLY):
    node tools/check-mission-schema.mjs
    node tools/derive-missions-meta.mjs --check
    node tools/check-mission-growth-fixture.mjs
    ./tools/check-core-assets.sh (after the CACHE_NAME bump, run with --update)

DRY_RUN complete — no files were modified.
To apply exactly this plan: --mode=apply --approved-by="<your name>" --approved-count=2
```

One invalid candidate never blocks the rest of the batch — it's reported and
excluded, everything else proceeds.

## The mandatory human approval gate

`--mode=apply` alone does nothing. Two more flags are required:

- `--approved-by="<name>"` — non-empty. A record of who signed off, carried
  into the `data.js` comment the import adds.
- `--approved-count=<N>` — must equal the **exact** number of missions the
  plan would import. This forces a human to have actually read the
  `DRY_RUN` count before approving; a stale or guessed number is refused.

Missing or mismatched either one → refuse, exit 1, **no repo write, no PR,
no merge, no deployment.** This is enforced in code
(`tools/import-approved-missions.mjs`'s `main()`), not by convention —
`tools/check-mission-importer.mjs` has a regression test that calls the real
CLI both ways and asserts nothing is written when the gate isn't satisfied.

The importer itself never runs `git` and never touches CI/deploy — even a
fully-approved `APPLY` only edits files in the working tree. Committing,
pushing, opening a PR, and merging remain separate, explicit steps a human
(or a separately-invoked agent, on separate explicit instruction) takes
afterward.

## What a real `APPLY` does

1. Re-validates the batch (the same logic `DRY_RUN` used — the two modes
   share one `planImport()`, so they can never disagree).
2. If nothing is `APPROVED` + valid, it's a no-op: **no file is touched**,
   even in `APPLY` mode. Cache/version bumps only happen when there's
   actually something to bump.
3. Appends the new `m(...)` entries to `data.js`, in the same shape as every
   existing mission, with a comment noting the import date and approver.
4. Regenerates `data/missions-meta.json` via `tools/derive-missions-meta.mjs`'s
   real `buildMeta()` — reused, not duplicated, so the two can't drift apart.
5. Bumps `service-worker.js`'s `CACHE_NAME`, the `data.js`/`app.js`
   `?v=` query strings in `index.html`, and regenerates
   `tools/core-assets.lock` via `tools/check-core-assets.sh --update` —
   the same cache-busting ritual a human contributor follows today.
6. Runs `tools/check-mission-schema.mjs`, `tools/derive-missions-meta.mjs
   --check`, and `tools/check-mission-growth-fixture.mjs` against the result
   and reports pass/fail. A failure here is a loud signal to review the
   diff before committing — the script does not auto-revert its own writes.

Every one of these steps operates relative to `--repo-root` (default: the
real repo), which is how `tools/check-mission-importer.mjs` exercises the
entire `APPLY` write path against a throwaway temp sandbox and never touches
the real `data.js`.

## What this importer does **not** cover

The batch contract above is *text only* — mission rules, not art. Several
other files are indexed by mission id and are **not** part of this
contract, so a freshly-imported mission will render its title, steps, win
condition, safety line, tip, and equipment exactly like every other mission
(the generic card/sheet pipeline needs nothing else) but will be missing:

| File | What's missing without a follow-up | Effect |
|---|---|---|
| `jumvi-art.js` (`MISSION_SLUGS`) | The mission's hero illustration slug + a matching `assets/ui/missions/<slug>.webp` | Blank hero image on the card/sheet |
| `jumvi-mission-icons.js` (`MISSION_ICONS`) | A hand-drawn inline SVG icon for the id | Blank inline icon (the rest of the sheet is unaffected) |
| `mission-coaching.js` (`JUMVI_MISSION_COACHING`) | Voice-coaching metadata for the id | No voice coaching for that mission (`window.JUMVI_MISSION_COACHING[id] \|\| null` — a graceful `null`, not a crash). `tools/check-mission-coaching.mjs` asserts *every* mission has an entry, so it will correctly start failing until this is added — that's the intended signal, not a bug in this importer. |
| `coach-leo-audio.js` | A recorded voice-over clip for the id | No pre-recorded audio for that mission; `tools/check-coach-leo-audio.mjs` will similarly start failing until this is added |

**This is by design, not an oversight.** Art, icon design, and voice
recording are creative/production work that cannot come from a text batch —
inventing them would violate "do not create a new UI system" and "new
missions must render exactly like existing pages" (existing pages all have
real, hand-made art and audio; auto-generating placeholders would make new
missions render *differently*, not the same). Treat a real `APPLY` as
producing a mission that is **structurally live and fully playable**
(title/steps/win/safety/tip/equipment, badges, progress, analytics — all
correct on day one) with a **known, tracked follow-up** for art/icon/coaching
audio before it's indistinguishable from a hand-authored mission.

## New packs are out of scope

Every candidate's `pack` must already exist in `data.js`'s `PACKS`. This
importer refuses (with a clear validation error) to create a new pack. A
genuinely new pack additionally needs, at minimum:

- `data.js`: a new `PACKS` entry, a `PACK_THEMES` entry, a new pack badge in `BADGES`
- `app.js`: a new `SKILL_PACKS` entry
- `jumvi-hub-app.js`: a new `ZONE_THEMES` entry (colors, growth props, champion model) — `gateConfig`/`realPacks` already derive automatically from `PACKS`, but without a matching theme the new zone falls back to the last theme's visuals
- `src/worker.js`: the new key added to **both** `PACK_KEYS` and `BADGE_IDS` — this is a deliberately finite analytics allowlist and must be extended explicitly, never loosened generically
- `tools/derive-missions-meta.mjs`: a `PACK_SETTING` entry (indoor/outdoor)
- New pack + mission art assets, and `tools/core-assets.lock` regeneration

This list is unchanged from the prior "dynamic mission catalog" hardening
work and is intentionally **not** automated here.

## Regression coverage

`node tools/check-mission-importer.mjs` covers:

- a missing required field
- an invalid (non-existent) pack
- a non-`APPROVED` verdict (skipped, not an error)
- duplicate ids/titles — both against existing missions and within the same
  batch (every colliding occurrence is flagged, not just the second one)
- assigning past `src/worker.js`'s `MISSION_ID_MAX`
- **dynamic mission count after a hypothetical import**: the importer's own
  generated output is evaluated in a fresh VM and the *real* `BADGES` check
  functions are asserted to require the *new* totals — proving growth from
  a real approved batch needs zero manual total-chasing, the same guarantee
  `tools/check-mission-growth-fixture.mjs` proves for a hand-written fixture
- the `APPLY` approval gate refusing an unapproved or miscounted request
- a full sandboxed `APPLY` write (never touching the real repo), confirming
  `data.js` and `data/missions-meta.json` come out correct

Run it alongside the existing mission-data checks before trusting a real
batch:

```sh
node tools/check-mission-schema.mjs
node tools/derive-missions-meta.mjs --check
node tools/check-mission-growth-fixture.mjs
node tools/check-mission-importer.mjs
```

## Guardrails (repeated, deliberately)

- `DRY_RUN` is the default mode. It never writes a file.
- `APPLY` requires `--approved-by` and a matching `--approved-count`, both
  explicit and human-authored, or it refuses.
- This tool never creates a new pack, never touches `src/worker.js`'s
  `PACK_KEYS`/`BADGE_IDS` allowlists, and never loosens analytics
  validation.
- This tool never runs `git`, opens a PR, merges, or deploys. Those are
  always separate, explicit steps.
