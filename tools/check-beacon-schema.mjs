#!/usr/bin/env node
/* Faz 1 / 1.2 — beacon schema guard.
 *
 * The WAE column layout is frozen: once rows land, blob/double positions
 * cannot move without splitting history. This asserts the exact layout for
 * all five events and that everything else is rejected.
 *
 * Run: node tools/check-beacon-schema.mjs
 */
import worker, { buildDataPoint } from "../src/worker.js";

let failures = 0;

function check(label, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ok    ${label}`);
  } else {
    console.log(`  FAIL  ${label}\n          expected ${e}\n          actual   ${a}`);
    failures++;
  }
}

console.log("Accepted events — frozen column layout:");
check("app_open", buildDataPoint({ e: "app_open" }), {
  blobs: ["app_open", ""], doubles: [], indexes: ["app_open"],
});
check("mission_start{id:1}", buildDataPoint({ e: "mission_start", id: 1 }), {
  blobs: ["mission_start", "1"], doubles: [], indexes: ["mission_start"],
});
check("mission_complete{id:36}", buildDataPoint({ e: "mission_complete", id: 36 }), {
  blobs: ["mission_complete", "36"], doubles: [], indexes: ["mission_complete"],
});
check("help_open{reason:ball_stuck}", buildDataPoint({ e: "help_open", reason: "ball_stuck" }), {
  blobs: ["help_open", "ball_stuck"], doubles: [], indexes: ["help_open"],
});
check("player_count{n:3}", buildDataPoint({ e: "player_count", n: 3 }), {
  blobs: ["player_count", ""], doubles: [3], indexes: ["player_count"],
});

console.log("\nAll six help_open reasons accepted:");
for (const r of ["ball_stuck", "ball_hard_to_remove", "strap_uncomfortable",
                 "need_more_space", "instructions_unclear", "mission_too_hard"]) {
  check(r, buildDataPoint({ e: "help_open", reason: r })?.blobs[1], r);
}

console.log("\nRejected (must all be null):");
const rejects = [
  ["unknown event name", { e: "Mission Completed", id: 1 }],
  ["free-text help reason", { e: "help_open", reason: "my ball is stuck" }],
  ["player_count out of enum", { e: "player_count", n: 5 }],
  ["player_count as string", { e: "player_count", n: "3" }],
  ["mission id 0", { e: "mission_start", id: 0 }],
  ["mission id out of range", { e: "mission_start", id: 99999 }],
  ["mission id non-integer", { e: "mission_start", id: 1.5 }],
  ["mission id as string", { e: "mission_start", id: "1" }],
  ["missing event name", { id: 1 }],
  ["null payload", null],
  ["array payload", [{ e: "app_open" }]],
  ["string payload", "app_open"],
];
for (const [label, payload] of rejects) check(label, buildDataPoint(payload), null);

/* The endpoint answers 204 to valid and invalid payloads alike, on purpose —
 * nothing about the allowlist should be probeable from outside. That makes
 * HTTP status useless as proof, so assert the write count directly. */
console.log("\nfetch handler — only allowlisted payloads reach WAE:");
{
  const writes = [];
  const env = {
    JUMVI_ANALYTICS: { writeDataPoint: (p) => writes.push(p) },
    ASSETS: { fetch: () => new Response("asset", { status: 200 }) },
  };
  const post = (body) =>
    worker.fetch(
      new Request("https://jumvi.co/api/beacon", { method: "POST", body }),
      env,
    );

  const valid = [
    '{"e":"app_open"}',
    '{"e":"mission_start","id":1}',
    '{"e":"mission_complete","id":36}',
    '{"e":"help_open","reason":"ball_stuck"}',
    '{"e":"player_count","n":3}',
  ];
  const invalid = [
    '{"e":"Mission Completed","id":1}',
    '{"e":"help_open","reason":"free text"}',
    '{"e":"player_count","n":5}',
    "not json",
    `{"e":"app_open","pad":"${"x".repeat(600)}"}`, // over MAX_BODY_BYTES
  ];

  for (const b of [...valid, ...invalid]) check(`204 for ${b.slice(0, 34)}`, (await post(b)).status, 204);
  check(`write count (${valid.length} valid + ${invalid.length} invalid)`, writes.length, valid.length);
  check("no extra columns ever emitted", writes.every(w => Object.keys(w).sort().join() === "blobs,doubles,indexes"), true);

  check("GET /api/beacon rejected", (await worker.fetch(new Request("https://jumvi.co/api/beacon"), env)).status, 405);
  check("non-beacon path falls through to assets", (await worker.fetch(new Request("https://jumvi.co/style.css"), env)).status, 200);
  check("assets fall-through wrote nothing", writes.length, valid.length);
}

console.log(failures === 0
  ? "\n✅ beacon schema OK"
  : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
