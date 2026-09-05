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

/* This file used to carry a frozen 36-row copy of every mission's equipment.
 * That copy is what actually broke: when mission 21 became "Middle Defender"
 * (3 players, 3 paddles) the row here still said [3,4], so the check went red
 * and stayed red — reporting the catalogue as wrong when the catalogue was
 * right. A duplicated table cannot audit the thing it duplicates.
 *
 * So the rule is derived from the mission itself instead: a mission needs one
 * paddle per active player and one ball, which is the actual product fact and
 * holds for all 36 today. A kit that disagrees with its own player label is a
 * real defect; a mission whose player count legitimately changes just carries
 * its kit along, with nothing here to update.
 *
 * The bounds (never more than the four-paddle kit, never a "+" label) stay
 * asserted separately below — those are the promises the printed book and the
 * FBA kit have to keep, and they do not follow from consistency alone. */
const MAX_PLAYERS = 4;

/** "2" -> 2, "3–4" -> [3,4]; the count(s) a mission actually puts on court. */
const activePlayers = (label) => {
  const found = String(label).match(/\d+/g);
  if(!found) return null;
  const nums = found.map(Number);
  return nums.length === 1 ? nums[0] : [nums[0], nums[nums.length - 1]];
};

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
check("every mission packs one paddle per active player",
  missions.every((mission) =>
    JSON.stringify(mission.equipment.paddles) === JSON.stringify(activePlayers(mission.players))),
  missions.filter((mission) =>
    JSON.stringify(mission.equipment.paddles) !== JSON.stringify(activePlayers(mission.players)))
    .map((mission) => `#${mission.id} players ${mission.players} vs paddles ${JSON.stringify(mission.equipment.paddles)}`)
    .join(", ")
);
check("every mission needs exactly one ball",
  missions.every((mission) => mission.equipment.balls === 1),
  missions.filter((mission) => mission.equipment.balls !== 1)
    .map((mission) => `#${mission.id}=${mission.equipment.balls}`).join(", ")
);
check("paddles never exceed the four-paddle kit",
  Math.max(...missions.map((mission) => upper(mission.equipment.paddles))) === MAX_PLAYERS
);
check("balls never exceed the four-ball kit",
  Math.max(...missions.map((mission) => upper(mission.equipment.balls))) <= MAX_PLAYERS
);

console.log("\nEquipment labels");
check("one paddle is singular", formatEquipmentCount(1, "paddle", "paddles") === "1 paddle");
check("two paddles are plural", formatEquipmentCount(2, "paddle", "paddles") === "2 paddles");
check("one soft ball is singular", formatEquipmentCount(1, "soft ball", "soft balls") === "1 soft ball");
check("two soft balls are plural", formatEquipmentCount(2, "soft ball", "soft balls") === "2 soft balls");
check("ranges use an en dash", formatEquipmentCount([3,4], "paddle", "paddles") === "3–4 paddles");
check("zero-count equipment is hidden", formatEquipmentCount(0, "paddle", "paddles") === "");

console.log("\nPlayer labels");
check("every player label parses to a real, well-ordered count",
  missions.every((mission) => {
    const players = activePlayers(mission.players);
    if(players === null) return false;
    if(Array.isArray(players)) return players[0] >= 2 && players[0] < players[1] && players[1] <= MAX_PLAYERS;
    return players >= 2 && players <= MAX_PLAYERS;
  }),
  missions.filter((mission) => {
    const players = activePlayers(mission.players);
    if(players === null) return true;
    return Array.isArray(players)
      ? !(players[0] >= 2 && players[0] < players[1] && players[1] <= MAX_PLAYERS)
      : !(players >= 2 && players <= MAX_PLAYERS);
  }).map((mission) => `#${mission.id}=${mission.players}`).join(", ")
);
check("range labels use an en dash, never a hyphen or a plus",
  missions.every((mission) => !/[-+]/.test(String(mission.players))),
  missions.filter((mission) => /[-+]/.test(String(mission.players)))
    .map((mission) => `#${mission.id}=${mission.players}`).join(", ")
);
check("no mission label implies more than the four-paddle kit",
  missions.every((mission) => !String(mission.players).includes("+") &&
    Math.max(...(String(mission.players).match(/\d+/g) || [0]).map(Number)) <= MAX_PLAYERS)
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
