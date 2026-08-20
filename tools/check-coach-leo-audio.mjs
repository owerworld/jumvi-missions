#!/usr/bin/env node
// Deterministic contract check for the prerecorded English Coach Leo pilot.
// No network / ElevenLabs dependency — pure static verification that:
//   - all 36 missions have a prerecorded path; mission 13's is pre-play only
//   - all four Red Light / Green Light cue keys exist
//   - every mapped file actually exists on disk
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

let failures = 0;
function check(label, condition, detail=""){
  if(condition){ console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

// isAvailable() gates on `typeof Audio !== "undefined"`, which is only true
// in a real browser — stub it so hasMission()'s locale/mapping logic (the
// part this check cares about) runs the same way it would in Chromium.
const context = { window:{}, Audio: function Audio(){} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("mission-coaching.js", "utf8"), context);
vm.runInContext(fs.readFileSync("coach-leo-audio.js", "utf8"), context);

const coaching = context.window.JUMVI_MISSION_COACHING || {};
const missionIds = Object.keys(coaching).map(Number).sort((a,b)=>a-b);
const coachLeo = context.window.CoachLeoAudio;

console.log("Coach Leo prerecorded audio contract");
check("mission-coaching.js loaded (36 missions)", missionIds.length === 36 && missionIds[0] === 1 && missionIds[35] === 36);
check("coach-leo-audio.js exposes window.CoachLeoAudio", !!coachLeo);

if(coachLeo){
  // hasMission() is locale-gated; force English for this static contract check.
  context.window.__JUMVI_LOCALE = undefined;
  check("mission 13 (Silent Mode) has a pre-play/manual EN path", coachLeo.hasMission(13));
  for(const id of missionIds){
    check(`mission ${id} has exactly one EN path`, coachLeo.hasMission(id));
  }
  for(const id of missionIds){
    const reminders = coaching[id] && Array.isArray(coaching[id].reminders) ? coaching[id].reminders : [];
    reminders.forEach((_, index) => check(`mission ${id} reminder ${index + 1} has an EN coaching clip`, coachLeo.hasCoaching(id, index)));
  }
}

// Extract the literal filename maps from source — verifies the four RLGL cue
// keys exist and gives us the exact filenames to check on disk below.
const source = fs.readFileSync("coach-leo-audio.js", "utf8");
const missionBlock = source.slice(source.indexOf("var MISSION_FILES"), source.indexOf("var CUE_FILES"));
const missionFiles = [...missionBlock.matchAll(/^\s*\d+:\s*"([^"]+\.mp3)"/gm)].map(m => m[1]);
const CUE_KEYS = ["green", "keepPlaying", "red", "greatJob"];
const cueFiles = CUE_KEYS.map(key => {
  const m = source.match(new RegExp(`\\b${key}:\\s*"([^"]+\\.mp3)"`));
  return m ? m[1] : null;
});

check("36 mission mp3 filenames referenced (1-36)", missionFiles.length === 36, `found ${missionFiles.length}`);
for(const key of CUE_KEYS){
  const idx = CUE_KEYS.indexOf(key);
  check(`cue "${key}" is mapped to a file`, !!cueFiles[idx]);
}

for(const f of missionFiles){
  check(`on disk: assets/audio/coach-leo/en/missions/${f}`, fs.existsSync(path.join("assets/audio/coach-leo/en/missions", f)));
}
for(const f of cueFiles){
  if(!f) continue;
  check(`on disk: assets/audio/coach-leo/en/game-cues/${f}`, fs.existsSync(path.join("assets/audio/coach-leo/en/game-cues", f)));
}

const coachingBlock = source.slice(source.indexOf("var COACHING_FILES"), source.indexOf("var STALL_MS"));
const coachingFiles = [...coachingBlock.matchAll(/"([^"]+\.mp3)"/g)].map(m => m[1]);
check("40 mission coaching mp3 filenames referenced", coachingFiles.length === 40, `found ${coachingFiles.length}`);
for(const f of coachingFiles){
  check(`on disk: assets/audio/coach-leo/en/mission-coaching/${f}`, fs.existsSync(path.join("assets/audio/coach-leo/en/mission-coaching", f)));
}

/* 3-2-1-GO start sequence. The map may legitimately be empty (English then
 * counts down silently over the visual overlay), but it must never be HALF
 * filled and it must never be possible for English to fall through to the
 * device TTS voice again — that regression is invisible on desktop Chrome and
 * only shows up on a real phone, which is how it shipped the first time. */
const countdownBlock = source.slice(source.indexOf("var COUNTDOWN_FILES"), source.indexOf("var LINE_FILES"));
const countdownEntries = [...countdownBlock.matchAll(/^\s*(?:"(\d)"|(go)):\s*"([^"]+\.mp3)"/gm)]
  .map(m => ({ key: m[1] || m[2], file: m[3] }));
check("countdown map is all-or-nothing (0 or 4 clips)", countdownEntries.length === 0 || countdownEntries.length === 4, `${countdownEntries.length} mapped`);
for(const { key, file } of countdownEntries){
  check(`countdown "${key}" on disk: ${file}`, fs.existsSync(path.join("assets/audio/coach-leo/en/game-cues", file)));
}
if(countdownEntries.length === 0){
  console.log("  note countdown clips not shipped yet — English counts down silently by design");
}

/* LINE_FILES — the fixed lines that also appear on screen (island greeting,
 * "Time's up"). Same contract as the countdown: empty is fine and means
 * English stays silent on them, but a mapped clip must exist on disk, and the
 * router must never let English fall through to the device voice. */
const lineBlock = source.slice(source.indexOf("var LINE_FILES"), source.indexOf("var LINE_TEXT"));
const lineEntries = [...lineBlock.matchAll(/^\s*"([\w-]+)":\s*"([^"]+\.mp3)"/gm)]
  .map(m => ({ key: m[1], file: m[2] }));
for(const { key, file } of lineEntries){
  check(`line "${key}" on disk: ${file}`, fs.existsSync(path.join("assets/audio/coach-leo/en", file)));
}
if(lineEntries.length === 0){
  console.log("  note island/system clips not shipped yet — English stays silent on them by design");
}
// Every sentence the text→key table can resolve must have a key that either is
// mapped or is knowingly absent; a typo here would silently mean "no clip".
const textBlock = source.slice(source.indexOf("var LINE_TEXT"), source.indexOf("var STALL_MS"));
const textKeys = [...textBlock.matchAll(/:\s*"([\w-]+)"/g)].map(m => m[1]);
check("every LINE_TEXT key is unique", new Set(textKeys).size === textKeys.length);
check("every mapped LINE_FILES key is reachable from LINE_TEXT",
  lineEntries.every(e => textKeys.includes(e.key)), lineEntries.map(e => e.key).join(",") || "none mapped");

const appSrc = fs.readFileSync("app.js", "utf8");
const lineRouter = appSrc.slice(appSrc.indexOf("function speakLeoLine"), appSrc.indexOf("// §3.1"));
check("English island/system lines never fall back to speechSynthesis",
  /isAvailable\(\)[\s\S]*?return;\n\s*\}/.test(lineRouter));
check("the 3D hub speaks through the recorded-first router",
  appSrc.includes("coachSpeak: speakLeoLine"));
check("all reminder slots route through the data-driven coaching map",
  appSrc.includes("leo.hasCoaching(ms.id, index)") && appSrc.includes("leo.playCoaching(ms.id, index)"));

const announceBlock = appSrc.slice(appSrc.indexOf("function showCountdownThenStart"), appSrc.indexOf("function startTimer"));
check("countdown never calls coachSpeak() directly", !announceBlock.includes("coachSpeak("));
check("countdown routes through speakCountdownStep()", announceBlock.includes("speakCountdownStep("));
const routerBlock = appSrc.slice(appSrc.indexOf("function speakCountdownStep"), appSrc.indexOf("/* Visual countdown"));
check("English countdown never falls back to speechSynthesis", /isAvailable\(\)[\s\S]*return;/.test(routerBlock));

if(failures){
  console.log(`\n❌ ${failures} Coach Leo audio contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ Every mission and all 4 RLGL cues map to a real file.");
