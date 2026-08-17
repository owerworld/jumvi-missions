# iOS Safari toolbar-collapse: probe + live experiments

Run on the **real iPhone in normal Safari** (not the installed PWA), attached
to macOS Safari Web Inspector. Nothing here ships — it is snippets to paste.

Open `https://qr.jumvi.co`, go to the **Missions** tab (long enough to swipe),
and keep the mission sheet **closed** for the first tests.

---

## Why the previous conclusion is not yet proof

The last pass reported "toolbar collapse is structurally impossible because the
document never scrolls". That described the cascade correctly, but it asserted
a WebKit *behaviour* that was never tested on hardware. What is actually known
from the stylesheet is only this — the winning declarations, after three layers
of overrides:

| Element | Winning rule | Source |
|---|---|---|
| `html, body` | `overflow: hidden !important; position: fixed !important; height: 100% !important` | `style.css:2708–2712` |
| `#app-wrapper` | `position: fixed !important; overflow-y: auto !important` | `style.css:2715–2721` |

Two earlier layers say the same thing more weakly (`:8/:13/:16`, `:2649/:2650`,
`:2656–2662`). And there is a **dormant block at `style.css:2585–2601`** —
literally commented `/* iOS Safari scroll strategy (body scroll) */` — that
tries `body { overflow-y: scroll; position: static }` with
`#app-wrapper { position: relative; overflow: visible }`. Someone already
attempted document scrolling; the two later `!important` layers bury it.

That dormant block is the shape Experiment D restores.

**Because the rules are `!important` across three layers, unchecking one box in
Web Inspector will not do anything** — an earlier layer still wins. Each
experiment below therefore injects a single higher-priority stylesheet, and
removes it again in one call.

---

## Phase 1 — baseline probe

Paste into the Console. Do not change anything yet.

```js
window.__jumviProbe = (label) => {
  const de = document.documentElement, bd = document.body;
  const aw = document.getElementById('app-wrapper');
  const nav = document.querySelector('.bottomNav');
  const box = el => { const s = getComputedStyle(el); return {
    position: s.position, overflow: s.overflow, overflowX: s.overflowX, overflowY: s.overflowY,
    height: s.height, minHeight: s.minHeight, maxHeight: s.maxHeight,
    touchAction: s.touchAction, overscroll: s.overscrollBehavior,
    webkitOFS: s.webkitOverflowScrolling || '(unset)',
    scrollHeight: el.scrollHeight, clientHeight: el.clientHeight, scrollTop: Math.round(el.scrollTop),
    canScroll: el.scrollHeight > el.clientHeight + 1 };
  };
  const r = nav ? nav.getBoundingClientRect() : null;
  const out = {
    label,
    ua: navigator.userAgent, platform: navigator.platform,
    navigatorStandalone: navigator.standalone,
    displayModeStandalone: matchMedia('(display-mode: standalone)').matches,
    innerHeight: innerHeight, outerHeight: outerHeight,
    vvHeight: visualViewport ? Math.round(visualViewport.height) : null,
    vvOffsetTop: visualViewport ? Math.round(visualViewport.offsetTop) : null,
    vvPageTop: visualViewport ? Math.round(visualViewport.pageTop) : null,
    windowScrollY: Math.round(scrollY),
    scrollingElement: document.scrollingElement ? document.scrollingElement.tagName : null,
    scrollingElementScrollTop: document.scrollingElement ? Math.round(document.scrollingElement.scrollTop) : null,
    scrollingElementScrollHeight: document.scrollingElement ? document.scrollingElement.scrollHeight : null,
    scrollingElementClientHeight: document.scrollingElement ? document.scrollingElement.clientHeight : null,
    html: box(de), body: box(bd), appWrapper: aw ? box(aw) : null,
    bottomNav: r ? { position: getComputedStyle(nav).position, bottom: getComputedStyle(nav).bottom,
                     height: Math.round(r.height), paddingBottom: getComputedStyle(nav).paddingBottom,
                     top: Math.round(r.top), rectBottom: Math.round(r.bottom) } : null,
  };
  console.log(JSON.stringify(out, null, 1));
  return out;
};
__jumviProbe('BASELINE at rest');
```

## Phase 2 — who actually scrolls

1. Run `__jumviProbe('at rest')`.
2. **On the phone**, swipe the Missions list down a long way.
3. Run `__jumviProbe('after swipe')`.

Then:

