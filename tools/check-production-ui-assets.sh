#!/usr/bin/env sh
set -eu

BASE_URL="${1:-https://qr.jumvi.co}"
BASE_URL=${BASE_URL%/}
EXPECTED_COUNT=72

if ! command -v curl >/dev/null 2>&1; then
  echo "FAIL: curl is required." >&2
  exit 1
fi

tmp_dir=$(mktemp -d)
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

asset_list="$tmp_dir/assets.txt"
find assets/ui -type f -name '*.webp' | sort > "$asset_list"
asset_count=$(wc -l < "$asset_list" | tr -d ' ')

if [ "$asset_count" -ne "$EXPECTED_COUNT" ]; then
  echo "FAIL: expected $EXPECTED_COUNT approved UI WebPs, found $asset_count." >&2
  exit 1
fi

failures=0
cache_bust=$(date +%s)
while IFS= read -r asset; do
  headers="$tmp_dir/headers"
  body="$tmp_dir/body"
  status=$(curl -sS -L -o "$body" -D "$headers" -w '%{http_code}' \
    "$BASE_URL/$asset?qa=$cache_bust") || status="curl-error"
  content_type=$(awk 'BEGIN{IGNORECASE=1} /^content-type:/{value=$0} END{sub(/^[^:]*:[[:space:]]*/, "", value); sub(/\r$/, "", value); print tolower(value)}' "$headers")

  if [ "$status" != "200" ] || [ "$content_type" != "image/webp" ]; then
    echo "FAIL: $asset status=$status content-type=${content_type:-missing}" >&2
    failures=$((failures + 1))
  fi
done < "$asset_list"

if [ "$failures" -ne 0 ]; then
  echo "FAIL: $failures/$EXPECTED_COUNT production UI assets failed." >&2
  exit 1
fi

echo "OK: $EXPECTED_COUNT/$EXPECTED_COUNT production UI WebPs returned HTTP 200 + image/webp ($BASE_URL)"
