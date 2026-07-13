/* Coach Leo onboarding tour — qr.jumvi.co
 * Vanilla JS coachmark/spotlight tour, shown once per device. No dependencies.
 * COPPA: only persistence is the device-level flag `jumvi_tour_done`.
 * Reset for testing:  localStorage.removeItem('jumvi_tour_done')
 */
(function () {
  "use strict";
  var FLAG = "jumvi_tour_done";
  var START_DELAY = 600;

  // --- tiny helpers ---
  function done() { try { return localStorage.getItem(FLAG) === "1"; } catch (e) { return false; } }
  function setDone() { try { localStorage.setItem(FLAG, "1"); } catch (e) {} }
  function track(name, props) {
    try { if (typeof window.plausible === "function") props ? window.plausible(name, { props: props }) : window.plausible(name); } catch (e) {}
  }
  function reduced() { try { return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function visible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    if (el.offsetParent === null && getComputedStyle(el).position !== "fixed") return false;
    var r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < (window.innerHeight || 0);
  }
  function firstVisible(sels) {
    for (var i = 0; i < sels.length; i++) {
      var el = document.querySelector(sels[i]);
      if (visible(el)) return el;
    }
    return null;
  }

  // --- steps (copy: playful, ~age-6, ≤10 words) ---
  // sel = ordered target candidates; first visible one is spotlighted.
  // A non-welcome step with no visible target auto-skips silently (e.g. the
  // 3D teaser when no 3D entry point exists in the DOM).
  var STEPS = [
    { key: "welcome", center: true, text: "Hi! I'm Coach Leo. Ready for a quick tour?", primary: "Let's go" },
    { key: "missions", sel: ["#dailyBox", "#missionPath", '.navTab[data-tab="browse"]'], text: "These are your missions — 36 games in 6 packs!" },
    { key: "badges", sel: ["#badgesRow", ".statsBadgesSection", '.navTab[data-tab="stats"]'], text: "Finish missions to earn cool badges!" },
    { key: "certificate", sel: ["#certBox", ".certBox", '.navTab[data-tab="profile"]', '.navTab[data-tab="stats"]'], text: "Complete a pack, get your certificate here!" },
    { key: "threeD", sel: ["#advModeCard", '.navTab[data-tab="hub3d"]'], text: "There's a 3D world too — see you inside!", primary: "Start playing" }
  ];

  // --- Coach Leo: flat-vector quokka (grouped so the arm can wave) ---
  function leoSVG() {
    return '' +
      '<svg class="leo-svg" viewBox="0 0 100 100" role="img" aria-hidden="true" focusable="false">' +
        '<ellipse cx="31" cy="27" rx="8" ry="10" fill="#CFA06B"/><ellipse cx="69" cy="27" rx="8" ry="10" fill="#CFA06B"/>' +
        '<ellipse cx="31" cy="28" rx="4" ry="5.5" fill="#F5E7CC"/><ellipse cx="69" cy="28" rx="4" ry="5.5" fill="#F5E7CC"/>' +
        '<ellipse cx="50" cy="52" rx="30" ry="33" fill="#CFA06B"/>' +
        '<ellipse cx="50" cy="63" rx="17" ry="19" fill="#F5E7CC"/>' +
        '<circle cx="34" cy="60" r="5" fill="#E8B892"/><circle cx="66" cy="60" r="5" fill="#E8B892"/>' +
        '<circle cx="40" cy="45" r="4.4" fill="#3A2A1A"/><circle cx="60" cy="45" r="4.4" fill="#3A2A1A"/>' +
        '<circle cx="41.6" cy="43.4" r="1.5" fill="#fff"/><circle cx="61.6" cy="43.4" r="1.5" fill="#fff"/>' +
        '<ellipse cx="50" cy="55" rx="3.4" ry="2.4" fill="#6B4A3A"/>' +
        '<path d="M44 60 q6 5 12 0" stroke="#6B4A3A" stroke-width="2" fill="none" stroke-linecap="round"/>' +
        '<path d="M35 71 L65 71 L50 85 Z" fill="#2FB6E8"/><path d="M64 71 l7 -3 -2 7 Z" fill="#1E97C6"/>' +
        '<g class="leo-arm"><ellipse cx="80" cy="52" rx="6" ry="11" fill="#CFA06B" transform="rotate(24 80 60)"/><circle cx="86" cy="43" r="5" fill="#E8B892"/></g>' +
      '</svg>';
  }

  // --- tour engine ---
  var overlay, spot, card, bubble, actionsRow, dotsRow, plan = [], idx = 0, prevFocus = null, running = false;

  function buildPlan() {
    plan = [];
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      if (s.center) { plan.push({ step: s, target: null }); continue; }
      var t = firstVisible(s.sel);
      if (t) plan.push({ step: s, target: t }); // no visible target → skipped silently
    }
  }

  function el(tag, cls) { var e = document.createElement(tag); if (cls) e.className = cls; return e; }

  function start(replay) {
    if (running) return;
    if (!replay && done()) return;
    buildPlan();
    if (plan.length === 0) return;
    running = true;
    prevFocus = document.activeElement;

    overlay = el("div", "leo-overlay");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Coach Leo tour");
    if (reduced()) document.documentElement.classList.add("leo-static");

    spot = el("div", "leo-spot"); overlay.appendChild(spot);

    card = el("div", "leo-card");
    card.innerHTML = leoSVG();
    bubble = el("div", "leo-bubble");
    bubble.setAttribute("aria-live", "polite");
    card.appendChild(bubble);
    dotsRow = el("div", "leo-dots"); card.appendChild(dotsRow);
    actionsRow = el("div", "leo-actions"); card.appendChild(actionsRow);
    overlay.appendChild(card);

    // Overlay (backdrop) tap = skip. The card stops propagation.
    overlay.addEventListener("click", function (e) { if (e.target === overlay || e.target === spot) skip(); });
    card.addEventListener("click", function (e) { e.stopPropagation(); });
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);

    document.body.appendChild(overlay);
    idx = 0;
    track("tour_started");
    render(); // synchronous — never depend on rAF for content (throttled on hidden tabs)
    var kick = function () { if (overlay) overlay.classList.add("leo-in"); };
    if (window.requestAnimationFrame) requestAnimationFrame(kick);
    setTimeout(kick, 60); // fallback fade-in if rAF is throttled
  }

  function render() {
    var cur = plan[idx], s = cur.step;
    bubble.textContent = s.text;
    track("tour_step", { step: idx + 1 });

    // dots
    dotsRow.innerHTML = "";
    for (var i = 0; i < plan.length; i++) { var d = el("span", "leo-dot" + (i === idx ? " on" : "")); dotsRow.appendChild(d); }

    // actions
    actionsRow.innerHTML = "";
    var last = idx === plan.length - 1;
    var primary = el("button", "leo-btn leo-btn-primary");
    primary.type = "button";
    primary.textContent = s.primary || (last ? "Start playing" : "Next");
    primary.addEventListener("click", next);
    var skipBtn = el("button", "leo-btn leo-btn-skip");
    skipBtn.type = "button";
    skipBtn.textContent = "Skip tour";
    skipBtn.addEventListener("click", skip);
    actionsRow.appendChild(primary);
    actionsRow.appendChild(skipBtn);

    overlay.classList.toggle("leo-nospot", !!s.center);
    reposition();
    primary.focus();
  }

  function reposition() {
    if (!running) return;
    var cur = plan[idx], s = cur.step, vw = window.innerWidth, vh = window.innerHeight;
    if (s.center || !cur.target) {
      card.style.left = Math.max(8, (vw - card.offsetWidth) / 2) + "px";
      card.style.top = Math.max(8, (vh - card.offsetHeight) / 2) + "px";
      return;
    }
    var r = cur.target.getBoundingClientRect(), pad = 8;
    spot.style.left = (r.left - pad) + "px";
    spot.style.top = (r.top - pad) + "px";
    spot.style.width = (r.width + pad * 2) + "px";
    spot.style.height = (r.height + pad * 2) + "px";
    var ch = card.offsetHeight, cw = card.offsetWidth;
    var below = r.bottom + 14, above = r.top - ch - 14;
    var top = (below + ch < vh) ? below : (above > 8 ? above : Math.max(8, (vh - ch) / 2));
    var left = Math.min(Math.max(8, r.left + r.width / 2 - cw / 2), vw - cw - 8);
    card.style.top = top + "px";
    card.style.left = left + "px";
  }

  function advance(byUser) {
    if (idx >= plan.length - 1) { finish(); }
    else { idx++; render(); }
  }
  function next() { advance(true); }

  function finish() {
    if (!overlay) return; // guard against double-fire during the close fade
    setDone();
    track("tour_completed");
    close();
  }
  function skip() {
    if (!overlay) return;
    setDone();
    track("tour_skipped", { step: idx + 1 });
    close();
  }
  function onKey(e) {
    if (e.key === "Escape") { e.preventDefault(); skip(); }
    else if (e.key === "Enter" && document.activeElement && document.activeElement.classList.contains("leo-btn")) { /* native */ }
  }

  function close() {
    if (!overlay) return;
    document.removeEventListener("keydown", onKey, true);
    window.removeEventListener("resize", reposition);
    window.removeEventListener("scroll", reposition, true);
    overlay.classList.remove("leo-in");
    var o = overlay; overlay = null; running = false;
    setTimeout(function () { if (o && o.parentNode) o.parentNode.removeChild(o); }, 260);
    document.documentElement.classList.remove("leo-static");
    try { if (prevFocus && prevFocus.focus) prevFocus.focus(); } catch (e) {}
  }

  // --- trigger: after DOM + welcome overlay gone + delay, if not done ---
  function waitForHome(cb) {
    var w = document.getElementById("welcomeOverlay");
    if (!w || !visible(w)) { cb(); return; }
    var obs = new MutationObserver(function () {
      var wo = document.getElementById("welcomeOverlay");
      if (!wo || !visible(wo)) { obs.disconnect(); cb(); }
    });
    obs.observe(document.body, { attributes: true, childList: true, subtree: true });
    setTimeout(function () { try { obs.disconnect(); } catch (e) {} cb(); }, 20000); // safety
  }

  function schedule() {
    if (done()) return;
    waitForHome(function () { setTimeout(function () { start(false); }, START_DELAY); });
  }

  // --- "Replay tour" in Settings (only if that UI exists; no new settings UI) ---
  function injectReplay() {
    var host = document.querySelector(".profileSettingsSection");
    if (!host || host.querySelector(".leo-replay-btn")) return;
    var b = el("button", "leo-replay-btn");
    b.type = "button";
    b.innerHTML = "🦁 <span>Replay Coach Leo tour</span>";
    b.addEventListener("click", function () { try { localStorage.removeItem(FLAG); } catch (e) {} start(true); });
    host.appendChild(b);
  }

  function init() { schedule(); injectReplay(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  // expose a tiny manual hook (used by the Settings replay button / QA)
  window.leoTour = { start: function () { start(true); }, reset: function () { try { localStorage.removeItem(FLAG); } catch (e) {} } };
})();