```js
(() => {
  const a = __jumviProbe('rest'), b = __jumviProbe('after');
  console.table({
    windowScrollY:        { rest: a.windowScrollY, after: b.windowScrollY },
    scrollingElementTop:  { rest: a.scrollingElementScrollTop, after: b.scrollingElementScrollTop },
    appWrapperScrollTop:  { rest: a.appWrapper.scrollTop, after: b.appWrapper.scrollTop },
    innerHeight:          { rest: a.innerHeight, after: b.innerHeight },
    visualViewportHeight: { rest: a.vvHeight, after: b.vvHeight },
    vvOffsetTop:          { rest: a.vvOffsetTop, after: b.vvOffsetTop },
    bottomNavTop:         { rest: a.bottomNav.top, after: b.bottomNav.top },
  });
})();
```

Whichever `scrollTop` moves is the real scroll owner. If `innerHeight` /
`visualViewport.height` grow during the swipe, Safari's chrome collapsed.

---

## Phase 3 — live experiments

Helper — paste once:

```js
window.__jumviExp = (css, name) => {
  document.getElementById('jumvi-exp')?.remove();
  if (!css) { console.log('experiment cleared — reload for a clean slate'); return; }
  const s = document.createElement('style');
  s.id = 'jumvi-exp'; s.textContent = css;
  document.head.appendChild(s);
  console.log('applied:', name);
};
window.__jumviOff = () => __jumviExp(null);
```

After **each** experiment: swipe down on the phone, then report one of
`COLLAPSES` / `DOES NOT COLLAPSE` / `LAYOUT BROKE` / `VIEWPORT JUMPS`, plus the
Phase-2 table. Then run `__jumviOff()` and **reload** before the next one.

### Experiment A — root position lock only

Isolates `position: fixed` on the root. Overflow stays locked.

```js
__jumviExp(`
  html, body { position: static !important; }
`, 'A: root position lock released');
```

### Experiment B — root overflow lock only

Isolates `overflow: hidden` on the root. Position stays fixed.

```js
__jumviExp(`
  html { overflow: visible !important; }
  body { overflow-y: auto !important; }
`, 'B: root overflow lock released');
```

### Experiment C — app-wrapper stops owning scroll

Isolates the scroll container. Root locks stay as shipped, so the page may
become unscrollable — that is expected, and is itself the evidence.

```js
__jumviExp(`
  #app-wrapper { overflow-y: visible !important; position: static !important; }
`, 'C: app-wrapper scroll ownership removed');
```

### Experiment D — full document-scroll prototype

Only run this if A–C show root scrolling is required. This restores the dormant
`style.css:2585–2601` strategy, with the bottom nav kept viewport-fixed.

```js
__jumviExp(`
  html { height: auto !important; overflow: visible !important; position: static !important; }
  body { height: auto !important; min-height: 100% !important;
         overflow: visible !important; position: static !important; }
  #app-wrapper { position: relative !important; top: auto !important; left: auto !important;
                 right: auto !important; bottom: auto !important;
                 height: auto !important; min-height: 100dvh !important;
                 overflow: visible !important; }
  .bottomNav { position: fixed !important; bottom: 0 !important; }
`, 'D: document owns vertical scroll');
```

Checks while D is applied:

1. Swipe down — does Safari's bottom toolbar minimise?
2. Is the JUMVI bottom nav still pinned, tappable, above the home indicator?
3. Any jump or flicker as the chrome changes size?
4. Then open a mission — does the background stay put, and does the sheet
   scroll internally? (Background scroll under the modal is the known cost of
   document scrolling; it is fixable in the permanent version and does **not**
   invalidate the experiment.)

---

## What each outcome means

- **A alone collapses** → `position: fixed` on the root is the blocker; the fix
  is small and no scroll-lock work is needed.
- **B alone collapses** → `overflow: hidden` is the blocker; same, small fix.
- **Neither A nor B, but D does** → Safari needs the document to be the real
  scroll port. The permanent fix is the dormant block plus modal scroll-lock.
- **Nothing collapses, including D** → the blocker is not the scroll
  architecture at all, and the next suspects are `touch-action` (`pan-y` on
  `#app-wrapper` at `style.css:54`, `manipulation` on `html, body` at `:3394`)
  and `overscroll-behavior` (`none` on `body` at `:204`). Say so and I will
  send an Experiment E for those rather than guess.

No `window.scrollTo` tricks, no synthetic gestures, no spacer elements, no
UA sniffing anywhere in this file — Safari should hide its own chrome because
the page scrolls normally, or the diagnosis is not finished.
