#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Remote wrangler dev, pinned to the dev Analytics Engine dataset.
#
# WHY THIS EXISTS
# Plain `wrangler dev` never writes to any real Analytics Engine dataset —
# the binding has no remote-bindings support and is always a local no-op
# (see docs/audits/wrangler-dev-analytics-engine.md). The only way to see a
# beacon actually land in Analytics Engine from a local machine is the full
# remote mode: `wrangler dev --remote`. That mode runs the WHOLE Worker on
# Cloudflare's edge — every binding is real, not just Analytics Engine —
# and without --env dev it is the PRODUCTION jumvi_events_v1 binding. That
# is the leading candidate for how test traffic ended up in the real
# dataset before (docs/audits/faz2-events.md §6b, the "70 unexplained
# rows") — though as the limitation below shows, it isn't proven.
#
# This script is the one command that can't forget the flag.
#
# WHAT IT DOES NOT DO
# It does not touch production config. wrangler.jsonc's top-level
# analytics_engine_datasets (jumvi_events_v1) is completely unchanged;
# env.dev only overrides the binding for this command. A bare
# `wrangler dev --remote` run by hand, without this script, still hits
# production — that risk isn't eliminated, only routed around.
#
# KNOWN LIMITATION — as of 2026-08-09, --remote itself does not work on this
# account. It fails at the *.workers.dev preview-token exchange with
# "Could not create remote preview session on your account" (Cloudflare edge
# error 1031, Invalid Workers Preview configuration) — reproduced against
# both --env dev and the existing production script, so it is not caused by
# this config. Matches the still-open upstream issue:
#   https://github.com/cloudflare/workers-sdk/issues/10773
# This script is still correct and safe to keep: it costs nothing while
# --remote is broken, and the moment Cloudflare/wrangler fix it, this is the
# command that was already pointed at the right dataset.
#
# FIRST RUN — dataset may not exist yet
# Analytics Engine datasets are supposed to auto-create on first write, but
# this account did not behave that way for jumvi_events_v1 at deploy time
# (docs/audits/faz1-beacon.md §6b). `wrangler dev --remote` is not a deploy,
# so it may behave differently — untested, since --remote doesn't run at all
# right now. If the first POST /api/beacon here fails once --remote works
# again, create jumvi_events_dev by hand (dash.cloudflare.com → Analytics
# Engine) and retry.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/.."

echo "→ wrangler dev --remote --env dev   (writes to jumvi_events_dev, not jumvi_events_v1)"
exec npx wrangler dev --remote --env dev "$@"
