#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Post-deploy asset health monitor  (Faz 1 GÖREV 1.1)
#
# WHY THIS EXISTS
# tools/check-core-assets.sh guards the REPO before a deploy (did someone edit
# a CORE_ASSETS file without bumping CACHE_NAME). This script checks the
# opposite end: after a deploy, did the bytes that were SUPPOSED to go out
# actually reach the edge and get served correctly. Two real incidents this
# session justify it existing:
#   1. A commit changed app.js (a CORE_ASSETS file) without bumping CACHE_NAME
#      — caught only by manually diffing service-worker.js against the lock
#      file after the fact. This script's [1/4] check is that comparison,
#      automated, run against the LIVE site instead of by hand.
#   2. One Cloudflare edge node cached the SPA-fallback HTML under a font's
#      URL — and the response STILL reported the correct Content-Type
#      (font/woff2) while the body was HTML. That is the reason this script
#      never trusts HTTP status code or Content-Type alone: every content
#      check below reads the actual bytes (magic number for binary formats,
#      absence of an HTML doctype for text formats, real node --check syntax
#      validation for the three main JS files). See assets/fonts/README.md
#      for the original incident.
#
# WHAT IT DOES NOT DO (yet — by design, Faz 1 GÖREV 1.1 scope)
# It never exits non-zero. This is a warn-only monitor: it prints clear ⚠️
# lines a human (or a later CI gate) can act on, but it must not block a
# deploy or fail a build in this phase. Slack/email alerting is explicitly
# out of scope for this task.
#
# Usage:
#   ./tools/check-deploy-health.sh [BASE_URL]
#   BASE_URL defaults to https://qr.jumvi.co
# ─────────────────────────────────────────────────────────────────────────────
set -uo pipefail
cd "$(dirname "$0")/.."

BASE="${1:-https://qr.jumvi.co}"
BASE="${BASE%/}"
FAIL=0
warn() { printf '  ⚠️  %s\n' "$1"; FAIL=1; }
ok()   { printf '  ✅ %s\n' "$1"; }

TMPDIR=$(mktemp -d)
cleanup() { rm -rf "$TMPDIR"; }
trap cleanup EXIT

echo "=== JUMVI deploy health check — $BASE ==="
echo

# ── [1/4] CACHE_NAME: live edge vs the lock file this deploy was supposed to ship ──
echo "[1/4] CACHE_NAME consistency (live vs tools/core-assets.lock)"
LIVE_SW=$(curl -fsSL "$BASE/service-worker.js" 2>/dev/null) || LIVE_SW=""
LIVE_CN=$(printf '%s' "$LIVE_SW" | grep -oE 'jumvi-missions-v[0-9]+' | head -1)
LOCK_CN=$(grep '^CACHE_NAME=' tools/core-assets.lock 2>/dev/null | cut -d= -f2-)
if [ -z "$LIVE_CN" ]; then
  warn "could not read CACHE_NAME from $BASE/service-worker.js (fetch failed or file empty)"
elif [ -z "$LOCK_CN" ]; then
  warn "tools/core-assets.lock has no CACHE_NAME= line — run ./tools/check-core-assets.sh --update"
elif [ "$LIVE_CN" != "$LOCK_CN" ]; then
  warn "live is $LIVE_CN but tools/core-assets.lock (this commit) says $LOCK_CN — edge may not have this deploy yet, or the deploy silently didn't ship what was committed"
else
  ok "live matches the committed lock: $LIVE_CN"
fi
echo

# ── [2/4] Every CORE_ASSETS entry: read the real bytes, not the status code ──
echo "[2/4] CORE_ASSETS content verification (magic bytes / doctype check, not status code)"
ASSETS=$(awk '/const CORE_ASSETS *= *\[/,/\]/' service-worker.js | grep -v '^[[:space:]]*//' | grep -oE '"/[^"]*"' | tr -d '"')
count=0; bad=0
while IFS= read -r a; do
  [ -z "$a" ] && continue
  count=$((count+1))
  f="$TMPDIR/asset"
  # -L: several CORE_ASSETS entries (/ , /index.html) are 308 redirects by
  # design (see docs — /index.html -> / is intentional). A real browser or
  # the service worker's fetch() follows redirects transparently, so this
  # check must too, or it flags a working redirect as broken.
  code=$(curl -fsSL -o "$f" -w '%{http_code}' "$BASE$a" 2>/dev/null) || code="000"
  if [ "$code" != "200" ]; then
    warn "$a — HTTP $code"
    bad=$((bad+1))
    continue
  fi
  magic=$(od -An -tx1 -N4 "$f" 2>/dev/null | tr -d ' \n')
  case "$a" in
    *.webp)
      [ "$magic" = "52494646" ] || { warn "$a — expected RIFF/WEBP magic bytes, got $magic (likely SPA fallback, not the real file)"; bad=$((bad+1)); } ;;
    *.png)
      [ "$magic" = "89504e47" ] || { warn "$a — expected PNG magic bytes, got $magic"; bad=$((bad+1)); } ;;
    *.woff2)
      [ "$magic" = "774f4632" ] || { warn "$a — expected wOF2 magic bytes, got $magic"; bad=$((bad+1)); } ;;
    *.js|*.css|*.json)
      # Check only the FIRST bytes for the doctype, not the whole body: a
      # real JS file can legitimately contain the literal string
      # "<!doctype html" deep inside a template string (app.js does, for a
      # print/share feature) — that is not evidence of an SPA fallback. An
      # actual fallback response's ENTIRE body starts with the doctype.
      if head -c 200 "$f" 2>/dev/null | grep -qi '<!doctype html'; then
        warn "$a — response body is HTML (SPA fallback), not the real file"
        bad=$((bad+1))
      fi ;;
    *) : ;;  # unrecognised extension — HTTP 200 already confirmed, no magic-byte check defined
  esac
