# iOS mission-sheet probe

Run this **on the real iPhone**, with the mission screen that shows the gap
already open. It prints which box owns the empty band. Nothing here ships —
this file is a snippet to paste, not code the app loads.

## Why this exists

Three hypotheses for the gap have been tested and refuted:

1. `-webkit-overflow-scrolling: touch` on `#app-wrapper` giving fixed
   descendants the wrong containing block (shipped as `9182c29`) — hardware
   showed the sheet reaching the bottom, so this was not the cause.
2. Free space pooling after `.sheetActions` because `#sheetBody` has
   `flex-grow: 0` — refuted locally: with short content the sheet *shrinks*
   and stays bottom-aligned, so no bottom gap forms.
3. A stale `#sheetBody` height from the pre-settle standalone viewport —
   refuted locally by the same mechanism.

The reason all three fail is geometric: `#backdrop` is `align-items: flex-end`
and `#sheet` is content-sized with only a `max-height`. A band *below* the
actions requires the sheet to be taller than its content, and nothing in the
stylesheet forces that. Chromium and WebKit-via-Playwright both refuse to
reproduce it. So the next step is measurement on the device that does.

## Option A — macOS Safari Web Inspector (no deploy)

1. iPhone: **Settings → Safari → Advanced → Web Inspector** on.
2. Connect the iPhone to a Mac by cable.
3. Launch the JUMVI PWA from the Home Screen and open the mission that shows
   the gap (`Count to 10`), reaching the state in the screenshot.
4. Mac: **Safari → Develop → [your iPhone] → JUMVI**.
5. Paste the snippet below into the Console and press Enter.
6. Screenshot or copy the output.

## Option B — if no Mac is available

Deploy the branch, then add `?pwaprobe=1` to the PWA's start URL. That requires
a deploy, which is why Option A is preferred.

## The snippet

```js
(() => {
  const R = el => el ? el.getBoundingClientRect() : null;
  const S = el => el ? getComputedStyle(el) : null;
  const n = v => Math.round(v);
  const sheet = document.getElementById('sheet');
  const backdrop = document.getElementById('backdrop');
  const bodyEl = document.getElementById('sheetBody');
  const actions = sheet && sheet.querySelector('.sheetActions');
  if (!sheet || !actions) return 'Open a mission first.';

  const sr = R(sheet), ar = R(actions), br = R(bodyEl);
  const out = {
    mode: matchMedia('(display-mode: standalone)').matches ? 'STANDALONE' : 'browser',
    innerHeight: innerHeight,
    visualViewport: visualViewport ? n(visualViewport.height) : null,
    docClientH: document.documentElement.clientHeight,
    safeTop: getComputedStyle(document.documentElement).getPropertyValue('--probe-t') || 'n/a',

    backdrop: { top: n(R(backdrop).top), bottom: n(R(backdrop).bottom), h: n(R(backdrop).height),
                align: S(backdrop).alignItems, pos: S(backdrop).position },
    sheet:    { top: n(sr.top), bottom: n(sr.bottom), h: n(sr.height),
                cssH: S(sheet).height, maxH: S(sheet).maxHeight, minH: S(sheet).minHeight,
                alignSelf: S(sheet).alignSelf, justify: S(sheet).justifyContent,
                padT: S(sheet).paddingTop, padB: S(sheet).paddingBottom },
    body:     { top: n(br.top), bottom: n(br.bottom), h: n(br.height),
                scrollH: n(bodyEl.scrollHeight), clientH: n(bodyEl.clientHeight),
                grow: S(bodyEl).flexGrow, shrink: S(bodyEl).flexShrink },
    actions:  { top: n(ar.top), bottom: n(ar.bottom), h: n(ar.height),
                padB: S(actions).paddingBottom, marB: S(actions).marginBottom },

    // THE NUMBERS THAT MATTER
    GAP_actions_to_sheetBottom: n(sr.bottom - ar.bottom),
    GAP_actions_to_screenBottom: n(innerHeight - ar.bottom),
    GAP_sheet_to_screenBottom: n(innerHeight - sr.bottom),
    safeAreaBottomPx: (() => {
      const d = document.createElement('div');
      d.style.cssText = 'position:fixed;bottom:0;height:env(safe-area-inset-bottom);width:1px;';
      document.body.appendChild(d);
      const h = d.getBoundingClientRect().height; d.remove(); return n(h);
    })(),
  };

  // Every direct child of #sheet, in order — the owner of the band is in here.
  out.sheetChildren = [...sheet.children].map((el, i) => {
    const r = R(el), s = S(el);
    return `[${i}] ${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}` +
           `${typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : ''}` +
           ` top=${n(r.top)} bot=${n(r.bottom)} h=${n(r.height)}` +
           ` disp=${s.display} grow=${s.flexGrow} vis=${s.visibility} op=${s.opacity}`;
  });

  console.log(JSON.stringify(out, null, 1));
  return out;
})()
```

## What the answer looks like

The band's owner is whichever line explains `GAP_actions_to_screenBottom`:

- **`GAP_sheet_to_screenBottom` is large** → the sheet does not reach the
  bottom; the band is backdrop, and the containing-block family of causes is
  back on the table after all.
- **`GAP_actions_to_sheetBottom` is large** → the sheet *does* reach the bottom
  and the free space is inside it, after the actions. Then compare
  `sheet.h` against the sum of the `sheetChildren` heights: if the sheet is
  taller than its children, find which computed value forced that (`cssH`,
  `minH`, or a child with unexpected `grow`).
- **A child in `sheetChildren` has non-zero height but nothing visible** →
  that element is the band, and `disp`/`vis`/`op` will say why it still
  occupies space.
- **`safeAreaBottomPx` much larger than ~34** → safe-area padding is
  accumulating across nested elements.

Send the output and the fix follows directly from it.
