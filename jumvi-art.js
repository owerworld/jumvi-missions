/* JUMVI Soft-Play 3D asset registry.
 * Expressive art (mission/category/badge/avatar/onboarding) lives here.
 * Small chrome controls stay in the monochrome .jic SVG system.
 */
(function initJumviArt(){
  "use strict";

  const MISSION_SLUGS = [
    null,
    "01-speed-demon", "02-red-light-green-light", "03-quick-slap", "04-switcharoo", "05-statue-mode", "06-number-echo",
    "07-rainbow-throws", "08-the-landing-pad", "09-step-back-challenge", "10-power-step", "11-sky-floater", "12-heart-high",
    "13-silent-mode", "14-tempo-master", "15-spotlight-eyes", "16-1-2-3-go", "17-mirror-mode", "18-count-to-10",
    "19-round-robin", "20-crab-walk-relay", "21-middle-defender", "22-spin-squad", "23-mix-it-up", "24-2v2-squad-count",
    "25-chill-catch", "26-tiny-space", "27-secret-signal", "28-mind-reader", "29-stuck-foot-catch", "30-left-or-right",
    "31-cloud-chaser", "32-home-base", "33-how-far-can-you-throw", "34-chase-the-ball", "35-sky-high-jump", "36-marathon-rally"
  ];

  const PACK_FILES = Object.freeze({
    "Aim Master": "aim-master",
    "Focus Control": "focus-control",
    "Team Duo": "team-duo",
    "Indoor Compact": "indoor-compact",
    "Beach/Park": "beach-park",
    "Reflex Rush": "reflex-rush"
  });

  const BADGE_IDS = new Set(["first", "aim", "zen", "team", "indoor", "outdoor", "reflex", "streak3", "streak7", "champ", "zippy", "unlocked"]);
  const AVATAR_IDS = Object.freeze(["monkey", "dog", "dinosaur", "unicorn", "alien", "robot", "fox", "panda", "tiger", "koala", "frog", "butterfly"]);
  const AVATAR_SET = new Set(AVATAR_IDS);
  const LEGACY_AVATAR_IDS = Object.freeze({
    "\u{1F435}": "monkey",
    "\u{1F436}": "dog",
    "\u{1F995}": "dinosaur",
    "\u{1F984}": "unicorn",
    "\u{1F47D}": "alien",
    "\u{1F916}": "robot",
    "\u{1F98A}": "fox",
    "\u{1F43C}": "panda",
    "\u{1F42F}": "tiger",
    "\u{1F428}": "koala",
    "\u{1F438}": "frog",
    "\u{1F98B}": "butterfly"
  });
  const SPECIAL_IDS = new Set(["ages-3-5", "ages-6-8", "ages-8-up", "leo-island", "streak", "celebration"]);

  const mission = (id) => {
    const slug = MISSION_SLUGS[Number(id)] || "";
    return slug ? `assets/ui/missions/${slug}.webp` : "";
  };
  const pack = (key) => PACK_FILES[key] ? `assets/ui/packs/${PACK_FILES[key]}.webp` : "";
  const badge = (id) => BADGE_IDS.has(String(id)) ? `assets/ui/badges/${id}.webp` : "";
  const special = (id) => SPECIAL_IDS.has(String(id)) ? `assets/ui/special/${id}.webp` : "";

  function avatarId(value){
    if(typeof value === "number" && Number.isFinite(value)) return AVATAR_IDS[value] || "monkey";
    const raw = String(value || "");
    if(AVATAR_SET.has(raw)) return raw;
    return LEGACY_AVATAR_IDS[raw] || "monkey";
  }
  const avatar = (value) => `assets/ui/avatars/${avatarId(value)}.webp`;

  function esc(value){
    return String(value == null ? "" : value)
      .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
      .replace(/"/g,"&quot;").replace(/'/g,"&#039;");
  }
  function img(src, className, alt, eager){
    if(!src) return "";
    return `<img src="${esc(src)}" class="${esc(className || "jumviArtImg")}" alt="${esc(alt || "")}" width="256" height="256" loading="${eager ? "eager" : "lazy"}" decoding="async">`;
  }

  window.JUMVI_ART = Object.freeze({
    AVATAR_IDS,
    mission,
    pack,
    badge,
    avatar,
    avatarId,
    special,
    img
  });
})();
