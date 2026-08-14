/* ============================================================
 * jumvi-redlight.js  —  Red Light, Green Light caller (Mission 2 only)
 *
 * The phone becomes the "caller": it flips between GREEN and RED at
 * random intervals, painting the whole screen + speaking the command
 * out loud ("Green light!" / "Red light!"), with a countdown on top.
 * Green = play, Red = everyone FREEZE. Ends after the set duration.
 *
 * USAGE
 *   <script src="jumvi-redlight.js"></script>      // exposes window.JumviRedLight
 *   JumviRedLight.start({ duration: 60, speed: 'normal', sound: true, onEnd: ()=>{} });
 *   JumviRedLight.stop();                          // close early if needed
 *
 * Options (all optional):
 *   duration : total seconds (default 60)
 *   speed    : 'easy' | 'normal' | 'hard'  (how often RED hits; default 'normal')
 *   sound    : speak + beep (default true)
 *   onEnd    : callback fired when the round finishes or is closed
 *
 * No external dependencies. Must be triggered by a user gesture (a button
 * tap) so the browser allows audio. Self-injects its own CSS once.
 * ============================================================ */
(function (global) {
  'use strict';

  var CSS = '\
.jrl-overlay{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;\
align-items:center;justify-content:center;color:#fff;text-align:center;\
font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;\
transition:background-color .12s ease;background:#0f172a;-webkit-user-select:none;user-select:none;\
overscroll-behavior:contain;touch-action:none;}\
.jrl-green{background:#16a34a}.jrl-red{background:#dc2626}.jrl-idle{background:#0f172a}\
.jrl-top{position:absolute;top:max(16px,env(safe-area-inset-top));left:0;right:0;\
display:flex;align-items:center;justify-content:space-between;padding:0 18px;font-size:15px;font-weight:600;\
color:rgba(255,255,255,.92)}\
.jrl-close{position:absolute;top:max(12px,env(safe-area-inset-top));right:12px;width:42px;height:42px;\
border:0;background:rgba(0,0,0,.18);color:#fff;border-radius:50%;font-size:22px;line-height:1;cursor:pointer;\
display:flex;align-items:center;justify-content:center}\
.jrl-light{display:flex;flex-direction:column;gap:9px;padding:9px;background:rgba(0,0,0,.22);\
border-radius:14px;margin-bottom:22px}\
.jrl-dot{width:26px;height:26px;border-radius:50%;background:rgba(255,255,255,.22);transition:background-color .1s}\
.jrl-dot.on-red{background:#fecaca}.jrl-dot.on-green{background:#bbf7d0}\
.jrl-big{font-size:clamp(38px,11vw,76px);font-weight:800;letter-spacing:1px;margin:0;line-height:1.05}\
.jrl-sub{font-size:clamp(18px,5vw,28px);font-weight:500;margin-top:8px;opacity:.95}\
.jrl-end{font-size:clamp(30px,8vw,56px);font-weight:800}\
.jrl-hint{position:absolute;bottom:max(22px,env(safe-area-inset-bottom));left:0;right:0;\
font-size:13px;color:rgba(255,255,255,.75);padding:0 24px}\
';

  var injected = false;
  function injectCSS() {
    if (injected) return;
    var s = document.createElement('style');
    s.id = 'jrl-style';
    s.textContent = CSS;
    document.head.appendChild(s);
    injected = true;
  }

  // ── TIMING CALIBRATION ─────────────────────────────────────────────
  // One JUMVI "round" = unstick paddle velcro → throw → fly → re-stick
  // to other paddle. Field-measured estimate (kid, close range, soft
  // velcro): T ≈ 2.3 s. The "snap" range = one full round (no slack);
  // "normal" = 1 relaxed round or 2 quick rounds; "long lull" = 2+ rounds
  // → player gets sleepy → SURPRISE red.
  //
  // RED ranges DON'T scale with T — once the ball is caught it stays
  // stuck to the paddle (velcro), so freezing is naturally easy and
  // 1.6–2.6 s is plenty.
  //
  // To recalibrate for your actual paddles:
  //   1. Time 5 rounds at kid speed, divide → newT seconds.
  //   2. Scale each GREEN range by (newT / 2.3). Leave RED ranges alone.
  //
  // SPEEDS schema (8 numbers):
  //   [snapMin, snapMax, normMin, normMax, longMin, longMax, redMin, redMax]
  // Picker weights: 15% snap, 60% normal, 25% long lull (set in
  // pickGreenDuration below).
  var SPEEDS = {
    easy:   [2.6, 3.4, 3.4, 5.0, 5.5, 7.0, 1.8, 3.0],  // ages 3–5, learners
    normal: [2.3, 3.0, 3.0, 4.5, 4.8, 6.0, 1.6, 2.6],  // default — T=2.3s
    hard:   [2.0, 2.6, 2.6, 3.8, 4.0, 5.0, 1.4, 2.2]   // ages 7+, faster
  };
  // After this many switches, allow trickier patterns (double-red, false-restart)
  var TRICK_AFTER_SWITCHES = 3;
  var DOUBLE_RED_CHANCE = 0.15;   // % of reds that turn into "false reset" gotcha
  var DOUBLE_RED_COOLDOWN_S = 6;  // min seconds between two gotchas

  var state = {
    active: false, overlay: null, dots: [], bigEl: null, subEl: null, timerEl: null,
    timers: [], endAt: 0, tickId: 0, opts: null, audioCtx: null,
    switchCount: 0,           // total light changes — gates trickery
    lastDoubleRedAt: -999,    // throttle: see DOUBLE_RED_COOLDOWN_S above
    voicesReady: false, speechPrimed: false, voice: null
  };

  function rand(min, max) { return min + Math.random() * (max - min); }
  function chance(p)      { return Math.random() < p; }

  // ── iOS-safe speech ──────────────────────────────────────────────
  // iPhone (esp. Safari/PWA): speechSynthesis needs (1) a user gesture, (2) voices
  // pre-loaded via voiceschanged, (3) a silent "prime" utterance before the real
  // one, and (4) a tiny delay between cancel() and the next speak() or iOS drops
  // the utterance silently.
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    try {
      var voices = window.speechSynthesis.getVoices() || [];
      if (voices.length) {
        // Prefer "Enhanced/Premium" voices for clarity (the compact ones sound
        // muffled, especially on iOS). These names cover iOS (Samantha, Karen,
        // Daniel, Moira, Aaron, Nicky), Android (Google US English), and
        // desktop browsers (Microsoft Aria/Jenny, Alex).
        var preferred = /Samantha|Karen|Daniel|Moira|Aaron|Nicky|Alex|Google US English|Microsoft Aria|Microsoft Jenny|Microsoft Guy/i;
        state.voice =
          voices.find(function (v) { return /^en/i.test(v.lang) && preferred.test(v.name); }) ||
          voices.find(function (v) { return v.localService && /^en-US/i.test(v.lang); }) ||
          voices.find(function (v) { return v.localService && /^en/i.test(v.lang); }) ||
          voices.find(function (v) { return /^en-US/i.test(v.lang); }) ||
          voices.find(function (v) { return /^en/i.test(v.lang); }) ||
          voices[0] || null;
        state.voicesReady = true;
      }
    } catch (e) {}
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    try { window.speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (_) {}
  }

  function primeSpeech() {
    if (state.speechPrimed) return;
    try {
      if (!('speechSynthesis' in window)) return;
      // iOS needs a silent priming utterance on the user gesture before any
      // real speak() will actually play out loud.
      var prime = new SpeechSynthesisUtterance(' ');
      prime.volume = 0.01; prime.rate = 1; prime.pitch = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(prime);
      loadVoices();
      state.speechPrimed = true;
    } catch (e) {}
  }

  function speak(text, on) {
    if (!on) return;
    try {
      if (!('speechSynthesis' in window)) return;
      if (!state.speechPrimed) primeSpeech();

      window.speechSynthesis.cancel();
      // ~120ms gap between cancel() and speak() — iOS quirk; without this the
      // first utterance after a cancel is often dropped silently on iOS 15+.
      // 120ms also lets the pre-chime breathe so voice doesn't clash with it.
      state.timers.push(setTimeout(function () {
        if (!state.active) return;
        var u = new SpeechSynthesisUtterance(text);
        u.lang = 'en-US';
        // Slower rate (0.88) reads as MUCH clearer for short phrases on iOS
        // and Android compact voices. Above-default rate (was 1.05) was
        // chosen to dodge iOS skipping, but the prime utterance handles that
        // now — clarity wins.
        u.rate = 0.88; u.pitch = 1; u.volume = 1;
        if (state.voice) u.voice = state.voice;
        try { window.speechSynthesis.speak(u); } catch (_) {}
      }, 120));
    } catch (e) {}
  }

  // Subtle haptic — works on Android & iOS PWA (silent on desktop, harmless)
  function buzz(pattern) {
    try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) {}
  }

  // Ensure AudioContext exists (re-used for all tones)
  function ensureCtx() {
    try {
      if (!state.audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        state.audioCtx = new AC();
      }
      if (state.audioCtx.state === 'suspended') state.audioCtx.resume();
      return state.audioCtx;
    } catch (e) { return null; }
  }

  // Single tone with attack/decay envelope — sounds cleaner than raw on/off
  function playTone(freq, dur, startOffset, type, peakGain) {
    if (!state.opts || !state.opts.sound) return;
    var ctx = ensureCtx(); if (!ctx) return;
    try {
      var t = ctx.currentTime + (startOffset || 0);
      var o = ctx.createOscillator();
      var g = ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      var peak = peakGain == null ? 0.35 : peakGain;
      // attack-sustain-release envelope (clearer, no click)
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + 0.018);
      g.gain.setValueAtTime(peak, t + dur * 0.55);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
  }

  // GREEN cue — happy ascending major triad (C5 → E5 → G5), like a doorbell
  function chimeGreen() {
    playTone(523.25, 0.13, 0.00, 'sine', 0.42); // C5
    playTone(659.25, 0.13, 0.11, 'sine', 0.42); // E5
    playTone(783.99, 0.22, 0.22, 'sine', 0.48); // G5 — held longer = "GO!"
  }

  // RED cue — urgent low pulse, descending (G3 → C3), like a buzzer
  function chimeRed() {
    playTone(196.00, 0.13, 0.00, 'triangle', 0.45); // G3
    playTone(196.00, 0.13, 0.16, 'triangle', 0.45); // G3 again — double pulse
    playTone(130.81, 0.32, 0.32, 'triangle', 0.55); // C3 — low, urgent STOP
  }

  // Small countdown blip (3-2-1)
  function blip() {
    playTone(700, 0.08, 0, 'sine', 0.35);
  }

  // Final whistle when time's up
  function chimeEnd() {
    playTone(880, 0.10, 0.00, 'sine', 0.40);
    playTone(1175, 0.18, 0.10, 'sine', 0.45);
  }

  function setLight(mode) { // 'green' | 'red' | 'off'
    state.dots.forEach(function (d) { d.className = 'jrl-dot'; });
    if (mode === 'red') state.dots[0].classList.add('on-red');
    if (mode === 'green') state.dots[2].classList.add('on-green');
  }

  function fmt(sec) {
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function clearTimers() {
    state.timers.forEach(clearTimeout);
    state.timers = [];
    if (state.tickId) { clearInterval(state.tickId); state.tickId = 0; }
  }

  function showGreen() {
    if (!state.active) return;
    state.overlay.className = 'jrl-overlay jrl-green';
    state.bigEl.textContent = 'GREEN LIGHT';
    state.subEl.textContent = 'Play!';
    setLight('green');
    chimeGreen();  // C5–E5–G5 ascending triad (cleaner than single beep)
    buzz(30);      // short, soft go-signal
    speak('Green light!', state.opts.sound);
    state.switchCount++;
    scheduleNext('green');
  }

  function showRed() {
    if (!state.active) return;
    state.overlay.className = 'jrl-overlay jrl-red';
    state.bigEl.textContent = 'RED LIGHT';
    state.subEl.textContent = 'FREEZE!';
    setLight('red');
    chimeRed();              // G3-G3-C3 urgent low pulse (alarm-like)
    buzz([45, 35, 60]);      // distinct stop haptic pattern
    speak('Red light! Freeze!', state.opts.sound);  // richer phrase reads clearer
    state.switchCount++;
    scheduleNext('red');
  }

  // ── Randomized scheduler ────────────────────────────────────────────────
  // Instead of strict green→red→green→red with narrow time windows, we mix:
  //  • Green: 60% normal range, 25% long lull (sleepy player → SURPRISE red),
  //           15% short snap (just enough to react, then red again)
  //  • Red:   normal range, BUT after a green we sometimes (~10%) trigger a
  //           "double red" — a second red follows the green quickly, giving
  //           the false impression of returning to safety. Throttled so it
  //           can't fire twice in a row.
  // SPEEDS indices: 0=snapMin 1=snapMax 2=normMin 3=normMax 4=longMin 5=longMax 6=redMin 7=redMax
  function pickGreenDuration() {
    var p = SPEEDS[state.opts.speed] || SPEEDS.normal;
    var roll = Math.random();
    if (roll < 0.15) return rand(p[0], p[1]);  // 15% snap  — one full round, no slack
    if (roll < 0.75) return rand(p[2], p[3]);  // 60% normal — 1 relaxed + 1 quick, or 2 sıkı
    return rand(p[4], p[5]);                    // 25% long  — 2+ rounds, then SURPRISE red
  }
  function pickRedDuration() {
    var p = SPEEDS[state.opts.speed] || SPEEDS.normal;
    return rand(p[6], p[7]);
  }

  function scheduleNext(current) {
    var remaining = (state.endAt - Date.now()) / 1000;
    if (remaining <= 0.3) return; // tick loop will call finish()

    var dur;
    var nextFn;
    if (current === 'green') {
      dur = pickGreenDuration();
      nextFn = showRed;
    } else {
      // RED → normally GREEN, but occasionally chain a "double red" (false reset)
      var nowSec = (Date.now() - (state.endAt - state.opts.duration * 1000)) / 1000;
      var canTrick = state.switchCount >= TRICK_AFTER_SWITCHES
                  && (nowSec - state.lastDoubleRedAt) > DOUBLE_RED_COOLDOWN_S;
      if (canTrick && chance(DOUBLE_RED_CHANCE)) {
        // Brief "going-back-to-green" hint via a 350ms idle flash, then red again
        state.lastDoubleRedAt = nowSec;
        dur = pickRedDuration();
        nextFn = function () {
          if (!state.active) return;
          state.overlay.className = 'jrl-overlay jrl-idle';
          state.bigEl.textContent = '…';
          state.subEl.textContent = '';
          setLight('off');
          state.timers.push(setTimeout(showRed, 350)); // gotcha — back to red
        };
      } else {
        dur = pickRedDuration();
        nextFn = showGreen;
      }
    }
    state.timers.push(setTimeout(nextFn, dur * 1000));
  }

  function finish() {
    if (!state.active) return;
    clearTimers();
    state.overlay.className = 'jrl-overlay jrl-idle';
    state.bigEl.textContent = "Time's up!";
    state.bigEl.className = 'jrl-end';
    state.subEl.textContent = 'Great freezing!';
    setLight('off');
    state.timerEl.textContent = '0:00';
    try { window.speechSynthesis.cancel(); } catch (e) {}
    chimeEnd();
    speak("Time is up! Great freezing!", state.opts.sound);
    state.timers.push(setTimeout(function () { teardown(true); }, 2600));
  }

  function teardown(callEnd) {
    var onEnd = state.opts && state.opts.onEnd;
    clearTimers();
    try { window.speechSynthesis.cancel(); } catch (e) {}
    if (state.overlay && state.overlay.parentNode) state.overlay.parentNode.removeChild(state.overlay);
    state.active = false; state.overlay = null; state.dots = [];
    if (callEnd && typeof onEnd === 'function') { try { onEnd(); } catch (e) {} }
  }

  function build() {
    var ov = document.createElement('div');
    ov.className = 'jrl-overlay jrl-idle';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Red Light Green Light caller');

    var top = document.createElement('div');
    top.className = 'jrl-top';
    var timer = document.createElement('span'); timer.textContent = '0:00';
    var vol = document.createElement('span'); vol.innerHTML = '<i class="jic jic-volume" aria-hidden="true"></i>';
    top.appendChild(timer); top.appendChild(vol);

    var close = document.createElement('button');
    close.className = 'jrl-close'; close.setAttribute('aria-label', 'Close'); close.innerHTML = '&times;';
    close.addEventListener('click', function () { teardown(true); });

    var light = document.createElement('div');
    light.className = 'jrl-light';
    var dots = [];
    for (var i = 0; i < 3; i++) { var d = document.createElement('span'); d.className = 'jrl-dot'; light.appendChild(d); dots.push(d); }

    var big = document.createElement('h2'); big.className = 'jrl-big'; big.textContent = 'Get ready…';
    var sub = document.createElement('div'); sub.className = 'jrl-sub'; sub.textContent = '';
    var hint = document.createElement('div'); hint.className = 'jrl-hint';
    hint.textContent = 'Green = throw & catch · Red = FREEZE (even mid-throw!)';

    ov.appendChild(top); ov.appendChild(close); ov.appendChild(light);
    ov.appendChild(big); ov.appendChild(sub); ov.appendChild(hint);
    document.body.appendChild(ov);

    state.overlay = ov; state.dots = dots; state.bigEl = big; state.subEl = sub; state.timerEl = timer;
  }

  function start(opts) {
    if (state.active) return; // already running
    injectCSS();
    state.opts = {
      duration: (opts && opts.duration) || 60,
      speed: (opts && opts.speed) || 'normal',
      sound: opts && opts.sound === false ? false : true,
      onEnd: opts && opts.onEnd
    };
    state.active = true;
    state.switchCount = 0;
    state.lastDoubleRedAt = -999;
    build();

    // Audio + speech warm-up on the user gesture (especially iOS):
    //  - Make sure AudioContext is resumed (some iOS versions require this
    //    before any beep, even though the gesture should already allow it).
    //  - Prime speechSynthesis with a silent utterance so subsequent speak()
    //    calls actually play. iOS Safari drops the first utterance otherwise.
    try {
      if (!state.audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) state.audioCtx = new AC();
      }
      if (state.audioCtx && state.audioCtx.state === 'suspended') {
        state.audioCtx.resume();
      }
    } catch (e) {}
    if (state.opts.sound) primeSpeech();

    // 3-2-1 ready countdown, then go
    var n = 3;
    state.bigEl.textContent = '3'; state.subEl.textContent = 'Get ready…';
    blip();
    var ready = setInterval(function () {
      n--;
      if (n > 0) { state.bigEl.textContent = String(n); blip(); }
      else {
        clearInterval(ready);
        state.endAt = Date.now() + state.opts.duration * 1000;
        // live countdown + end check
        state.tickId = setInterval(function () {
          var rem = (state.endAt - Date.now()) / 1000;
          state.timerEl.textContent = fmt(rem);
          if (rem <= 0) finish();
        }, 200);
        showGreen(); // always begin on green (predictable START is fine; surprises come during play)
      }
    }, 1000);

    state.timers.push(ready);
  }

  function stop() { teardown(true); }
  function isActive() { return !!state.active; }

  global.JumviRedLight = { start: start, stop: stop, isActive: isActive };
})(window);
