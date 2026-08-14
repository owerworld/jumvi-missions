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
vm.runInContext(fs.readFileSync("mission-coaching.js", "utf8"), context);
const coaching = context.window.JUMVI_MISSION_COACHING || {};
const ids = Object.keys(coaching).map(Number).sort((a,b)=>a-b);

console.log("Mission coaching contract");
check("metadata covers missions 1..36", ids.length === 36 && ids.every((id,index)=>id === index + 1));
check("mission 2 has no reminder", coaching[2]?.reminders?.length === 0);
check("silent mission 13 has no reminder", coaching[13]?.reminders?.length === 0);

for(const id of ids){
  const meta = coaching[id];
  check(`${id}: valid replay tier`, ["quick","recap","full"].includes(meta.replay));
  check(`${id}: step indexes valid`, Array.isArray(meta.quickStepIndexes) && meta.quickStepIndexes.every(i=>Number.isInteger(i) && i >= 0 && i <= 2));
  check(`${id}: reminder count safe`, Array.isArray(meta.reminders) && meta.reminders.length <= 2);
  check(`${id}: reminder references only existing copy`, meta.reminders.every(r=>
    Number(r.fraction) > 0 && Number(r.fraction) < 1 &&
    (r.source === "safety" || (r.source === "step" && Number.isInteger(r.index) && r.index >= 0 && r.index <= 2))
  ));
}

const source = fs.readFileSync("mission-coaching.js", "utf8");
check("metadata contains no spoken text fields", !/\b(text|copy|message)\s*:/.test(source));

if(failures){
  console.log(`\n❌ ${failures} mission coaching contract failure(s).`);
  process.exit(1);
}
console.log("\n✅ Voice reminders only reference the existing 36 mission rules.");
