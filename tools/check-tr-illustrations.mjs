#!/usr/bin/env node
import fs from "node:fs";
const icons = fs.readFileSync("jumvi-mission-icons.js", "utf8");
const tr = fs.readFileSync("tr/i18n.js", "utf8");
const byMission = new Map();
for (let id = 1; id <= 36; id++) {
  const start = icons.search(new RegExp("\\n\\s*" + id + ":\\s*`"));
  const next = id === 36 ? icons.length : icons.search(new RegExp("\\n\\s*" + (id + 1) + ":\\s*`"));
  if (start < 0 || next < 0) throw new Error(`missing mission illustration ${id}`);
  const tokens = new Set();
  for (const m of icons.slice(start, next).matchAll(/<(?:title|desc|text)\b[^>]*>([^<]+)|\b(?:aria-label|title)="([^"]+)"/g)) {
    const token = (m[1] || m[2]).replace(/\s+/g, " ").trim();
    if (/[A-Za-z]/.test(token)) tokens.add(token);
  }
  byMission.set(id, tokens);
}
let found = 0, localized = 0, failed = false;
for (const [id, tokens] of byMission) {
  const missing = [];
  for (const token of tokens) {
    found++;
    if (/^Step \d+ of \d+$/.test(token) || tr.includes(JSON.stringify(token))) localized++;
    else missing.push(token);
  }
  if (missing.length) { failed = true; console.error(`Mission ${id} unmapped:\n- ${missing.join("\n- ")}`); }
}
if (!tr.includes('"Sky High Jump"') || !tr.includes('"The thrower stays on the ground')) throw new Error("Mission 35 title/desc mapping missing");
if (failed) process.exit(1);
console.log(`Turkish illustration coverage: ${localized}/${found} localized; 0 unmapped across 36 missions.`);
