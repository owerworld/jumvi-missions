#!/usr/bin/env bash
# §4.3 — batch-optimize the hub GLBs (draco geometry + webp 512px textures).
# Originals are preserved; output mirrors the source tree under hub3d-optimized/.
# Heaviest files first (they dominate the budget). Bash 3.2 compatible (macOS).
#
#   ./tools/optimize-glb.sh
#
set -uo pipefail
cd "$(dirname "$0")/.."

SRC="assets/hub3d"
OUT="assets/hub3d-optimized"
mkdir -p "$OUT"

total_before=0
total_after=0

# Heaviest first: sort by size desc, feed paths through a while-read loop.
find "$SRC" -name '*.glb' -exec stat -f '%z %N' {} \; | sort -rn | while read -r size path; do
  rel="${path#"$SRC"/}"
  out="$OUT/$rel"
  mkdir -p "$(dirname "$out")"
  before=$(stat -f%z "$path")
  if npx --yes @gltf-transform/cli@4 optimize "$path" "$out" \
       --compress draco \
       --texture-compress webp \
       --texture-size 512 \
       --simplify true >/dev/null 2>&1; then
    after=$(stat -f%z "$out")
    total_before=$((total_before + before))
    total_after=$((total_after + after))
    printf '%-34s %8d -> %8d  (%d%%)\n' "$rel" "$before" "$after" $((after * 100 / before))
  else
    echo "FAIL $rel"
  fi
done

# Totals from the produced files (the subshell above can't export the running sums).
tb=$(find "$SRC" -name '*.glb' -exec stat -f%z {} \; | awk '{s+=$1} END{print s}')
ta=$(find "$OUT" -name '*.glb' -exec stat -f%z {} \; 2>/dev/null | awk '{s+=$1} END{print s+0}')
awk -v b="$tb" -v a="$ta" 'BEGIN{ printf "\nTOTAL  %d -> %d bytes  (%.2f MB -> %.2f MB)\n", b, a, b/1048576, a/1048576 }'
