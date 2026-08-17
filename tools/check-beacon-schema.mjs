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

console.log("\nFaz 2 — frozen column layout:");
check("pack_view", buildDataPoint({ e: "pack_view", pack: "Beach/Park" }), {
  blobs: ["pack_view", "Beach/Park"], doubles: [], indexes: ["pack_view"],
});
check("pack_complete", buildDataPoint({ e: "pack_complete", pack: "Aim Master" }), {
  blobs: ["pack_complete", "Aim Master"], doubles: [], indexes: ["pack_complete"],
});
check("badge_earned", buildDataPoint({ e: "badge_earned", badge: "streak7" }), {
  blobs: ["badge_earned", "streak7"], doubles: [], indexes: ["badge_earned"],
});
check("share_tap", buildDataPoint({ e: "share_tap", channel: "whatsapp" }), {
  blobs: ["share_tap", "whatsapp"], doubles: [], indexes: ["share_tap"],
});
check("hub3d", buildDataPoint({ e: "hub3d", step: "moved" }), {
  blobs: ["hub3d", "moved"], doubles: [], indexes: ["hub3d"],
});
// The one event whose mission id lives in double1 instead of blob2.
check("timer_start", buildDataPoint({ e: "timer_start", id: 12 }), {
  blobs: ["timer_start", ""], doubles: [12], indexes: ["timer_start"],
});
check("return_visit", buildDataPoint({ e: "return_visit", n: 5 }), {
  blobs: ["return_visit", ""], doubles: [5], indexes: ["return_visit"],
});
check("app_first_open", buildDataPoint({ e: "app_first_open" }), {
  blobs: ["app_first_open", ""], doubles: [], indexes: ["app_first_open"],
});
// Activation funnel + Quick Play.
check("welcome_complete", buildDataPoint({ e: "welcome_complete" }), {
  blobs: ["welcome_complete", ""], doubles: [], indexes: ["welcome_complete"],
});
check("quickplay_start", buildDataPoint({ e: "quickplay_start", mode: "free-rally" }), {
  blobs: ["quickplay_start", "free-rally"], doubles: [], indexes: ["quickplay_start"],
});

console.log("\nAll six pack keys accepted:");
for (const k of ["Aim Master", "Focus Control", "Team Duo",
                 "Indoor Compact", "Beach/Park", "Reflex Rush"]) {
  check(k, buildDataPoint({ e: "pack_view", pack: k })?.blobs[1], k);
}

console.log("\nAll eleven badge ids accepted:");
for (const b of ["first", "aim", "zen", "team", "indoor", "outdoor", "reflex",
                 "streak3", "streak7", "champ", "zippy"]) {
  check(b, buildDataPoint({ e: "badge_earned", badge: b })?.blobs[1], b);
}

console.log("\nAll nine Quick Play mode ids accepted:");
for (const m of ["pop-and-stick", "quick-drop", "floor-target-four",
                 "free-rally", "copycat-pops", "four-ball-round",
                 "sync-pop", "loop-rally", "twin-lane-rally"]) {
  check(m, buildDataPoint({ e: "quickplay_start", mode: m })?.blobs[1], m);
}

console.log("\nAll seven hub3d steps accepted:");
for (const s of ["shown", "entered", "ready", "moved", "mission", "failed", "escaped"]) {
  check(s, buildDataPoint({ e: "hub3d", step: s })?.blobs[1], s);
}

console.log("\nProp-less events emit an empty blob2:");
for (const e of ["daily_pick_tap", "certificate_made", "speak_on", "score_saved",
                 "dashboard_open", "missionbook_get", "profile_add", "progress_reset"]) {
  check(e, buildDataPoint({ e }), { blobs: [e, ""], doubles: [], indexes: [e] });
}

console.log("\nExtra props are dropped, never written:");
check("profile_add carrying a child name",
  buildDataPoint({ e: "profile_add", name: "Ada", age: 6, avatar: "fox" }),
  { blobs: ["profile_add", ""], doubles: [], indexes: ["profile_add"] });
check("app_open carrying an id",
  buildDataPoint({ e: "app_open", uid: "abc-123" }),
  { blobs: ["app_open", ""], doubles: [], indexes: ["app_open"] });
check("welcome_complete carrying the chosen age band",
  buildDataPoint({ e: "welcome_complete", band: "just-starting", diff: "Easy" }),
  { blobs: ["welcome_complete", ""], doubles: [], indexes: ["welcome_complete"] });

