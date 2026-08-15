#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
 * /tr lokalizasyonu — DEĞİŞMEZLER (invariants) kontrolü.
 *
 * Türkçe katmanı yalnızca GÖRÜNEN METNİ değiştirmelidir. Aşağıdakiler
 * dokunulamaz: bunlar cihazdaki kayıtlı ilerlemeyi ve dondurulmuş Analytics
 * Engine şemasını taşır. Bir tanesinin değişmesi sessizce ya kullanıcının
 * ilerlemesini siler ya da geçmiş veriyi ikiye böler.
 *
 *   node tools/check-tr-invariants.mjs
 *
 * Çıkış kodu 0 = tüm değişmezler yerinde. 1 = regresyon var.
 * ═══════════════════════════════════════════════════════════════════════════ */
import fs from "node:fs";
import vm from "node:vm";

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}\n         beklenen: ${e}\n         bulunan : ${a}`);
};

/* ── data.js: 36 görev, id/pack anahtarları ───────────────────────────────── */
const ctx = vm.createContext({ window: {}, document: {} });
vm.runInContext(
  fs.readFileSync("data.js", "utf8") + "\n;__out={missions,PACKS,BADGES};",
  ctx
);
const { missions, PACKS, BADGES } = ctx.__out;

console.log("data.js");
check("görev sayısı", missions.length, 36);
check("görev id'leri 1..36", missions.map(m => m.id), Array.from({ length: 36 }, (_, i) => i + 1));
check("pack anahtarları (sıra dahil)", PACKS.map(p => p.key), [
  "all", "Aim Master", "Focus Control", "Team Duo",
  "Indoor Compact", "Beach/Park", "Reflex Rush",
]);
check("her pack'te 6 görev", [...new Set(
  Object.values(missions.reduce((a, m) => (a[m.pack] = (a[m.pack] || 0) + 1, a), {}))
)], [6]);
check("badge id'leri", BADGES.map(b => b.id), [
  "first", "aim", "zen", "team", "indoor", "outdoor",
  "reflex", "streak3", "streak7", "champ", "zippy",
]);

/* ── Her görevin pack ataması. id→pack bağı hem rozet açılışını hem de
 *    hub3d bölge yerleşimini sürer; başlık çevrilebilir, bu bağ çevrilemez. */
check("id→pack eşlemesi", missions.map(m => `${m.id}:${m.pack}`), [
  ...Array.from({ length: 6 }, (_, i) => `${i + 1}:Reflex Rush`),
  ...Array.from({ length: 6 }, (_, i) => `${i + 7}:Aim Master`),
  ...Array.from({ length: 6 }, (_, i) => `${i + 13}:Focus Control`),
  ...Array.from({ length: 6 }, (_, i) => `${i + 19}:Team Duo`),
  ...Array.from({ length: 6 }, (_, i) => `${i + 25}:Indoor Compact`),
  ...Array.from({ length: 6 }, (_, i) => `${i + 31}:Beach/Park`),
]);

/* ── src/worker.js: dondurulmuş WAE şeması ────────────────────────────────── */
console.log("\nsrc/worker.js (WAE şeması — DONDURULMUŞ)");
const worker = fs.readFileSync("src/worker.js", "utf8");

const setOf = (name) => {
  const m = worker.match(new RegExp(`const ${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) return null;
  return (m[1].match(/"[^"]*"|\b\d+\b/g) || []).map(x => x.replace(/"/g, ""));
};

/* Bu liste DONDURULMUŞ: bir adı DEĞİŞTİRMEK geçmiş veriyi ikiye böler ve
 * Analytics Engine geriye dönük doldurma yapamaz. Ada EKLEMEK güvenlidir ve
 * listeyi burada genişletmek gerekir. quickplay_start ve welcome_complete
 * 2026-08-15 QA turunda eklendi; mevcut adların hiçbiri değişmedi. */
