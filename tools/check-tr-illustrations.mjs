#!/usr/bin/env node
import fs from "node:fs";

const icons = fs.readFileSync("jumvi-mission-icons.js", "utf8");
const tr = fs.readFileSync("tr/i18n.js", "utf8");
let failed = false;
for (let id = 1; id <= 36; id++) {
  if (!new RegExp("\\n\\s*" + id + ":\\s*`").test(icons)) {
    console.error(`missing mission illustration ${id}`); failed = true;
  }
}
// The two diagrams with instructional prose/interactive controls must never
// regress to English on /tr. The generic DOM translator handles mapped text.
for (const token of ["I SEE IT!", "Mind Reader — how to play, in three steps", "MY SECRET", "LEFT", "CENTER", "RIGHT", "Previous step", "Next step"]) {
  if (!icons.includes(token) || !tr.includes(`"${token}"`)) {
    console.error(`missing Turkish illustration mapping: ${token}`); failed = true;
  }
}
if (failed) process.exit(1);
console.log("Turkish illustration contract: 36/36 present; Mission 15 and 28 text mappings complete.");
