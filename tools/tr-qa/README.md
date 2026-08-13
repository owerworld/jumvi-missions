# `/tr` localization QA

Seven scripts that check the Turkish route against the English one. They exist
because the `/tr` layer is invisible to the eye in the ways that matter most:
a missed string, a poisoned offline cache, or a renamed storage key all look
fine on the screen you happen to be looking at.

## Running

Playwright is not a repo dependency (this project ships no `package.json`), so
install it once in the repo root:

```bash
npm install playwright
```

Then, from the repo root, start the harness server and run the checks:

```bash
node tools/tr-qa/serve.mjs . 8787 &
node tools/tr-qa/locale.mjs
node tools/tr-qa/sw-cache.mjs
node tools/tr-qa/residual-english.mjs
node tools/tr-qa/beacon-privacy.mjs
node tools/tr-qa/certificate.mjs
node tools/tr-qa/production.mjs
```

> **These do not run in CI.** The repository's only workflow,
> `deploy-health-check.yml`, fires on `check_suite: completed` and is gated on
> `head_branch == 'main'` — it probes the live site after a Cloudflare deploy
> and never runs on a pull request. Everything here is a local check; a green
> run is evidence someone ran it, not a gate that blocks a merge.

Set `CHROMIUM_PATH` if Playwright cannot find a browser, and `BASE` to point
the checks at a deployed preview instead of the local harness.

## What each one does

**`serve.mjs`** — runs the *real* `src/worker.js` over a local HTTP server with
`env.ASSETS` shimmed to read the repo from disk, mirroring `.assetsignore` and
Cloudflare's "a matching asset is served without invoking the Worker" rule.
Nothing about the `/tr` logic is reimplemented here; that is the whole point.
Without it the routing could only be checked by deploying.

**`locale.mjs`** — 41 assertions: `/` stays English, `/tr` is Turkish across all
36 missions (title, steps, win, safety, tip), pack names and badge names are
translated while pack keys and badge ids are not, read-aloud switches to
`tr-TR`, the Red Light / Green Light caller speaks Turkish, both routes write
the same `localStorage` keys, the Turkish manifest is correct and the English
one is untouched, and `/tr?hub3d=1` flips the 3D Hub opt-in flag.

**`sw-cache.mjs`** — registers the real service worker and drives a full
online → offline sequence. It reads the cached shell *bodies*, not just the
key names: presence of two keys proves nothing, and Chromium's own HTTP cache
can serve an offline navigation without ever consulting the service worker,
which makes a poisoned cache look healthy. Verified against a control build
with the old single-key behaviour, where `/index.html` does come back Turkish
after a `/tr` visit — so this check fails when the bug is present.

**`residual-english.mjs`** — collects every visible string on `/` and on `/tr`
and reports the intersection; anything identical on both is text the locale
layer missed. It dismisses the welcome overlay and opens every tab panel
first, because copy inside a closed panel is computed-invisible and an earlier
pass that skipped this step under-reported by 27 strings. Brand and contact
tokens (JUMVI, SAY23 LLC, WhatsApp, support@jumvi.co) are allow-listed as
deliberately identical.

**`beacon-privacy.mjs`** — backs the Privacy & Safety modal's central claim with
evidence instead of prose. It plants sentinel strings in every field a parent
can fill in (certificate name, profile name, text inputs), drives the flows
that emit beacons, and captures them at `sendBeacon`/`fetch`. A grep over
`app.js` shows the call sites are clean today; this catches the case a grep
cannot — a future prop that happens to carry something the user typed.

**`certificate.mjs`** — the Turkish certificate template is a separate binary, so
no amount of locale-layer testing can catch a regression in it. Checks the three
things that would break silently: the exact 1376×768 geometry `app.js` draws the
child's name against, that the file decodes as a WebP at all, and that each route
requests its own template instead of quietly falling back to the other language's.

**`production.mjs`** — the release sweep: all four routes, a hard refresh, the
service worker generation change, both language orders each followed by going
offline, progress shared across languages, and the features (Coach Leo, TTS,
Red Light / Green Light, certificate, mission book, 3D Hub, privacy modal,
install metadata). It also covers the one risk the architecture introduces:
`/tr` injects `<base href="/">`, so every sub-resource, every anchor and the
in-app tab navigation are checked for silently dropping the child back onto the
English route.

See also `tools/check-tr-invariants.mjs`, which locks the values the locale
layer must never touch: mission ids, pack keys, badge ids, the frozen
Analytics Engine enums, and all 45 `localStorage` keys.
