# Customer presentation v3 candidates

101 WebP presentation derivatives are mapped to 36 missions in `content/customer-presentation-v1.json`. Canonical mission records and the four existing pilot overlays are unchanged. These are technical review candidates, not new human locks or field/child acceptance.

`provenance.json` maps each derivative to approved source art and its composition purpose. `masters/` contains editable vector composition with deduplicated embedded product/pose source images in `source-images/`. The original inline SVG masters remain in the local working directory; none was overwritten or deleted. `master-index.json` records both inline and reference master hashes. Source images are unchanged bytes, named by SHA256. Rendering uses those exact equipment/pose sources rather than generating new equipment geometry. No mirroring.

The first catalogue browser review exposed straight-line layouts for circle/square games and ambiguous active/waiting pairs; the v3 masters now use triangle/square placement, distinct waiting pairs and separate ground-movement arrows. Verbal/counting missions have static bilingual labels in native DOM; these are illustration speech cues, not app-generated calls, timers or audio. Goal/safety text remains canonical.

To reconstruct inline masters for review use `node tools/restore-presentation-masters.mjs <empty-output-directory>`. This checks hashes; it does not edit original source or regenerate mission rules. WebP hashes/dimensions are checked in the asset manifest and contracts. All scenes still need final customer aesthetic acceptance; desktop inspection does not establish real-device/child usability.
