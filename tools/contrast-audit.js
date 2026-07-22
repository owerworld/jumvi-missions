/* ============================================================================
 * JUMVI — per-element WCAG contrast auditor
 * ----------------------------------------------------------------------------
 * Walks every visible text leaf in a root, computes the foreground/background
 * contrast ratio, and reports every pair below WCAG AA. Built during Phase 2
 * because DevTools' "highlight non-AA text" cannot see gradient/alpha stacks.
 *
 * The important part is BACKGROUND DETECTION. A naive reader takes the nearest
 * ancestor's background-color and calls it done. That is wrong twice over:
 *   1. rgba()/hsla() backgrounds are semi-transparent — they must be alpha-
 *      composited over whatever is behind them, down to the page base colour.
 *   2. gradient backgrounds have several stops; the worst-contrast stop is the
 *      one that decides AA. Each stop must ALSO be composited if it has alpha.
 * The first cut of this tool dropped alpha and mis-read dark surfaces (it
 * claimed dark nav was 3.57:1 when the token was 7.07:1). This version
 * composites the full ancestor stack over the html background and expands
 * every gradient into its stops, taking the lowest ratio (worst case).
 *
 * USAGE (paste into the DevTools console, or inject via automation):
 *   __contrastAudit();                 // audits document.body
 *   __contrastAudit('#welcomeOverlay'); // audits a subtree (e.g. an overlay)
 * Returns { theme, checked, failCount, fails:[{txt,cls,fg,bg,ratio,px}] }.
 *
 * Thresholds: 4.5:1 normal text; 3:1 large text (>=24px, or >=18.66px bold).
 * Pure-emoji text nodes are skipped (emoji are not colour-bearing glyphs).
 * ==========================================================================*/
(function (root) {
  function toRGBA(s) {
    if (!s || s === 'transparent' || s === 'none') return null;
    var m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null;
    var p = m[1].split(',').map(function (x) { return parseFloat(x); });
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  }
  // src OVER dst, dst assumed opaque -> opaque result
  function over(fg, bg) {
    var a = fg.a;
    return { r: fg.r * a + bg.r * (1 - a), g: fg.g * a + bg.g * (1 - a), b: fg.b * a + bg.b * (1 - a), a: 1 };
  }
  function stopsOf(img) { var out = [], re = /rgba?\([^)]+\)/g, m; while ((m = re.exec(img))) out.push(toRGBA(m[0])); return out; }
  function lum(c) {
    var a = [c.r, c.g, c.b].map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
  }
  function ratio(f, b) { var L1 = lum(f), L2 = lum(b), hi = Math.max(L1, L2), lo = Math.min(L1, L2); return (hi + 0.05) / (lo + 0.05); }

  function audit(rootSel) {
    var htmlBg = toRGBA(getComputedStyle(document.documentElement).backgroundColor) || { r: 255, g: 255, b: 255, a: 1 };
    if (htmlBg.a < 1) htmlBg = over(htmlBg, { r: 255, g: 255, b: 255, a: 1 });

    // Effective background candidates for an element: composite every ancestor
    // background layer over the page base, expanding gradients into their stops.
    function bgCandidates(el) {
      var chain = [], n = el;
      while (n && n.nodeType === 1) { chain.push(n); n = n.parentElement; }
      chain.push(document.documentElement); chain.reverse();
      var acc = [{ r: htmlBg.r, g: htmlBg.g, b: htmlBg.b, a: 1 }];
      for (var i = 0; i < chain.length; i++) {
        var cs = getComputedStyle(chain[i]);
        var bc = toRGBA(cs.backgroundColor);
        var img = cs.backgroundImage || '';
        var grad = img.indexOf('gradient') >= 0 ? stopsOf(img) : [];
        if (bc) acc = acc.map(function (base) { return bc.a >= 1 ? { r: bc.r, g: bc.g, b: bc.b, a: 1 } : over(bc, base); });
        if (grad.length) {
          var next = [];
          acc.forEach(function (base) { grad.forEach(function (st) { if (st) next.push(st.a >= 1 ? { r: st.r, g: st.g, b: st.b, a: 1 } : over(st, base)); }); });
          if (next.length) acc = next;
        }
      }
      return acc;
    }

    var rootEl = rootSel ? document.querySelector(rootSel) : document.body;
    var fails = [], checked = 0, seen = new Set();
    var walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT, null);
    var EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}️]/gu;
    while (walker.nextNode()) {
      var node = walker.currentNode, el = node.parentElement; if (!el) continue;
      var raw = node.nodeValue.replace(/\s+/g, ' ').trim(); if (!raw) continue;
      if (!raw.replace(EMOJI, '').trim()) continue; // pure-emoji node
      var cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || parseFloat(cs.opacity) === 0) continue;
      var r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
      var fg = toRGBA(cs.color); if (!fg) continue;
      if (fg.a < 1) fg = over(fg, bgCandidates(el)[0]);
      var cand = bgCandidates(el), worst = 99, wb = null;
      cand.forEach(function (b) { var cr = ratio(fg, b); if (cr < worst) { worst = cr; wb = b; } });
      var fpx = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight) || 400;
      var large = fpx >= 24 || (fpx >= 18.66 && fw >= 700);
      checked++;
      if (worst < (large ? 3 : 4.5)) {
        var key = el.className + '|' + raw.slice(0, 24); if (seen.has(key)) continue; seen.add(key);
        fails.push({
          txt: raw.slice(0, 34), cls: (el.className || el.tagName).toString().slice(0, 40),
          fg: 'rgb(' + [fg.r, fg.g, fg.b].map(Math.round).join(',') + ')',
          bg: wb ? 'rgb(' + [wb.r, wb.g, wb.b].map(Math.round).join(',') + ')' : '?',
          ratio: Math.round(worst * 100) / 100, px: fpx, large: large
        });
      }
    }
    fails.sort(function (a, b) { return a.ratio - b.ratio; });
    return { theme: document.documentElement.className, base: 'rgb(' + [htmlBg.r, htmlBg.g, htmlBg.b].map(Math.round).join(',') + ')', checked: checked, failCount: fails.length, fails: fails };
  }

  root.__contrastAudit = audit;
  if (typeof module !== 'undefined' && module.exports) module.exports = audit;
})(typeof window !== 'undefined' ? window : globalThis);
