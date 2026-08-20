/* ============================================================
 * coach-leo-audio.js — English prerecorded Coach Leo narration
 *
 * Central helper for the English-only prerecorded voice pilot. Wraps
 * HTMLAudioElement (not Web Audio buffers — simplicity over the existing
 * chime/tone code, which stays untouched) and guarantees only one Coach
 * Leo prerecorded clip plays at a time across mission narration AND the
 * Red Light / Green Light caller cues.
 *
 * Locale-gated: everything here is a no-op on /tr (window.__JUMVI_LOCALE
 * === 'tr-TR'), so the existing Turkish speechSynthesis path is entirely
 * untouched — /tr never even calls into this file's playback methods.
 *
 * Fails closed: any load/play error (or a stall past a short timeout)
 * calls the caller's onError so it can fall back to the existing TTS path.
 *
 * USAGE
 *   window.CoachLeoAudio.isAvailable()
 *   window.CoachLeoAudio.hasMission(id)
 *   window.CoachLeoAudio.playMission(id, { onEnd, onError })
 *   window.CoachLeoAudio.playCue('green'|'keepPlaying'|'red'|'greatJob', { onEnd, onError })
 *   window.CoachLeoAudio.hasCountdown('3'|'2'|'1'|'go')
 *   window.CoachLeoAudio.playCountdown('3'|'2'|'1'|'go', { onEnd, onError })
 *   window.CoachLeoAudio.preload(id)
 *   window.CoachLeoAudio.preloadCues()
 *   window.CoachLeoAudio.preloadCountdown()
 *   window.CoachLeoAudio.unlock()   // call once inside a user gesture before
 *                                    // async playback (e.g. RLGL's 3-2-1 countdown)
 *   window.CoachLeoAudio.stop()
 *   window.CoachLeoAudio.isPlaying()
 * ============================================================ */
