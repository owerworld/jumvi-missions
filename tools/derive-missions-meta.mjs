#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * data.js → data/missions-meta.json  (Faz 2, Görev 2.2)
 *
 * WHY THIS EXISTS
 * The weekly snapshot crosses mission ids against the labels each mission
 * already carries — age band, difficulty, players, duration, pack. Those
 * labels live in data.js, which is a browser script: no exports, no module
 * wrapper, just `const missions = [...]` built by an m() helper.
 *
 * WHY IT IS DERIVED, NEVER HAND-WRITTEN
 * A hand-maintained copy is a second source of truth that goes stale the
 * first time a mission's age band is edited — and it goes stale silently,
 * producing a breakdown that looks fine and is wrong. Re-run this after any
 * data.js change; check-missions-meta below fails loudly if it drifts.
 *
 * HOW IT READS A BROWSER SCRIPT
 * node:vm with an empty context. data.js touches no DOM at module scope, so
 * it evaluates cleanly; nothing from this process is exposed to it.
 *
 * Run:  node tools/derive-missions-meta.mjs
 *       node tools/derive-missions-meta.mjs --check   # verify, write nothing
 * ═══════════════════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const repo = new URL("../", import.meta.url);
const DATA_JS = fileURLToPath(new URL("data.js", repo));
const OUT = fileURLToPath(new URL("data/missions-meta.json", repo));

/* Indoor vs outdoor is a property of the pack, not of any mission field.
 * It is the one label the cross-read needs that data.js does not carry, so
 * it is stated here — six entries, next to the derivation that uses them,
 * rather than buried in the snapshot query. */
const PACK_SETTING = {
  "Aim Master": "indoor",
  "Focus Control": "indoor",
  "Team Duo": "indoor",
  "Indoor Compact": "indoor",
  "Beach/Park": "outdoor",
  "Reflex Rush": "outdoor",
};

function evaluateDataJs(dataJsPath = DATA_JS) {
  // data.js declares everything with `const`, and top-level const is a
  // script-scoped binding — it never lands on the context object. The values
  // have to be read by an expression appended to the SAME script, where those
  // bindings are still in scope.
  const source = `${readFileSync(dataJsPath, "utf8")}\n;({ missions, PACKS, BADGES });`;
  const context = vm.createContext({});
  const { missions, PACKS, BADGES } = vm.runInContext(source, context, { filename: dataJsPath });
  if (!Array.isArray(missions) || !missions.length) {
    throw new Error(`${dataJsPath} evaluated but exposed no missions array`);
  }
  return { missions, PACKS, BADGES };
}

// dataJsPath lets a caller point this at a data.js that isn't the real repo's
// (e.g. tools/import-approved-missions.mjs regenerating meta for a sandboxed
// copy under test) without duplicating this derivation logic a second time.
export function buildMeta(dataJsPath = DATA_JS) {
  const { missions, PACKS, BADGES } = evaluateDataJs(dataJsPath);

  const packKeys = PACKS.map((p) => p.key).filter((k) => k !== "all");
  const missing = packKeys.filter((k) => !(k in PACK_SETTING));
  if (missing.length) {
    throw new Error(`PACK_SETTING is missing: ${missing.join(", ")} — update this file`);
  }

  const byId = {};
  for (const m of missions) {
    if (!PACK_SETTING[m.pack]) throw new Error(`mission ${m.id} has unknown pack "${m.pack}"`);
    byId[m.id] = {
      pack: m.pack,
      difficulty: m.difficulty,
      players: m.players,
      duration: m.time,
      age: m.age,
      setting: PACK_SETTING[m.pack],
    };
  }

  return {
    generated_from: "data.js",
    mission_count: missions.length,
    pack_keys: packKeys,
    // Display names, for anything that shows a pack to a human. Kept here so
    // the panel never has to hardcode a second copy of the marketing wording.
    pack_labels: Object.fromEntries(
      PACKS.filter((p) => p.key !== "all").map((p) => [p.key, p.name]),
    ),
    badge_ids: BADGES.map((b) => b.id),
    missions: byId,
  };
}

export const serialiseMeta = (meta) => `${JSON.stringify(meta, null, 2)}\n`;

/* buildMeta/serialiseMeta are imported by the snapshot generator for its
 * staleness guard, so everything below runs only on a direct invocation. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const meta = buildMeta();
  const json = serialiseMeta(meta);

  if (process.argv.includes("--check")) {
    let current = null;
    try {
      current = readFileSync(OUT, "utf8");
    } catch {
      console.error(`✗ ${OUT} is missing — run: node tools/derive-missions-meta.mjs`);
      process.exit(1);
    }
    if (current !== json) {
      console.error("✗ data/missions-meta.json is stale relative to data.js.");
      console.error("  Re-run: node tools/derive-missions-meta.mjs");
      process.exit(1);
    }
    console.log(`✅ missions-meta.json matches data.js (${meta.mission_count} missions)`);
  } else {
    writeFileSync(OUT, json);
    console.log(`wrote ${OUT} — ${meta.mission_count} missions, ${meta.pack_keys.length} packs`);
  }
}