done <<< "$ASSETS"
if [ "$bad" -eq 0 ]; then ok "$count/$count CORE_ASSETS verified"; else warn "$bad/$count CORE_ASSETS failed verification"; fi
echo

# ── [3/4] The three main JS files: syntax-check the bytes actually served ──
echo "[3/4] Production JS syntax check (the bytes as served, not the repo copy)"
INDEX=$(curl -fsSL "$BASE/" 2>/dev/null) || INDEX=""
APP_REF=$(printf '%s' "$INDEX" | grep -oE 'app\.js\?v=[0-9A-Za-z-]+' | head -1)
[ -z "$APP_REF" ] && APP_REF="app.js"
APP_BODY_FILE="$TMPDIR/app.js"
curl -fsSL "$BASE/$APP_REF" -o "$APP_BODY_FILE" 2>/dev/null || : > "$APP_BODY_FILE"

check_js() {
  local label="$1" ref="$2"
  local f="$TMPDIR/${label}.js"
  if ! curl -fsSL "$BASE/$ref" -o "$f" 2>/dev/null; then
    warn "$label — could not fetch $ref"
    return
  fi
  local err
  if err=$(node --check "$f" 2>&1); then
    ok "$label ($ref) — syntax valid"
  else
    warn "$label ($ref) — SYNTAX ERROR: $(printf '%s' "$err" | tr '\n' ' ' | cut -c1-200)"
  fi
}

check_js "app.js" "$APP_REF"

LEO_REF=$(printf '%s' "$INDEX" | grep -oE 'leo-tour\.js\?v=[0-9A-Za-z-]+' | head -1)
[ -z "$LEO_REF" ] && LEO_REF="leo-tour.js"
check_js "leo-tour.js" "$LEO_REF"

# jumvi-hub-app.js is never referenced in index.html — it's dynamically
# import()'d from inside app.js when the 3D hub opens. Its version has to be
# read out of the app.js bytes we just fetched, not out of the HTML.
HUB_REF=$(grep -oE 'jumvi-hub-app\.js\?v=[0-9A-Za-z-]+' "$APP_BODY_FILE" | head -1)
[ -z "$HUB_REF" ] && HUB_REF="jumvi-hub-app.js"
check_js "jumvi-hub-app.js" "$HUB_REF"
echo

# ── [4/4] Sample the mission-pack UI images ──────────────────────────────
echo "[4/4] Sampled /assets/ui/* mission pack images (every ~12th entry)"
SAMPLE=$(printf '%s\n' "$ASSETS" | grep '^/assets/ui/' | awk 'NR % 12 == 1')
if [ -z "$SAMPLE" ]; then
  echo "  (none listed in CORE_ASSETS)"
else
  while IFS= read -r a; do
    [ -z "$a" ] && continue
    f="$TMPDIR/sample"
    code=$(curl -fsSL -o "$f" -w '%{http_code}' "$BASE$a" 2>/dev/null) || code="000"
    magic=$(od -An -tx1 -N4 "$f" 2>/dev/null | tr -d ' \n')
    if [ "$code" = "200" ] && [ "$magic" = "52494646" ]; then
      ok "$a"
    else
      warn "$a — http=$code magic=$magic"
    fi
  done <<< "$SAMPLE"
fi
echo

echo "=== done ==="
if [ "$FAIL" -eq 1 ]; then
  echo "⚠️  One or more checks failed above. Warn-only per Faz 1 GÖREV 1.1 — not failing the run."
else
  echo "✅ All checks passed."
fi
exit 0