(function (global) {
  "use strict";

  var BASE = "assets/audio/coach-leo/en/";

  // Mission 13 is available only before play / from Hear the steps. app.js
  // continues to suppress all of its during-play speech.
  var MISSION_FILES = {
    1: "01-speed-demon-en.mp3",
    2: "02-red-light-green-light-en.mp3",
    3: "03-quick-slap-en.mp3",
    4: "04-switcharoo-en.mp3",
    5: "05-statue-mode-en.mp3",
    6: "06-number-echo-en.mp3",
    7: "07-rainbow-throws-en.mp3",
    8: "08-the-landing-pad-en.mp3",
    9: "09-step-back-challenge-en.mp3",
    10: "10-power-step-en.mp3",
    11: "11-sky-floater-en.mp3",
    12: "12-heart-high-en.mp3",
    13: "13-silent-mode-en.mp3",
    14: "14-tempo-master-en.mp3",
    15: "15-spotlight-eyes-en.mp3",
    16: "16-1-2-3-go-en.mp3",
    17: "17-mirror-mode-en.mp3",
    18: "18-count-to-10-en.mp3",
    19: "19-round-robin-en.mp3",
    20: "20-crab-walk-relay-en.mp3",
    21: "21-captain-says-en.mp3",
    22: "22-spin-squad-en.mp3",
    23: "23-mix-it-up-en.mp3",
    24: "24-2v2-squad-count-en.mp3",
    25: "25-chill-catch-en.mp3",
    26: "26-tiny-space-en.mp3",
    27: "27-secret-signal-en.mp3",
    28: "28-mind-reader-en.mp3",
    29: "29-stuck-foot-catch-en.mp3",
    30: "30-left-or-right-en.mp3",
    31: "31-cloud-chaser-en.mp3",
    32: "32-home-base-en.mp3",
    33: "33-how-far-can-you-throw-en.mp3",
    34: "34-chase-the-ball-en.mp3",
    35: "35-sky-high-jump-en.mp3",
    36: "36-marathon-rally-en.mp3"
  };

  var CUE_FILES = {
    green: "green-light-en.mp3",       // first GREEN of a run
    keepPlaying: "keep-playing-en.mp3", // every GREEN after the first
    red: "red-light-en.mp3",
    greatJob: "great-job-en.mp3"        // round finished
  };

  /* ── 3 · 2 · 1 · GO start sequence ─────────────────────────────────────────
   * The mission-start countdown is Coach Leo speaking, so it belongs to THIS
   * system — it does not belong to app.js's speechSynthesis helper, which is
   * where it used to live. Reaching that helper meant an English family heard
   * Leo's recorded voice read the mission and then the phone's built-in en-US
   * TTS voice count them in: two different Coach Leos, back to back.
   *
   * The map is intentionally EMPTY until the ElevenLabs countdown renders
   * exist on disk. While it is empty, English gets the visual countdown plus
   * the existing tick (app.js clickSound) and NO voice — a quiet, correct
   * start beats re-exposing the voice this change removes. Turkish is
   * untouched either way: isAvailable() is false on /tr, so app.js keeps using
   * its speechSynthesis path there, which tr/i18n.js re-speaks in tr-TR.
   *
   * TO ENABLE: drop the four clips into assets/audio/coach-leo/en/game-cues/
   * and fill in the keys below. They are runtime-cached by the service worker
   * like every other narration mp3 — nothing else needs to change, and
   * tools/check-coach-leo-audio.mjs will start asserting the files exist. */
  var COUNTDOWN_FILES = {
    "3": "countdown-3-en.mp3",
    "2": "countdown-2-en.mp3",
    "1": "countdown-1-en.mp3",
    go:  "countdown-go-en.mp3"
  };

  /* ── Fixed spoken lines that are NOT mission narration ─────────────────────
   * Leo's island greeting and the timer's "Time's up" were still reaching
   * window.speechSynthesis, i.e. the phone's own default en-US voice. A child
   * heard Leo read the mission in his recorded voice and then a different
   * person greet them on the island — the same mismatch the countdown had.
   *
   * Same all-or-nothing contract as COUNTDOWN_FILES: the map stays EMPTY until
   * the renders exist, and while it is empty English stays SILENT on these
   * lines. That is safe here and only here, because every one of them is also
   * on screen — the island greeting is a speech bubble, "Time's up!" is the
   * timer display. Nothing is lost but the duplicate voice.
   *
   * Deliberately NOT routed through here: the mid-mission reminders and the
   * Quick Play cues. Those play while the phone is on the floor and the child
   * is looking at the ball, so they have no visual twin — silence there would
   * delete the coaching, not de-duplicate it. They keep speaking through TTS
   * until a recorded set exists.
   *
   * TO ENABLE: drop the clips in and fill the keys below. tools/check-coach-
   * leo-audio.mjs starts asserting they exist; tools/voice-manifest.mjs lists
   * every line still waiting for a render. */
  var LINE_FILES = {
    "hub-greeting-1": "hub/hub-greeting-1-en.mp3",
    "hub-bubble-1": "hub/hub-bubble-1-en.mp3",
    "times-up": "system/times-up-check-phone-en.mp3"
  };

  /* Callers that only hold the sentence (the 3D hub passes text, not a key)
   * resolve it here. Keys must match the text in jumvi-hub-app.js / app.js
   * exactly; a miss simply means "no clip", never a wrong clip. */
  var LINE_TEXT = {
    "Welcome to my island! Tap the ground and I'll walk there!": "hub-greeting-1",
    "Great job! Now find a glowing gate": "hub-bubble-1",
    "Time's up! Great job! Check the phone when you're ready.": "times-up"
  };

  // Short mission-specific recordings for English quick/recap replays and
  // in-play reminders. Missing IDs intentionally retain their TTS fallback.
  var COACHING_FILES = {
    1: "01-speed-demon-en.mp3", 3: "03-quick-slap-en.mp3",
    4: "04-switcharoo-en.mp3", 5: "05-statue-mode-en.mp3",
    6: "06-number-echo-en.mp3", 7: "07-rainbow-throws-en.mp3",
    8: "08-the-landing-pad-en.mp3", 10: "10-power-step-en.mp3",
    11: "11-sky-floater-en.mp3", 12: "12-heart-high-en.mp3",
    14: "14-tempo-master-en.mp3", 15: "15-spotlight-eyes-en.mp3",
    16: "16-1-2-3-go-en.mp3", 17: "17-mirror-mode-en.mp3",
    18: "18-count-to-10-en.mp3", 25: "25-chill-catch-en.mp3",
    26: "26-tiny-space-en.mp3", 27: "27-secret-signal-en.mp3",
    29: "29-stuck-foot-catch-en.mp3", 30: "30-left-or-right-en.mp3",
    31: "31-cloud-chaser-en.mp3", 32: "32-home-base-en.mp3",
    34: "34-chase-the-ball-en.mp3", 35: "35-sky-high-jump-en.mp3",
    36: "36-marathon-rally-en.mp3",
    9: "09-step-back-challenge-en.mp3",
    19: ["19-round-robin-a-en.mp3", "19-round-robin-b-en.mp3"],
    20: ["20-crab-walk-relay-a-en.mp3", "20-crab-walk-relay-b-en.mp3"],
    21: ["21-captain-says-a-en.mp3", "21-captain-says-b-en.mp3"],
    22: ["22-spin-squad-a-en.mp3", "22-spin-squad-b-en.mp3"],
    23: ["23-mix-it-up-a-en.mp3", "23-mix-it-up-b-en.mp3"],
    24: ["24-2v2-squad-count-a-en.mp3", "24-2v2-squad-count-b-en.mp3"],
    28: "28-mind-reader-en.mp3",
    33: "33-how-far-can-you-throw-en.mp3"
  };

  var STALL_MS = 4000; // no 'playing' event within this window => fall back to TTS

  var activeAudio = null;
  var activeToken = 0;

  function locale() {
    return global.__JUMVI_LOCALE === "tr-TR" ? "tr" : "en";
  }

  function isAvailable() {
    return locale() === "en" && typeof Audio !== "undefined";
  }

  function hasMission(id) {
    return isAvailable() && Object.prototype.hasOwnProperty.call(MISSION_FILES, id);
  }

  function missionSrc(id) {
    return MISSION_FILES[id] ? BASE + "missions/" + MISSION_FILES[id] : null;
  }

  function cueSrc(key) {
    return CUE_FILES[key] ? BASE + "game-cues/" + CUE_FILES[key] : null;
  }

  function hasCountdown(step) {
    return isAvailable() && Object.prototype.hasOwnProperty.call(COUNTDOWN_FILES, String(step));
  }

  function countdownSrc(step) {
    var f = COUNTDOWN_FILES[String(step)];
    return f ? BASE + "game-cues/" + f : null;
  }

  function hasLine(key) {
    return isAvailable() && Object.prototype.hasOwnProperty.call(LINE_FILES, String(key));
  }

  function lineSrc(key) {
    var f = LINE_FILES[String(key)];
    return f ? BASE + f : null;
  }

  function coachingFile(id, reminderIndex) {
    var files = COACHING_FILES[id];
    if (Array.isArray(files)) return files[Number(reminderIndex) || 0] || null;
    return files || null;
  }

  function hasCoaching(id, reminderIndex) {
    return isAvailable() && !!coachingFile(id, reminderIndex);
  }

  function coachingSrc(id, reminderIndex) {
    var f = coachingFile(id, reminderIndex);
    return f ? BASE + "mission-coaching/" + f : null;
  }

  // Returns the clip key for a sentence, or "" when that sentence has no clip.
  function lineKeyForText(text) {
    var t = String(text == null ? "" : text).replace(/\s+/g, " ").trim();
    return Object.prototype.hasOwnProperty.call(LINE_TEXT, t) ? LINE_TEXT[t] : "";
  }

  function stop() {
    activeToken++;
    if (activeAudio) {
      try { activeAudio.pause(); activeAudio.currentTime = 0; } catch (_) {}
      activeAudio.onplaying = null;
      activeAudio.onended = null;
      activeAudio.onerror = null;
      activeAudio = null;
      if (global.JumviMusic) { try { global.JumviMusic.unduck(); } catch (_) {} }
    }
  }

  function isPlaying() {
    return !!activeAudio;
  }

  function playSrc(src, cb) {
    var onEnd = cb && cb.onEnd;
    var onError = cb && cb.onError;
    stop(); // enforce single active Coach Leo clip
    var token = ++activeToken;
    var settled = false;
    var started = false;
    var audio;
    try {
      audio = new Audio(src);
    } catch (_) {
      // Synchronous construction failure: report "did not start" and let the
      // caller run its own fallback, same contract as hasMission() === false.
      // Do NOT also invoke onError here — that would fire the caller's
      // fallback a second time.
      return false;
    }
    audio.preload = "auto";

    var stallTimer = setTimeout(function () {
      if (!started) finish(new Error("stalled"));
    }, STALL_MS);

    function finish(err) {
      if (settled || token !== activeToken) return;
      settled = true;
      clearTimeout(stallTimer);
      if (activeAudio === audio) activeAudio = null;
      try { audio.pause(); } catch (_) {}
      if (global.JumviMusic) { try { global.JumviMusic.unduck(); } catch (_) {} }
      if (err) { if (onError) onError(); } else { if (onEnd) onEnd(); }
    }

    audio.onplaying = function () {
      started = true;
      clearTimeout(stallTimer);
      if (global.JumviMusic) { try { global.JumviMusic.duck(); } catch (_) {} }
    };
    audio.onended = function () { finish(null); };
    audio.onerror = function () { finish(new Error("audio error")); };

    activeAudio = audio;
    try {
      var p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(function () { finish(new Error("play() rejected")); });
      }
    } catch (e) {
      finish(e);
    }
    return true;
  }

  function playMission(id, cb) {
    if (!hasMission(id)) return false;
    return playSrc(missionSrc(id), cb);
  }

  function playCoaching(id, reminderIndex, cb) {
    if (typeof reminderIndex === "object" || reminderIndex == null) {
      cb = reminderIndex;
      reminderIndex = undefined;
    }
    if (!hasCoaching(id, reminderIndex)) return false;
    return playSrc(coachingSrc(id, reminderIndex), cb);
  }

  function playCue(key, cb) {
    if (!isAvailable() || !CUE_FILES[key]) return false;
    return playSrc(cueSrc(key), cb);
  }

  // One step of the 3-2-1-GO sequence. Returns false when no clip is mapped,
  // which the caller must treat as "stay silent", NOT as "use the old TTS".
  function playCountdown(step, cb) {
    if (!hasCountdown(step)) return false;
    return playSrc(countdownSrc(step), cb);
  }

  function preload(id) {
    if (!hasMission(id)) return;
    try {
      var a = new Audio();
      a.preload = "auto";
      a.src = missionSrc(id);
      a.load();
    } catch (_) {}
  }

  function preloadCues() {
    if (!isAvailable()) return;
    Object.keys(CUE_FILES).forEach(function (key) {
      try {
        var a = new Audio();
        a.preload = "auto";
        a.src = cueSrc(key);
        a.load();
      } catch (_) {}
    });
  }

  // Warms only the four countdown clips (no-op while COUNTDOWN_FILES is
  // empty). Deliberately separate from preloadCues(): the RLGL caller cues are
  // irrelevant to a plain timer mission, and §19 says do not pull audio nobody
  // is about to hear.
  function preloadCountdown() {
    if (!isAvailable()) return;
    Object.keys(COUNTDOWN_FILES).forEach(function (step) {
      try {
        var a = new Audio();
        a.preload = "auto";
        a.src = countdownSrc(step);
        a.load();
      } catch (_) {}
    });
  }

  // Browsers only allow audio autoplay tied to a user gesture. Mission
  // narration always starts synchronously inside the Start tap, so it needs
  // no unlock — but the RLGL caller's cues fire later from timers, well after
  // the gesture that started it. Call this once, synchronously, inside that
  // gesture (mirrors jumvi-redlight.js's speechSynthesis primeSpeech trick).
  function unlock() {
    if (!isAvailable()) return;
    try {
      var a = new Audio(cueSrc("green"));
      a.muted = true;
      var p = a.play();
      if (p && typeof p.catch === "function") p.catch(function () {});
      setTimeout(function () {
        try { a.pause(); a.currentTime = 0; } catch (_) {}
      }, 60);
    } catch (_) {}
  }

  function playLine(key, cb) {
    var src = lineSrc(key);
    if (!src) return false;
    return playSrc(src, cb);
  }

  global.CoachLeoAudio = {
    isAvailable: isAvailable,
    hasMission: hasMission,
    hasCoaching: hasCoaching,
    playCoaching: playCoaching,
    hasLine: hasLine,
    playLine: playLine,
    lineKeyForText: lineKeyForText,
    playMission: playMission,
    playCue: playCue,
    hasCountdown: hasCountdown,
    playCountdown: playCountdown,
    preload: preload,
    preloadCues: preloadCues,
    preloadCountdown: preloadCountdown,
    unlock: unlock,
    stop: stop,
    isPlaying: isPlaying
  };
})(window);
