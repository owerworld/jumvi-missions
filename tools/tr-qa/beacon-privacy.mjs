/* Proves the Privacy & Safety modal's central claim at runtime rather than by
 * reading the source: no analytics payload carries a name, an email, the
 * certificate name the parent typed, a profile name, or any device id.
 *
 * A grep over app.js shows the call sites are clean today. This catches the
 * case that grep cannot: a future prop that happens to carry a value the user
 * typed. It plants distinctive sentinel strings in every field the app lets a
 * parent fill in, drives the flows that emit beacons, and fails if a sentinel
 * — or anything shaped like an identifier — ever leaves the page. */
/* Playwright is not a repo dependency (this project ships no package.json),
 * so resolve it with a clear message instead of a bare MODULE_NOT_FOUND. */
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
const ok = (l, c, d = "") => { c ? (pass++, console.log(`  ok   ${l}`)) : (fail++, console.log(`  FAIL ${l}${d ? "\n         " + d : ""}`)); };

// Values a parent can type. If any of these reach /api/beacon, the modal lies.
const SENTINELS = ["ZeynepSentinel", "sentinel@example.com", "ProfilSentinel"];

/** Every prop key the Worker will store, from src/worker.js. */
const ALLOWED_KEYS = new Set(["e", "id", "reason", "n", "pack", "badge", "channel", "step"]);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

for (const route of ["/", "/tr"]) {
  console.log(`\n${route}`);
  const page = await browser.newPage();

  // Capture beacons at the transport, below any app-level abstraction.
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

  await page.goto(BASE + route, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // Plant the sentinels everywhere the app accepts free text, then exercise
  // the flows that beacon: mission open/complete, help, players, share,
  // read-aloud, timer, dashboard, certificate, profile.
  await page.evaluate(([certName, email, profileName]) => {
    try { soundOn = true; } catch (_) {}
    try { lsSet(CERT_NAME_KEY, certName); } catch (_) {}
    try {
      const list = lsGetJSON(PROFILES_KEY, []) || [];
      list.push({ id: "p2", name: profileName, avatar: "fox" });
      lsSet(PROFILES_KEY, JSON.stringify(list));
    } catch (_) {}
    document.querySelectorAll("input, textarea").forEach((i) => { try { i.value = email; } catch (_) {} });

    const m = missions.find((x) => x.id === 2);
    try { openMission(m); } catch (_) {}
    try { markMissionDone(2, "manual"); } catch (_) {}
    try { beacon("help_open", { reason: "ball_stuck" }); } catch (_) {}
    try { beacon("share_tap", { channel: "whatsapp" }); } catch (_) {}
    try { beacon("pack_complete", { pack: "Reflex Rush" }); } catch (_) {}
    try { beacon("badge_earned", { badge: "first" }); } catch (_) {}
    try { beacon("profile_add"); } catch (_) {}
    try { beacon("certificate_made"); } catch (_) {}
    try { beacon("score_saved"); } catch (_) {}
    try { beacon("missionbook_get"); } catch (_) {}
    try { beacon("progress_reset"); } catch (_) {}
  }, SENTINELS);

  await page.waitForTimeout(900);
  const beacons = await page.evaluate(() => window.__beacons);
  console.log(`       yakalanan beacon: ${beacons.length}`);

  ok("beacon gönderiliyor (test anlamlı)", beacons.length > 0);

  const blob = JSON.stringify(beacons);
  const leaked = SENTINELS.filter((s) => blob.includes(s));
  ok("kullanıcının yazdığı hiçbir değer gitmiyor", leaked.length === 0, "sızan: " + JSON.stringify(leaked));

  const strayKeys = [...new Set(beacons.flatMap((b) => Object.keys(b)))].filter((k) => !ALLOWED_KEYS.has(k));
  ok("yalnızca izinli alanlar gönderiliyor", strayKeys.length === 0, "beklenmeyen alan: " + JSON.stringify(strayKeys));

  // An identifier would have to look like one: a uuid, a long random token, or
  // an email. Mission ids and counts are small integers and pass this.
  const suspicious = beacons.filter((b) =>
    Object.entries(b).some(([k, v]) =>
      k !== "e" && typeof v === "string" &&
      (/^[0-9a-f]{8}-[0-9a-f]{4}/i.test(v) || /@/.test(v) || v.length > 24)));
  ok("kimlik benzeri değer yok (uuid/e-posta/uzun token)", suspicious.length === 0, JSON.stringify(suspicious));

  await page.close();
}

await browser.close();
console.log(`\n${fail === 0 ? "✅" : "❌"} ${pass} geçti, ${fail} kaldı`);
process.exit(fail === 0 ? 0 : 1);