console.log("\nRejected (must all be null):");
const rejects = [
  ["unknown event name", { e: "Mission Completed", id: 1 }],
  ["pack key not in enum", { e: "pack_view", pack: "all" }],
  ["pack display name, not key", { e: "pack_view", pack: "Bullseye!" }],
  ["pack slug, not key", { e: "pack_complete", pack: "aim-master" }],
  ["badge id not in enum", { e: "badge_earned", badge: "streak30" }],
  ["share channel not in enum", { e: "share_tap", channel: "email" }],
  ["hub3d step not in enum", { e: "hub3d", step: "exited" }],
  ["quickplay mode not in enum", { e: "quickplay_start", mode: "made-up-mode" }],
  ["quickplay with no mode", { e: "quickplay_start" }],
  ["quickplay carrying a mission id", { e: "quickplay_start", mode: 1 }],
  ["hub3d with no step", { e: "hub3d" }],
  ["timer_start out of range", { e: "timer_start", id: 0 }],
  ["timer_start as string", { e: "timer_start", id: "12" }],
  ["return_visit off-threshold", { e: "return_visit", n: 4 }],
  ["return_visit as string", { e: "return_visit", n: "2" }],
  ["review prompt event (deliberately unwired)", { e: "review_prompt_shown" }],
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
    '{"e":"pack_view","pack":"Team Duo"}',
    '{"e":"pack_complete","pack":"Reflex Rush"}',
    '{"e":"badge_earned","badge":"champ"}',
    '{"e":"share_tap","channel":"copy"}',
    '{"e":"hub3d","step":"shown"}',
    '{"e":"timer_start","id":7}',
    '{"e":"return_visit","n":10}',
    '{"e":"app_first_open"}',
    '{"e":"daily_pick_tap"}',
    '{"e":"certificate_made"}',
    '{"e":"speak_on"}',
    '{"e":"score_saved"}',
    '{"e":"dashboard_open"}',
    '{"e":"missionbook_get"}',
    '{"e":"profile_add"}',
    '{"e":"progress_reset"}',
    // Writes, but the name and age must not survive into any column.
    '{"e":"profile_add","name":"Ada","age":6}',
    /* Faz 2F — the family layer. team_create carries the KIND of pairing only;
     * a team name, child name or team id must never reach a column. */
    '{"e":"team_create","kind":"adult"}',
    '{"e":"team_create","kind":"sibling"}',
    '{"e":"team_switch"}',
    '{"e":"profile_delete"}',
    '{"e":"mission_undo"}',
    '{"e":"level_up","level":2}',
    '{"e":"level_up","level":7}',
    // Writes, but the team name must not survive into any column.
    '{"e":"team_create","kind":"sibling","team":"Ada + Ali"}',
  ];
  const invalid = [
    '{"e":"Mission Completed","id":1}',
    '{"e":"help_open","reason":"free text"}',
    '{"e":"player_count","n":5}',
    '{"e":"pack_view","pack":"all"}',
    '{"e":"badge_earned","badge":"made-up"}',
    '{"e":"hub3d","step":"exited"}',
    '{"e":"return_visit","n":4}',
    "not json",
    `{"e":"app_open","pad":"${"x".repeat(600)}"}`, // over MAX_BODY_BYTES
    // Faz 2F rejections: the enums are closed, and level 1 is the floor
    // nobody can cross INTO, so it is not a valid level_up value.
    '{"e":"team_create","kind":"cousin"}',
    '{"e":"team_create"}',
    '{"e":"level_up","level":1}',
    '{"e":"level_up","level":9}',
    '{"e":"level_up"}',
  ];

  for (const b of [...valid, ...invalid]) check(`204 for ${b.slice(0, 34)}`, (await post(b)).status, 204);
  check(`write count (${valid.length} valid + ${invalid.length} invalid)`, writes.length, valid.length);
  check("no extra columns ever emitted", writes.every(w => Object.keys(w).sort().join() === "blobs,doubles,indexes"), true);
  // The strongest privacy assertion available here: not one written cell
  // anywhere contains a value the payloads tried to smuggle in.
  const cells = writes.flatMap(w => [...w.blobs, ...w.doubles.map(String), ...w.indexes]);
  check("no child name reached any column", cells.some(c => /Ada/i.test(c)), false);
  check("no team name reached any column", cells.some(c => /Ali|\+/.test(c)), false);
  check("no age reached any column", writes.some(w => w.blobs[0] === "profile_add" && w.doubles.length), false);

  check("GET /api/beacon rejected", (await worker.fetch(new Request("https://jumvi.co/api/beacon"), env)).status, 405);
  check("non-beacon path falls through to assets", (await worker.fetch(new Request("https://jumvi.co/style.css"), env)).status, 200);
  check("assets fall-through wrote nothing", writes.length, valid.length);
}

console.log(failures === 0
  ? "\n✅ beacon schema OK"
  : `\n❌ ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
