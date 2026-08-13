/* Builds tr/certificate-template.webp from the English certificate.
 *
 * This is a localization, not a redesign: the English file is the only source.
 * Background, border, stars, glitter, the gold banner artwork, the yellow pill,
 * the light-blue achievement card, the logo and the watermark are all carried
 * over untouched. Only the pixels occupied by English words are rebuilt.
 *
 * Erasing is done by vertically interpolating between the clean row just above
 * a text block and the clean row just below it, per column. The backdrop is a
 * smooth vertical gradient everywhere text sits, so the seams land exactly on
 * the original pixels and the gradient continues through the patch. A flat fill
 * would band; a blur would smear the stars next to it.
 */
let chromium;
try { ({ chromium } = await import("playwright")); } catch (_) {
  console.error("playwright bulunamadı: npm install playwright");
  process.exit(2);
}
import fs from "node:fs";

const REPO = process.env.REPO || process.cwd();
const OUT = process.argv[2] || `${process.env.REPO || process.cwd()}/tr/certificate-template.webp`;
const b64 = (p) => fs.readFileSync(p).toString("base64");
// Poppins is the certificate's typeface but is not vendored: it is fetched at
// build time purely to rasterise this image, never served from the site.
// fetch-fonts.sh drops the five weights here.
const FONTDIR = process.env.FONTDIR || "/tmp/cert";

const fonts = {
  p400: b64(`${FONTDIR}/poppins-400.ttf`),
  p500: b64(`${FONTDIR}/poppins-500.ttf`),
  p600: b64(`${FONTDIR}/poppins-600.ttf`),
  p700: b64(`${FONTDIR}/poppins-700.ttf`),
  p800: b64(`${FONTDIR}/poppins-800.ttf`),
  fredoka: b64(`${REPO}/assets/fonts/fredoka-var-latin-1.woff2`),
  fredokaExt: b64(`${REPO}/assets/fonts/fredoka-var-latin-ext-1.woff2`),
};
const src = b64(`${REPO}/certificate-template.webp`);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage({ viewport: { width: 1400, height: 820 } });

const css = `
@font-face{font-family:P;font-weight:400;src:url(data:font/ttf;base64,${fonts.p400});}
@font-face{font-family:P;font-weight:500;src:url(data:font/ttf;base64,${fonts.p500});}
@font-face{font-family:P;font-weight:600;src:url(data:font/ttf;base64,${fonts.p600});}
@font-face{font-family:P;font-weight:700;src:url(data:font/ttf;base64,${fonts.p700});}
@font-face{font-family:P;font-weight:800;src:url(data:font/ttf;base64,${fonts.p800});}
@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${fonts.fredoka}) format('woff2');unicode-range:U+0000-00FF,U+2000-206F,U+2192,U+2212,U+2215;}
@font-face{font-family:F;font-weight:300 700;src:url(data:font/woff2;base64,${fonts.fredokaExt}) format('woff2');unicode-range:U+0100-024F,U+0259,U+1E00-1EFF,U+2020,U+20A0-20AB;}
`;
await page.setContent(`<style>${css}</style><img id="src" src="data:image/webp;base64,${src}">`);
await page.waitForFunction(() => document.getElementById("src").complete);
// Canvas font assignment does NOT trigger font loading — a family that is
// only ever named in ctx.font silently falls back to a serif. Load each face
// explicitly and confirm it before drawing anything.
const loaded = await page.evaluate(async () => {
  const faces = [
    "400 20px P", "500 20px P", "600 20px P", "700 20px P", "800 20px P",
    "600 58px F", "500 58px F", "700 58px F",
  ];
  await Promise.all(faces.map((f) => document.fonts.load(f, "AĞŞİÇÖÜ0123")));
  await document.fonts.ready;
  return faces.map((f) => `${f}:${document.fonts.check(f, "AĞŞİÇÖÜ") ? "ok" : "EKSİK"}`);
});
console.log("font yüklemesi:", loaded.join("  "));
await page.waitForTimeout(200);

const CFG = JSON.parse(fs.readFileSync(new URL("./layout.json", import.meta.url), "utf8"));

