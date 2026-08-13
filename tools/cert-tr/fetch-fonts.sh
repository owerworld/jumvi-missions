#!/usr/bin/env bash
# Poppins is the certificate's typeface. It is NOT vendored into the repo: it is
# pulled at build time only to rasterise tr/certificate-template.webp, and never
# served from the site. The gold banner uses the repo's own Fredoka.
set -euo pipefail
DIR="${1:-/tmp/cert}"
mkdir -p "$DIR"
for w in 400 500 600 700 800; do
  url=$(curl -sS -A "Mozilla/5.0" "https://fonts.googleapis.com/css2?family=Poppins:wght@$w" \
        | grep -oE "https://[^)]*\.ttf" | head -1)
  curl -sS -o "$DIR/poppins-$w.ttf" "$url"
  echo "poppins-$w.ttf -> $DIR"
done
