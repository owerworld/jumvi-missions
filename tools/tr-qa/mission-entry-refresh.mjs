/* Locked v1 review follow-up — proves openMission()'s trackEntry gate at
 * runtime, in the real app, not just by reading the source.
 *
 * openMission() is reused for two different things: a genuine user
 * navigation into a mission (Browse card, Random, Next, Resume, ...) and an
 * internal refresh/re-render of the mission sheet that is ALREADY open
 * (undo, un-mark done, post-completion redraw). Only the first is a real
 * "mission_entry" — the second is the code redrawing the same mission, not a
 * user discovering it again. An earlier version of this feature fired
 * mission_entry on both (just labeling the second "unknown"), which would
 * have quietly double-counted every undo/refresh as a new discovery event.
 *
 * This drives the exact 5-point matrix specified in review:
 *   1. real Browse click        -> exactly 1 mission_entry (source: browse)
 *   2. Undo/rerender same mission -> +0 mission_entry
 *   3. state refresh same mission -> +0 mission_entry
 *   4. presses Next into another mission -> +1 mission_entry (source: next)
 *   5. close/reopen mission genuinely -> +1 new mission_entry
 * plus one more invariant the review explicitly called out: an internal
 * refresh must NOT reset _missionExitBeaconed as if a new user entry
 * happened, or a genuinely-closed-then-refreshed mission could send a
 * second mission_unfinished_exit for the same abandoned visit. */
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch (_) {
  console.error(
    "playwright bulunamadı. Repo kökünde bir kez kurun:\n" +
    "  npm install playwright\n" +
    "Tarayıcı zaten kuruluysa CHROMIUM_PATH ile gösterin."
  );
  process.exit(2);
}

const BASE = process.env.BASE || "http://localhost:8787";
let pass = 0, fail = 0;
const ok = (l, c, d = "") => { c ? (pass++, console.log(`  ok    ${l}`)) : (fail++, console.log(`  FAIL  ${l}${d ? "\n         " + d : ""}`)); };

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
const page = await browser.newPage();

// Capture beacons at the transport, below any app-level abstraction — the
// same technique beacon-privacy.mjs uses, so a future change to how beacon()
// itself is implemented can't quietly make this test pass for the wrong
// reason.
await page.addInitScript(`
  window.__beacons = [];
  const record = (body) => { try { window.__beacons.push(JSON.parse(body)); } catch (e) { window.__beacons.push({ __unparsed: String(body) }); } };
  const nativeSend = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
  navigator.sendBeacon = function (url, data) {
    if (String(url).includes("/api/beacon")) {
      if (data instanceof Blob) { data.text().then(record); } else { record(data); }
      return true;
    }
    return nativeSend ? nativeSend(url, data) : true;
  };
  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    if (String(url).includes("/api/beacon") && opts && opts.body) record(opts.body);
    return nativeFetch(url, opts);
  };
`);

await page.goto(BASE + "/", { waitUntil: "networkidle" });
await page.waitForTimeout(600);

async function entriesFor(id) {
  return page.evaluate((mid) => window.__beacons.filter((b) => b.e === "mission_entry" && b.id === mid), id);
}
async function countAll(name) {
  return page.evaluate((n) => window.__beacons.filter((b) => b.e === n).length, name);
}

console.log("1-5 — the exact review matrix\n");

const ids = await page.evaluate(() => missions.slice(0, 2).map((m) => m.id));
const [m1, m2] = ids;

// 1. real Browse click -> exactly 1 mission_entry, source browse
await page.evaluate((id) => openMission(id, "browse"), m1);
await page.waitForTimeout(150);
let m1Entries = await entriesFor(m1);
ok("1. real Browse click -> exactly 1 mission_entry", m1Entries.length === 1,
  `saw ${m1Entries.length}`);
ok("1. source is \"browse\"", m1Entries[0]?.source === "browse", JSON.stringify(m1Entries[0]));

// 2. Undo/rerender same mission -> +0 mission_entry
await page.evaluate((id) => openMission(id, "unknown", { trackEntry: false }), m1);
await page.waitForTimeout(150);
m1Entries = await entriesFor(m1);
ok("2. undo/rerender same mission -> +0 mission_entry", m1Entries.length === 1,
  `saw ${m1Entries.length}`);

// 3. state refresh same mission -> +0 mission_entry
await page.evaluate((id) => openMission(id, "unknown", { trackEntry: false }), m1);
await page.waitForTimeout(150);
m1Entries = await entriesFor(m1);
ok("3. state refresh same mission -> +0 mission_entry", m1Entries.length === 1,
  `saw ${m1Entries.length}`);

// 4. presses Next into another mission -> +1 mission_entry, source next
await page.evaluate((id) => openMission(id, "next"), m2);
await page.waitForTimeout(150);
let m2Entries = await entriesFor(m2);
ok("4. Next into another mission -> +1 mission_entry", m2Entries.length === 1,
  `saw ${m2Entries.length}`);
ok("4. source is \"next\"", m2Entries[0]?.source === "next", JSON.stringify(m2Entries[0]));

// 5. close/reopen mission genuinely -> +1 new mission_entry
await page.evaluate(() => closeMission());
await page.waitForTimeout(150);
await page.evaluate((id) => openMission(id, "browse"), m2);
await page.waitForTimeout(150);
m2Entries = await entriesFor(m2);
ok("5. close/reopen genuinely -> +1 new mission_entry", m2Entries.length === 2,
  `saw ${m2Entries.length}`);
ok("5. total mission_entry count across both missions is 3 (1 + 0 + 0 + 1 + 1)",
  (await countAll("mission_entry")) === 3, `saw ${await countAll("mission_entry")}`);

console.log("\n6 — internal refresh must not reset the exit-dedup flag\n");
// A genuinely-closed mission fires mission_unfinished_exit exactly once.
// If an internal refresh incorrectly reset _missionExitBeaconed (as if a new
// user entry happened), closing again afterward would fire a SECOND exit
// beacon for the same abandoned visit.
await page.evaluate((id) => openMission(id, "resume"), m1);
await page.waitForTimeout(150);
const exitsBefore = await countAll("mission_unfinished_exit");
await page.evaluate(() => closeMission());
await page.waitForTimeout(150);
const exitsAfterFirstClose = await countAll("mission_unfinished_exit");
ok("6. genuine close fires exactly 1 mission_unfinished_exit",
  exitsAfterFirstClose === exitsBefore + 1, `before ${exitsBefore}, after ${exitsAfterFirstClose}`);

// An internal refresh AFTER the close (e.g. a stray re-render) must not
// resurrect the same abandoned visit as a fresh entry-and-exit cycle.
await page.evaluate((id) => openMission(id, "unknown", { trackEntry: false }), m1);
await page.waitForTimeout(150);
await page.evaluate(() => closeMission());
await page.waitForTimeout(150);
const exitsAfterRefreshClose = await countAll("mission_unfinished_exit");
ok("6. internal refresh + close does not fire a second mission_unfinished_exit",
  exitsAfterRefreshClose === exitsAfterFirstClose, `before ${exitsAfterFirstClose}, after ${exitsAfterRefreshClose}`);
const m1EntriesAfterRefresh = await entriesFor(m1);
ok("6. that internal refresh also did not add a new mission_entry",
  m1EntriesAfterRefresh.length === 2, `saw ${m1EntriesAfterRefresh.length}`);

await page.close();
await browser.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} geçti, ${fail} kaldı`);
process.exit(fail === 0 ? 0 : 1);
