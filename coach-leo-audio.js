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
 *   window.CoachLeoAudio.preload(id)
 *   window.CoachLeoAudio.preloadCues()
 *   window.CoachLeoAudio.unlock()   // call once inside a user gesture before
 *                                    // async playback (e.g. RLGL's 3-2-1 countdown)
 *   window.CoachLeoAudio.stop()
 *   window.CoachLeoAudio.isPlaying()
 * ============================================================ */
(function (global) {
  "use strict";

  var BASE = "assets/audio/coach-leo/en/";

  // Mission 13 (Silent Mode) is intentionally absent — no file, no key.
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

  function playCue(key, cb) {
    if (!isAvailable() || !CUE_FILES[key]) return false;
    return playSrc(cueSrc(key), cb);
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

  global.CoachLeoAudio = {
    isAvailable: isAvailable,
    hasMission: hasMission,
    playMission: playMission,
    playCue: playCue,
    preload: preload,
    preloadCues: preloadCues,
    unlock: unlock,
    stop: stop,
    isPlaying: isPlaying
  };
})(window);
