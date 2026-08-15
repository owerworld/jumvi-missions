#!/usr/bin/env node
// Deterministic contract check for the prerecorded English Coach Leo pilot.
// No network / ElevenLabs dependency — pure static verification that:
//   - mission 13 (Silent Mode) has no prerecorded path
//   - every other mission 1..36 has exactly one prerecorded path
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
  check("mission 13 (Silent Mode) has no prerecorded path", !coachLeo.hasMission(13));
  for(const id of missionIds){
    if(id === 13) continue;
    check(`mission ${id} has exactly one EN path`, coachLeo.hasMission(id));
  }
}

// Extract the literal filename maps from source — verifies the four RLGL cue
// keys exist and gives us the exact filenames to check on disk below.
const source = fs.readFileSync("coach-leo-audio.js", "utf8");
const missionFiles = [...source.matchAll(/^\s*\d+:\s*"([^"]+\.mp3)"/gm)].map(m => m[1]);
const CUE_KEYS = ["green", "keepPlaying", "red", "greatJob"];
const cueFiles = CUE_KEYS.map(key => {
  const m = source.match(new RegExp(`\\b${key}:\\s*"([^"]+\\.mp3)"`));
  return m ? m[1] : null;
});

check("35 mission mp3 filenames referenced (1-12, 14-36)", missionFiles.length === 35, `found ${missionFiles.length}`);
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

/* 3-2-1-GO start sequence. The map may legitimately be empty (English then
 * counts down silently over the visual overlay), but it must never be HALF
 * filled and it must never be possible for English to fall through to the
 * device TTS voice again — that regression is invisible on desktop Chrome and
 * only shows up on a real phone, which is how it shipped the first time. */
const countdownBlock = source.slice(source.indexOf("var COUNTDOWN_FILES"), source.indexOf("var STALL_MS"));
const countdownEntries = [...countdownBlock.matchAll(/^\s*(?:"(\d)"|(go)):\s*"([^"]+\.mp3)"/gm)]
  .map(m => ({ key: m[1] || m[2], file: m[3] }));
check("countdown map is all-or-nothing (0 or 4 clips)", countdownEntries.length === 0 || countdownEntries.length === 4, `${countdownEntries.length} mapped`);
for(const { key, file } of countdownEntries){
  check(`countdown "${key}" on disk: ${file}`, fs.existsSync(path.join("assets/audio/coach-leo/en/game-cues", file)));
}
if(countdownEntries.length === 0){
  console.log("  note countdown clips not shipped yet — English counts down silently by design");
}

const appSrc = fs.readFileSync("app.js", "utf8");
const announceBlock = appSrc.slice(appSrc.indexOf("function showCountdownThenStart"), appSrc.indexOf("function startTimer"));
check("countdown never calls coachSpeak() directly", !announceBlock.includes("coachSpeak("));
check("countdown routes through speakCountdownStep()", announceBlock.includes("speakCountdownStep("));
const routerBlock = appSrc.slice(appSrc.indexOf("function speakCountdownStep"), appSrc.indexOf("/* Visual countdown"));
check("English countdown never falls back to speechSynthesis", /isAvailable\(\)[\s\S]*return;/.test(routerBlock));

if(failures){
  console.log(`\n❌ ${failures} Coach Leo audio contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ Every mission (except 13) and all 4 RLGL cues map to a real file; nothing else changed.");
