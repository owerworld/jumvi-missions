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

  // ---- speed presets: [greenMin, greenMax, redMin, redMax] in seconds ----
  var SPEEDS = {
    easy:   [3.5, 6.5, 1.5, 2.5],
    normal: [2.5, 5.0, 1.5, 3.5],
    hard:   [1.4, 3.2, 1.5, 3.0]
  };

  var state = {
    active: false, overlay: null, dots: [], bigEl: null, subEl: null, timerEl: null,
    timers: [], endAt: 0, tickId: 0, opts: null, audioCtx: null
  };

  function rand(min, max) { return min + Math.random() * (max - min); }

  function speak(text, on) {
    if (!on) return;
    try {
      if (!('speechSynthesis' in window)) return;
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = 1; u.pitch = 1; u.volume = 1;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) {}
  }

  function beep(freq, dur, on) {
    if (!on) return;
    try {
      if (!state.audioCtx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        state.audioCtx = new AC();
      }
      var ctx = state.audioCtx;
      if (ctx.state === 'suspended') ctx.resume();
      var o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      o.connect(g); g.connect(ctx.destination);
      var t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.start(t); o.stop(t + dur + 0.02);
    } catch (e) {}
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
    beep(880, 0.16, state.opts.sound);
    speak('Green light!', state.opts.sound);
    scheduleNext('green');
  }

  function showRed() {
    if (!state.active) return;
    state.overlay.className = 'jrl-overlay jrl-red';
    state.bigEl.textContent = 'RED LIGHT';
    state.subEl.textContent = 'FREEZE!';
    setLight('red');
    beep(320, 0.28, state.opts.sound);
    speak('Red light!', state.opts.sound);
    scheduleNext('red');
  }

  function scheduleNext(current) {
    var p = SPEEDS[state.opts.speed] || SPEEDS.normal;
    var dur = current === 'green' ? rand(p[0], p[1]) : rand(p[2], p[3]);
    // don't overrun the clock
    var remaining = (state.endAt - Date.now()) / 1000;
    if (remaining <= 0.3) return; // tick loop will call finish()
    var next = current === 'green' ? showRed : showGreen;
    state.timers.push(setTimeout(next, dur * 1000));
  }

  function finish() {
    if (!state.active) return;
    clearTimers();
    state.overlay.className = 'jrl-overlay jrl-idle';
    state.bigEl.textContent = "Time's up!";
    state.bigEl.className = 'jrl-end';
    state.subEl.textContent = 'Great freezing 🎉';
    setLight('off');
    state.timerEl.textContent = '0:00';
    try { window.speechSynthesis.cancel(); } catch (e) {}
    speak("Time's up!", state.opts.sound);
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
    var vol = document.createElement('span'); vol.textContent = '🔊';
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
    build();

    // warm up speech engine on the user gesture (esp. iOS)
    try { window.speechSynthesis.cancel(); window.speechSynthesis.getVoices(); } catch (e) {}

    // 3-2-1 ready countdown, then go
    var n = 3;
    state.bigEl.textContent = '3'; state.subEl.textContent = 'Get ready…';
    beep(500, 0.12, state.opts.sound);
    var ready = setInterval(function () {
      n--;
      if (n > 0) { state.bigEl.textContent = String(n); beep(500, 0.12, state.opts.sound); }
      else {
        clearInterval(ready);
        state.endAt = Date.now() + state.opts.duration * 1000;
        // live countdown + end check
        state.tickId = setInterval(function () {
          var rem = (state.endAt - Date.now()) / 1000;
          state.timerEl.textContent = fmt(rem);
          if (rem <= 0) finish();
        }, 200);
        showGreen(); // always begin on green
      }
    }, 1000);

    state.timers.push(ready);
  }

  function stop() { teardown(true); }

  global.JumviRedLight = { start: start, stop: stop };
})(window);
