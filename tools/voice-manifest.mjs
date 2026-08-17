#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * Coach Leo voice inventory — what is recorded, and what still speaks in the
 * device's own text-to-speech voice.
 *
 * The prerecorded set covers mission narration and the Red Light / Green Light
 * cues. Everything else still reaches window.speechSynthesis, which on most
 * phones is a default female en-US voice — a different person from the Coach
 * Leo a child just heard read the mission. This tool is the list of every one
 * of those lines, so a recording session can close the gap in one pass.
 *
 *   node tools/voice-manifest.mjs           → human summary
 *   node tools/voice-manifest.mjs --csv     → one row per line, for the studio
 *   node tools/voice-manifest.mjs --missing → only what still needs recording
 *
 * Exit code is always 0: this reports, it does not gate a deploy.
 * ═══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import vm from "node:vm";

const args = new Set(process.argv.slice(2));
const asCsv = args.has("--csv");
const missingOnly = args.has("--missing");

/* ── load the data the app itself speaks from ─────────────────────────────── */
const ctx = vm.createContext({ window: {}, document: {}, self: {} });
vm.runInContext(fs.readFileSync("data.js", "utf8") + "\n;__d={missions};", ctx);
vm.runInContext(fs.readFileSync("mission-coaching.js", "utf8"), ctx);
vm.runInContext(fs.readFileSync("play-modes.js", "utf8"), ctx);
const missions = ctx.__d.missions;
const coaching = ctx.window.JUMVI_MISSION_COACHING || {};
const playModes = ctx.window.JUMVI_PLAY_MODES || [];

const appJs = fs.readFileSync("app.js", "utf8");
const hubJs = fs.existsSync("jumvi-hub-app.js") ? fs.readFileSync("jumvi-hub-app.js", "utf8") : "";
const leoJs = fs.readFileSync("coach-leo-audio.js", "utf8");