check("olay adları", [...worker.matchAll(/case "([a-z_0-9]+)":/g)].map(m => m[1]).sort(), [
  "app_first_open", "app_open", "badge_earned", "certificate_made",
  "daily_pick_tap", "dashboard_open", "help_open", "hub3d",
  "mission_complete", "mission_start", "missionbook_get", "pack_complete",
  "pack_view", "player_count", "profile_add", "progress_reset",
  "quickplay_start", "return_visit", "score_saved", "speak_on", "share_tap",
  "timer_start", "welcome_complete",
].sort());
check("HELP_REASONS", setOf("HELP_REASONS"), [
  "ball_stuck", "ball_hard_to_remove", "strap_uncomfortable",
  "need_more_space", "instructions_unclear", "mission_too_hard",
]);
check("PLAYER_COUNTS", setOf("PLAYER_COUNTS"), ["2", "3", "4"]);
check("PACK_KEYS", setOf("PACK_KEYS"), [
  "Aim Master", "Focus Control", "Team Duo",
  "Indoor Compact", "Beach/Park", "Reflex Rush",
]);
check("BADGE_IDS", setOf("BADGE_IDS"), [
  "first", "aim", "zen", "team", "indoor", "outdoor",
  "reflex", "streak3", "streak7", "champ", "zippy",
]);
check("SHARE_CHANNELS", setOf("SHARE_CHANNELS"), ["whatsapp", "native", "copy"]);
check("HUB3D_STEPS", setOf("HUB3D_STEPS"), [
  "shown", "entered", "ready", "moved", "mission", "failed", "escaped",
]);
check("RETURN_VISITS", setOf("RETURN_VISITS"), ["2", "3", "5", "10"]);
/* quickplay_start'ın tek boyutu. play-modes.js ile senkron kalmalı —
 * check-play-modes.mjs orada 9 mod olduğunu ayrıca doğruluyor. */
check("PLAY_MODE_IDS", setOf("PLAY_MODE_IDS"), [
  "pop-and-stick", "quick-drop", "floor-target-four",
  "free-rally", "copycat-pops", "four-ball-round",
  "sync-pop", "loop-rally", "twin-lane-rally",
]);
check("MISSION_ID_MAX", worker.match(/MISSION_ID_MAX = (\d+)/)?.[1], "200");

/* ── localStorage anahtarları ─────────────────────────────────────────────────
 * Profil-önekli anahtarlar `_PP + "..."` olarak kurulur; önek çalışma anında
 * hesaplandığı için burada literal parçayı doğruluyoruz. Bir anahtarın
 * KAYBOLMASI, cihazdaki ilerlemenin okunamaz hale gelmesi demektir. */
console.log("\nlocalStorage anahtarları");
const appJs = fs.readFileSync("app.js", "utf8");
const sources = ["app.js", "leo-tour.js", "jumvi-hub-app.js", "jumvi-redlight.js", "index.html"]
  .filter(f => fs.existsSync(f))
  .map(f => fs.readFileSync(f, "utf8"))
  .join("\n");

const found = new Set([
  ...[...sources.matchAll(/["']( jumvi_[a-zA-Z0-9_]+)["']/g)].map(m => m[1]),
  ...[...sources.matchAll(/["'](jumvi_[a-zA-Z0-9_]+)["']/g)].map(m => m[1]),
  ...[...appJs.matchAll(/_PP \+ "([a-zA-Z0-9_]+)"/g)].map(m => "<pp>" + m[1]),
]);

const REQUIRED = [
  "<pp>age_v2", "<pp>attempts_v1", "<pp>avatar_v1", "<pp>badges_unlocked_v1",
  "<pp>cert_id_v1", "<pp>cert_name_v1", "<pp>daily_challenge_v1", "<pp>daily_date_v1",
  "<pp>daily_id_v1", "<pp>daily_n_v1", "<pp>high_scores_v1", "<pp>missions_done_v3",
  "<pp>skips_v1", "<pp>streak_best_v1", "<pp>streak_count_v1", "<pp>streak_freeze_v1",
  "<pp>streak_last_v1", "<pp>today_done_ids_v1",
  "jumvi_3d_hub_enabled", "jumvi_a2hs_dismiss_v1", "jumvi_active_profile_v1",
  "jumvi_active_tab_v1", "jumvi_auto_done_v1", "jumvi_avatar_v1", "jumvi_beacon_visit",
  "jumvi_current_pack_v1", "jumvi_first_visit_v1", "jumvi_hub3d_unsupported_v1",
  "jumvi_hub_intro_done_v1", "jumvi_hub_stars", "jumvi_kids_mode_v1",
  "jumvi_last_opened_id_v1", "jumvi_leo_speak_hint_v1", "jumvi_onboarded_v2",
  "jumvi_only_unfinished_v1", "jumvi_player_count_v1", "jumvi_profiles_v1",
  "jumvi_seen", "jumvi_solid_bg_v1", "jumvi_sound_on_v1", "jumvi_theme_v1",
  "jumvi_tour_done", "jumvi_tts_auto", "jumvi_tutorial_done_v1", "jumvi_visits",
];
const missing = REQUIRED.filter(k => !found.has(k));
check("kayıp anahtar yok", missing, []);

console.log(
  failures === 0
    ? "\n✅ Tüm değişmezler yerinde."
    : `\n❌ ${failures} değişmez ihlali. /tr katmanı yalnızca görünen metni değiştirmeli.`
);
process.exit(failures === 0 ? 0 : 1);