const dataUrl = await page.evaluate(async (CFG) => {
  const img = document.getElementById("src");
  const W = 1376, H = 768;
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);

  /* ── erase: per-column vertical lerp between the clean rows bracketing the
   *    block, so the backdrop gradient continues through it seamlessly ── */
  const erase = ({ x, y, w, h, pad = 2 }) => {
    const topY = y - pad, botY = y + h + pad;
    const top = g.getImageData(x, topY, w, 1).data;
    const bot = g.getImageData(x, botY, w, 1).data;
    const out = g.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const t = (j + pad) / (h + 2 * pad);
      for (let i = 0; i < w; i++) {
        const o = (j * w + i) * 4, s = i * 4;
        out.data[o]     = top[s]     + (bot[s]     - top[s])     * t;
        out.data[o + 1] = top[s + 1] + (bot[s + 1] - top[s + 1]) * t;
        out.data[o + 2] = top[s + 2] + (bot[s + 2] - top[s + 2]) * t;
        out.data[o + 3] = 255;
      }
    }
    g.putImageData(out, x, y);
  };

  const setFont = (weight, size, family = "P") => { g.font = `${weight} ${size}px ${family}`; };

  /* Draw a run of styled segments as one line, honouring alignment. */
  const drawRun = (segs, { x, y, align = "left", family = "P" }) => {
    let total = 0;
    for (const s of segs) { setFont(s.w, s.size, s.family || family); total += g.measureText(s.t).width; }
    let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
    for (const s of segs) {
      setFont(s.w, s.size, s.family || family);
      g.fillStyle = s.c;
      g.textBaseline = "alphabetic";
      g.textAlign = "left";
      g.fillText(s.t, cx, y);
      cx += g.measureText(s.t).width;
    }
    return total;
  };

  const measured = {};

  for (const b of CFG.blocks) erase(b.erase);

  for (const b of CFG.blocks) {
    for (const line of b.lines || []) {
      const segs = line.segs.map((s) => ({ ...s, size: s.size ?? line.size, w: s.w ?? line.weight, c: s.c ?? line.color }));
      measured[line.id || b.id] = drawRun(segs, { x: line.x, y: line.y, align: line.align, family: line.family });
    }
  }

  /* ── gold banner ──────────────────────────────────────────────────────────
   * The plate is hand-drawn: irregular outline, glossy bevel, glitter. Any
   * rectangle painted over it reads as a sticker, so nothing rectangular is
   * drawn here. Instead the cream LETTER pixels are detected inside the
   * plate and only those are replaced, each one interpolated between the
   * plate's own gold at the top and bottom of its column. The outline, the
   * star, the bevel and the glitter are never touched. */
  const B = CFG.banner;
  if (B) {
    const R = B.region;
    const img = g.getImageData(R.x, R.y, R.w, R.h);
    const P = img.data;
    const idx = (x, y) => ((y - R.y) * R.w + (x - R.x)) * 4;
    const isGold = (r, gg, bb) => r > 195 && gg > 100 && gg < 220 && bb < 140 && r - bb > 85;

    // Per-column extent of the plate's gold, so the fill follows the shape.
    const span = {};
    for (let x = R.x; x < R.x + R.w; x++) {
      let top = null, bot = null;
      for (let y = R.y; y < R.y + R.h; y++) {
        const o = idx(x, y);
        if (isGold(P[o], P[o + 1], P[o + 2])) { if (top === null) top = y; bot = y; }
      }
      if (top !== null && bot - top > 12) span[x] = { top, bot };
    }

    /* Replace by DEVIATION from the column's expected gold, not by matching a
     * cream colour. The old lettering is cream in the middle but shades into
     * anti-aliased edges and casts a dark contact shadow; a colour test keeps
     * both and leaves ghosts. Deviation catches the glyph, its edge and its
     * shadow in one pass, and a soft band near the threshold keeps the mask
     * from showing its own outline. */
    // Confine the rebuild to the strip the old lettering actually occupied.
    // Running it across the whole plate also strips the glitter and the bevel,
    // which is what makes the plate look like the artwork rather than a swatch.
    const INSET = 5, HARD = 110, SOFT = 52;
    for (let x = Math.max(R.x, B.lx0); x <= Math.min(R.x + R.w - 1, B.lx1); x++) {
      const s = span[x];
      if (!s || s.bot - s.top < 2 * INSET + 4) continue;
      const tO = idx(x, s.top + INSET), bO = idx(x, s.bot - INSET);
      for (let y = s.top + INSET; y <= s.bot - INSET; y++) {
        const o = idx(x, y);
        const t = (y - (s.top + INSET)) / ((s.bot - INSET) - (s.top + INSET));
        const e = [0, 1, 2].map((k) => P[tO + k] + (P[bO + k] - P[tO + k]) * t);
        const dev = Math.abs(P[o] - e[0]) + Math.abs(P[o + 1] - e[1]) + Math.abs(P[o + 2] - e[2]);
        if (dev <= SOFT) continue;
        const a = dev >= HARD ? 1 : (dev - SOFT) / (HARD - SOFT);
        for (let k = 0; k < 3; k++) P[o + k] = P[o + k] + (e[k] - P[o + k]) * a;
      }
    }
    g.putImageData(img, R.x, R.y);

    // Letters: extruded, because the original has real depth under each glyph
    // and a single cream fill looks pasted on.
    g.save();
    g.translate(B.cx, B.cy);
    g.rotate(B.tilt * Math.PI / 180);
    g.font = `${B.weight} ${B.size}px F`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    measured.banner = g.measureText(B.text).width;

    for (let d = B.depth; d >= 1; d--) {
      g.fillStyle = B.depthColor;
      g.globalAlpha = 0.9;
      g.fillText(B.text, 0, B.textY + d);
    }
    g.globalAlpha = 1;

    g.shadowColor = B.shadow;
    g.shadowBlur = B.shadowBlur;
    g.shadowOffsetY = B.shadowY;
    g.fillStyle = B.fill;
    g.fillText(B.text, 0, B.textY);
    g.shadowColor = "transparent";
    g.restore();
  }

  return { url: c.toDataURL("image/webp", CFG.quality ?? 0.95), measured };
}, CFG);

fs.writeFileSync(OUT, Buffer.from(dataUrl.url.split(",")[1], "base64"));
console.log("ölçülen genişlikler:", JSON.stringify(dataUrl.measured));
console.log("yazıldı:", OUT, fs.statSync(OUT).size, "bayt");
await browser.close();
