#!/usr/bin/env node
import fs from "node:fs";
import vm from "node:vm";

let failures = 0;
function check(label, condition, detail = ""){
  if(condition){ console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

const context = vm.createContext({});
vm.runInContext(
  fs.readFileSync("data.js", "utf8") + "\n;__out={missions,formatEquipmentCount};",
  context
);
const { missions, formatEquipmentCount } = context.__out;

const expected = [
  [1,2,1],[2,[2,3],1],[3,2,1],[4,2,1],[5,2,1],[6,2,1],
  [7,2,1],[8,2,1],[9,2,1],[10,2,1],[11,2,1],[12,2,1],
  [13,2,1],[14,2,1],[15,2,1],[16,2,1],[17,2,1],[18,2,1],
  [19,[3,4],1],[20,4,1],[21,[3,4],1],[22,4,1],[23,4,1],[24,4,1],
  [25,2,1],[26,2,1],[27,[2,3],1],[28,2,1],[29,2,1],[30,2,1],
  [31,2,1],[32,2,1],[33,2,1],[34,2,1],[35,2,1],[36,2,1],
];

const validCount = (value) => {
  if(Number.isInteger(value)) return value >= 0 && value <= 4;
  return Array.isArray(value) && value.length === 2 &&
    value.every(Number.isInteger) && value[0] >= 0 && value[0] <= value[1] && value[1] <= 4;
};
const upper = (value) => Array.isArray(value) ? value[1] : value;

console.log("Mission equipment data");
check("mission count is 36", missions.length === 36, String(missions.length));
check("mission ids remain 1..36",
  missions.every((mission, index) => mission.id === index + 1),
  JSON.stringify(missions.map((mission) => mission.id))
);
check("all 36 missions have equipment objects",
  missions.every((mission) => mission.equipment && typeof mission.equipment === "object")
);
check("all paddle counts are defined and valid",
  missions.every((mission) => validCount(mission.equipment?.paddles))
);
check("all ball counts are defined and valid",
  missions.every((mission) => validCount(mission.equipment?.balls))
);
check("all equipment values match the audited matrix",
  missions.every((mission, index) => {
    const [, paddles, balls] = expected[index];
    return JSON.stringify(mission.equipment) === JSON.stringify({ paddles, balls });
  })
);
check("paddles never exceed the four-paddle kit",
  Math.max(...missions.map((mission) => upper(mission.equipment.paddles))) === 4
);
check("balls never exceed the four-ball kit",
  Math.max(...missions.map((mission) => upper(mission.equipment.balls))) <= 4
);

console.log("\nEquipment labels");
check("one paddle is singular", formatEquipmentCount(1, "paddle", "paddles") === "1 paddle");
check("two paddles are plural", formatEquipmentCount(2, "paddle", "paddles") === "2 paddles");
check("one soft ball is singular", formatEquipmentCount(1, "soft ball", "soft balls") === "1 soft ball");
check("two soft balls are plural", formatEquipmentCount(2, "soft ball", "soft balls") === "2 soft balls");
check("ranges use an en dash", formatEquipmentCount([3,4], "paddle", "paddles") === "3–4 paddles");
check("zero-count equipment is hidden", formatEquipmentCount(0, "paddle", "paddles") === "");

console.log("\nPlayer labels");
const playerById = Object.fromEntries(missions.map((mission) => [mission.id, mission.players]));
check("range labels use bounded active-player counts",
  playerById[2] === "2–3" && playerById[19] === "3–4" && playerById[20] === "4" &&
  playerById[21] === "3–4" && playerById[23] === "4" && playerById[27] === "2–3"
);
check("no mission label implies more than four active players",
  missions.every((mission) => !String(mission.players).includes("+") &&
    Math.max(...(String(mission.players).match(/\d+/g) || [0]).map(Number)) <= 4)
);

console.log("\nMission Detail renderer");
const indexHtml = fs.readFileSync("index.html", "utf8");
const appJs = fs.readFileSync("app.js", "utf8");
const row = indexHtml.match(/<div class="missionKitRow" id="missionKitRow"[^>]*>([\s\S]*?)<\/div>/);
const renderer = appJs.match(/function renderMissionEquipment\(ms\)\{([\s\S]*?)\n\}\n\nfunction openMission/);
check("Mission Detail has one empty dynamic equipment mount", !!row && row[1].trim() === "");
check("static 2-paddle/1-ball detail row is gone", !!row && !/paddles|soft ball|missionKitChip/.test(row[1]));
check("renderer reads the current mission equipment", !!renderer && /ms\.equipment/.test(renderer[1]));
check("openMission renders equipment from mission data", /renderMissionEquipment\(ms\);/.test(appJs));
check("4-player selector is bounded", indexHtml.includes('data-n="4">4</button>'));

console.log("\nBehavior isolation");
check("equipment renderer does not route audio",
  !!renderer && !/audio|coach|speak|sound/i.test(renderer[1])
);
check("mission coaching hook remains intact", /prepareMissionCoach\(ms\);/.test(appJs));
check("mission illustration remains id-driven",
  /window\.MISSION_ICONS && window\.MISSION_ICONS\[ms\.id\]/.test(appJs)
);
check("equipment renderer does not alter illustrations",
  !!renderer && !/MISSION_ICONS|missionIconWrap|JUMVI_ART/.test(renderer[1])
);

if(failures){
  console.log(`\n❌ ${failures} mission equipment check(s) failed.`);
  process.exit(1);
}
console.log("\n✅ All 36 missions have bounded, data-driven equipment requirements.");