/* ── which clips actually exist on disk ───────────────────────────────────── */
const BASE = "assets/audio/coach-leo/en/";
const onDisk = (rel) => fs.existsSync(BASE + rel);
const mapKeys = (varName) => {
  const m = leoJs.match(new RegExp("var " + varName + "\\s*=\\s*\\{([\\s\\S]*?)\\};"));
  if (!m) return [];
  return [...m[1].matchAll(/^\s*(?:"([^"]+)"|(\w+))\s*:\s*"([^"]+)"/gm)]
    .map((x) => ({ key: x[1] || x[2], file: x[3] }));
};

const rows = [];
const add = (family, key, text, file, where, recorded) =>
  rows.push({ family, key, text: String(text || "").replace(/\s+/g, " ").trim(), file, where, recorded });

// The speech layer strips emoji/arrows before speaking; mirror that so the
// script a narrator reads is exactly what the app would have said.
const strip = (v) =>
  String(v || "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu, "")
    .replace(/\s+/g, " ")
    .trim();

/* ── 1. mission narration — the recorded set ──────────────────────────────── */
const missionFiles = mapKeys("MISSION_FILES");
missions.forEach((ms) => {
  const entry = missionFiles.find((f) => Number(f.key) === ms.id);
  if (!entry) {
    // Mission 13 is Silent Mode: a game played in total silence, so it has no
    // narration on purpose. Not a gap.
    add("mission", String(ms.id), strip(ms.title), "—", "openMission → playMissionNarration", "n/a");
    return;
  }
  add("mission", String(ms.id), strip(ms.title), "missions/" + entry.file,
      "openMission → playMissionNarration", onDisk("missions/" + entry.file) ? "yes" : "MISSING FILE");
});

/* ── 2. Red Light / Green Light caller cues — recorded ────────────────────── */
const CUE_TEXT = {
  green: "Green light!",
  keepPlaying: "Keep playing!",
  red: "Red light! Freeze!",
  greatJob: "Great job!",
};
mapKeys("CUE_FILES").forEach((c) => {
  add("rlgl-cue", c.key, CUE_TEXT[c.key] || c.key, "game-cues/" + c.file,
      "jumvi-redlight.js caller", onDisk("game-cues/" + c.file) ? "yes" : "MISSING FILE");
});

/* ── 3. the 3-2-1-GO start countdown ──────────────────────────────────────── */
const countdown = mapKeys("COUNTDOWN_FILES");
[["3", "Three"], ["2", "Two"], ["1", "One"], ["go", "Go!"]].forEach(([key, text]) => {
  const entry = countdown.find((c) => c.key === key);
  add("countdown", key, text, entry ? "game-cues/" + entry.file : "game-cues/countdown-" + key + "-en.mp3",
      "showCountdownThenStart → speakCountdownStep",
      entry && onDisk("game-cues/" + entry.file) ? "yes" : "no");
});

/* ── 4. Leo's island (the 3D hub) ─────────────────────────────────────────── */
[...hubJs.matchAll(/coachSpeak\(\s*"((?:[^"\\]|\\.)*)"\s*\)/g)].forEach((m, i) =>
  add("hub", "greeting-" + (i + 1), m[1].replace(/\\'/g, "'"),
      "hub/hub-greeting-" + (i + 1) + "-en.mp3", "jumvi-hub-app.js", "no"));
[...hubJs.matchAll(/showLeoBubble\(\s*"((?:[^"\\]|\\.)*)"/g)].forEach((m, i) =>
  add("hub", "bubble-" + (i + 1), m[1].replace(/\\'/g, "'"),
      "hub/hub-bubble-" + (i + 1) + "-en.mp3", "jumvi-hub-app.js", "no"));

/* ── 5. fixed system lines spoken from app.js ─────────────────────────────── */
add("system", "times-up", "Time's up! Great job!", "system/times-up-en.mp3",
    "timer reaches zero", "no");
add("system", "times-up-score", "Time's up! You got {N}!", "system/— (dynamic number)",
    "timer reaches zero with a score", "no");

/* ── 6. mid-mission voice reminders ───────────────────────────────────────── */
Object.entries(coaching).forEach(([id, meta]) => {
  (meta.reminders || []).forEach((r, i) => {
    const ms = missions.find((m) => m.id === Number(id));
    if (!ms) return;
    const text = r.source === "safety" ? strip(ms.safety) : strip((ms.steps || [])[r.index]);
    if (!text) return;
    add("reminder", `${id}-${i}`, text, `reminders/reminder-${String(id).padStart(2, "0")}-${i}-en.mp3`,
        "half-way through the mission timer", "no");
  });
});

/* ── 7. Quick Play spoken cues ────────────────────────────────────────────── */
playModes.forEach((mode) => {
  const v = mode.voice || {};
  const push = (key, node) => {
    const text = node && (node.text?.en || node.text);
    if (typeof text === "string" && text.trim()) {
      add("playmode", `${mode.id}-${key}`, strip(text),
          `playmodes/${mode.id}-${key}-en.mp3`, "Quick Play — " + (mode.title?.en || mode.id), "no");
    }
  };
  push("mid", v.mid);
  push("final", v.final);
  (v.orchestratedCues || []).forEach((c, i) => push("cue" + i, c));
});

/* ── output ───────────────────────────────────────────────────────────────── */
const shown = missingOnly ? rows.filter((r) => r.recorded === "no" || r.recorded === "MISSING FILE") : rows;

if (asCsv) {
  const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
  console.log("family,key,recorded,suggested_file,text,where_it_plays");
  shown.forEach((r) => console.log([r.family, r.key, r.recorded, r.file, r.text, r.where].map(esc).join(",")));
  process.exit(0);
}

const families = [...new Set(rows.map((r) => r.family))];
console.log("Coach Leo voice inventory\n");
for (const f of families) {
  const all = rows.filter((r) => r.family === f);
  const done = all.filter((r) => r.recorded === "yes").length;
  const na = all.filter((r) => r.recorded === "n/a").length;
  const todo = all.length - done - na;
  const label = todo === 0 ? "recorded" : `${todo} still on device TTS`;
  console.log(`  ${f.padEnd(10)} ${String(done).padStart(3)}/${all.length - na} recorded${na ? ` (+${na} silent by design)` : ""} — ${label}`);
}

const todoRows = rows.filter((r) => r.recorded === "no" || r.recorded === "MISSING FILE");
console.log(`\n${todoRows.length} line(s) still speak in the device's own voice:\n`);
for (const f of families) {
  const list = todoRows.filter((r) => r.family === f);
  if (!list.length) continue;
  console.log(`  ── ${f} (${list.length}) ${"─".repeat(Math.max(0, 46 - f.length))}`);
  list.slice(0, missingOnly ? 999 : 6).forEach((r) =>
    console.log(`     ${r.file}\n       “${r.text}”`));
  if (!missingOnly && list.length > 6) console.log(`     … ${list.length - 6} more (run with --missing or --csv)`);
  console.log("");
}
console.log("Turkish: no recorded clips exist at all — /tr speaks every line above");
console.log("through the device voice via tr/i18n.js. A Turkish Coach Leo is a");
console.log("separate recording of the same list.");
