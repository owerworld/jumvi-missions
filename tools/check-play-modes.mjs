#!/usr/bin/env node
import fs from "node:fs";
import vm from "node:vm";

let failures = 0;
function check(label, condition, detail=""){
  if(condition){ console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

const context = vm.createContext({ window:{} });
vm.runInContext(fs.readFileSync("play-modes.js","utf8"), context);
const modes = context.window.JUMVI_PLAY_MODES;

console.log("Play Modes contract");
check("9 repeatable modes", Array.isArray(modes) && modes.length === 9, String(modes?.length));
check("unique ids", new Set(modes.map(x=>x.id)).size === modes.length);
for(const group of ["solo","duo","group"]){
  check(`${group}: 3 modes`, modes.filter(x=>x.group === group).length === 3);
}
for(const mode of modes){
  check(`${mode.id}: gear within 4 + 4`, mode.gear.paddles >= 1 && mode.gear.paddles <= 4 && mode.gear.balls >= 1 && mode.gear.balls <= 4);
  check(`${mode.id}: exactly 3 steps`, Array.isArray(mode.steps) && mode.steps.length === 3);
  const localized = [mode.title, mode.players.label, mode.difficulty, mode.space, ...mode.steps, mode.goal, mode.safety];
  check(`${mode.id}: EN/TR complete`, localized.every(x=>x && typeof x.en === "string" && x.en.trim() && typeof x.tr === "string" && x.tr.trim()));
}

const app = fs.readFileSync("app.js","utf8");
const start = app.indexOf("function renderPlayModes");
const end = app.indexOf("/** =======================\n * Family Insights", start);
const runtime = app.slice(start, end > start ? end : start + 30000);
for(const forbidden of ["markMissionDone(", "done.add(", "persist(", "beacon(\"mission_", "updateBadges(", "updateProgress("]){
  check(`mode runtime never calls ${forbidden}`, !runtime.includes(forbidden));
}
check("mode runtime reads separate data", runtime.includes("window.JUMVI_PLAY_MODES"));
check("mode detail says not a mission", fs.readFileSync("index.html","utf8").includes("NOT A MISSION"));

if(failures){
  console.log(`\n❌ ${failures} Play Modes contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ Play Modes stay separate from all mission progress.");
