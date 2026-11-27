// Wave 2, batch W2-B10: W2-S2-06, W2-S1-01, W2-S1-04, W2-S1-02 (visual hierarchy).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { root } from './lib.mjs';
import { SQUARE, CENTER, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

// Minimal lossless PNG decoder (8-bit RGB/RGBA, non-interlaced) for sampling real rendered #gl/#boardwrap screenshots.
function decodePng(buf) {
  let pos = 8, width = 0, height = 0, bitDepth = 0, colorType = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    pos += 12 + len;
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
    } else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
  }
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) throw new Error(`Unsupported PNG format: ${bitDepth}/${colorType}`);
  const bpp = colorType === 6 ? 4 : 3;
  const stride = width * bpp;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const out = Buffer.alloc(height * stride);
  const paeth = (a, b, c) => {
    const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
    return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
  };
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const srcOff = y * (stride + 1) + 1;
    const dstOff = y * stride;
    for (let x = 0; x < stride; x++) {
      const val = raw[srcOff + x];
      const a = x >= bpp ? out[dstOff + x - bpp] : 0;
      const b = y > 0 ? out[dstOff - stride + x] : 0;
      const c = x >= bpp && y > 0 ? out[dstOff - stride + x - bpp] : 0;
      let u = val;
      if (f === 1) u = (val + a) & 255;
      else if (f === 2) u = (val + b) & 255;
      else if (f === 3) u = (val + ((a + b) >> 1)) & 255;
      else if (f === 4) u = (val + paeth(a, b, c)) & 255;
      out[dstOff + x] = u;
    }
  }
  return { width, height, bpp, data: out };
}

function samplePngBox(png, x0, y0, x1, y1) {
  const lx = Math.max(0, Math.floor(x0)), rx = Math.min(png.width, Math.ceil(x1));
  const ty = Math.max(0, Math.floor(y0)), by = Math.min(png.height, Math.ceil(y1));
  let r = 0, g = 0, b = 0, n = 0;
  for (let y = ty; y < by; y++) {
    for (let x = lx; x < rx; x++) {
      const o = (y * png.width + x) * png.bpp;
      r += png.data[o]; g += png.data[o + 1]; b += png.data[o + 2]; n++;
    }
  }
  if (!n) return { r: 0, g: 0, b: 0, lum: 0 };
  r /= n; g /= n; b /= n;
  return { r, g, b, lum: 0.2126 * r + 0.7152 * g + 0.0722 * b };
}

export const tests = [
  // ---------- W2-S2-06 ----------
  {
    name: 'W2-S2-06 delayed counter.webp refreshes both 3D tabletop and 2D #boardwrap after gameplay starts, and 3D towels use muted taupe/twilight linen',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      // Delay counter.webp so gameplay enters before loadArt() settles, reproducing the async race deterministically.
      let releaseCounter;
      const counterGate = new Promise((res) => { releaseCounter = res; });
      let intercepted = 0;
      await t.page.route('**/assets/counter.webp', async (route) => {
        intercepted++;
        await counterGate;
        await route.continue();
      });
      await t.page.reload({ waitUntil: 'domcontentloaded' });
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      const before = await t.page.evaluate(async () => ({
        bg: document.querySelector('#boardwrap').style.backgroundImage,
        b3: await window.__game.act('b3'),
      }));
      t.expect(intercepted >= 1, 'counter.webp fetch was intercepted before game start');
      t.equal(before.bg, '', '2D #boardwrap starts without counter.webp while image is still in flight');
      if (before.b3 && before.b3.on) t.equal(before.b3.counterArt, false, '3D table starts on fallback gradient before counter.webp arrives');

      // Release counter.webp and wait for loadArt() callback to settle and refresh both render paths
      releaseCounter();
      await t.page.waitForFunction(() => {
        const bg = document.querySelector('#boardwrap').style.backgroundImage || '';
        return bg.includes('counter');
      }, null, { timeout: 8000 });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      const afterDay = await t.page.evaluate(async () => ({
        bg: document.querySelector('#boardwrap').style.backgroundImage,
        b3: await window.__game.act('b3'),
      }));
      t.expect(afterDay.bg.includes('counter'), `2D #boardwrap refreshed counter.webp after async load (${afterDay.bg})`);
      if (afterDay.b3 && afterDay.b3.on) {
        t.equal(afterDay.b3.counterArt, true, '3D tabletop refreshed counter.webp via B3.setTheme() after loadArt() resolved');
        t.equal(afterDay.b3.towelColor, 'b5a892', `Day 3D towels toned to muted warm taupe linen #b5a892 (got ${afterDay.b3.towelColor})`);
        // Verify rendered towel pixels are muted warm taupe, not blinding #F2EEE4 white (lum < 210)
        const buf = await t.page.locator('#boardwrap').screenshot();
        const png = decodePng(buf);
        const towelPatch = samplePngBox(png, png.width * 0.045, png.height * 0.13, png.width * 0.085, png.height * 0.21);
        t.log(`Day 3D towel rendered sample: rgb(${towelPatch.r.toFixed(0)},${towelPatch.g.toFixed(0)},${towelPatch.b.toFixed(0)}) lum=${towelPatch.lum.toFixed(1)}`);
        t.expect(towelPatch.lum < 205, `Day 3D towel luminance stays muted below snow-white glare (lum=${towelPatch.lum.toFixed(1)} < 205)`);
        await t.shot('w2-b10-day-counter-towels', { timeout: 15000 });

        // Switch to Night and verify darkened twilight linen towel color
        await t.game('scene', 'settings');
        await t.page.click('[data-set="theme"][data-val="dark"]');
        await t.game('scene', 'game');
        await t.waitIdle(6000);
        await t.waitFrames(3);
        const afterNight = await t.game('act', 'b3');
        t.equal(afterNight.towelColor, '524b61', `Night 3D towels toned to shadowed twilight linen #524b61 (got ${afterNight.towelColor})`);
      }
      await t.page.unroute('**/assets/counter.webp');
    },
  },
  {
    name: 'W2-S2-06 delayed counter.webp refreshes 2D #boardwrap background on ?gl=0 fallback',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      let releaseCounter;
      const counterGate = new Promise((res) => { releaseCounter = res; });
      await t.page.route('**/assets/counter.webp', async (route) => {
        await counterGate;
        await route.continue();
      });
      await t.page.reload({ waitUntil: 'domcontentloaded' });
      await ready(t);
      await t.game('newGame', { seed: 41 });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      t.equal(await t.page.evaluate(() => document.querySelector('#boardwrap').style.backgroundImage), '', '2D fallback starts without counter.webp before decode');
      releaseCounter();
      await t.page.waitForFunction(() => (document.querySelector('#boardwrap').style.backgroundImage || '').includes('counter'), null, { timeout: 8000 });
      const bg = await t.page.evaluate(() => document.querySelector('#boardwrap').style.backgroundImage);
      t.expect(bg.includes('counter'), `2D ?gl=0 #boardwrap refreshed counter.webp (${bg})`);
      await t.page.unroute('**/assets/counter.webp');
    },
  },
  // ---------- W2-S1-01 ----------
  {
    name: 'W2-S1-01 neutral empty marble steps 15-20% below bright ivory tiles in Day travertine and Night twilight with single soft marble pass (no double-multiply)',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 10);
      await t.waitIdle(12000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      const sampleBoard = () => t.page.evaluate(async () => {
        const st = window.__game.getState();
        const cv = document.getElementById('board'), ctx = cv.getContext('2d');
        const k = cv.width / cv.clientWidth;
        const [x0] = await window.__game.act('cell', 112);
        const [x1] = await window.__game.act('cell', 113);
        const cell = Math.abs(x1 - x0);
        const neutralCells = [], tileCells = [];
        for (let i = 0; i < 225; i++) {
          const r = Math.floor(i / 15), c = i % 15;
          if (r < 2 || r > 12 || c < 2 || c > 12) continue;
          if (st.game.board[i] && !st.game.board[i].blank && st.game.board[i].l === 'I') tileCells.push(i);
          else if (!st.game.board[i] && window.__G && !['w', 'h', 's', 'b', 'B', '*'].includes(st.game.board[i])) neutralCells.push(i);
        }
        // Pick verified empty neutral squares (no premium/bath/center)
        const { SQUARE: SQ } = await import(new URL('src/js/score.js', location.href).href);
        const empties = [];
        for (let i = 0; i < 225 && empties.length < 12; i++) {
          const r = Math.floor(i / 15), c = i % 15;
          if (r >= 2 && r <= 12 && c >= 2 && c <= 12 && SQ[i] === '.' && !st.game.board[i]) empties.push(i);
        }
        const tiles = [];
        for (let i = 0; i < 225 && tiles.length < 8; i++) {
          if (st.game.board[i] && !st.game.board[i].blank) tiles.push(i);
        }
        let mSum = 0, mSq = 0, mN = 0;
        for (const idx of empties) {
          const [cx, cy] = await window.__game.act('cell', idx);
          const half = Math.max(3, Math.round(cell * 0.28 * k));
          const d = ctx.getImageData(Math.round(cx * k) - half, Math.round(cy * k) - half, half * 2, half * 2).data;
          for (let j = 0; j < d.length; j += 4) {
            const l = 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2];
            mSum += l; mSq += l * l; mN++;
          }
        }
        // Sample upper-right ivory tile body corner (clear of upper-left letter serifs & bottom-right point numeral)
        let tSum = 0, tN = 0;
        for (const idx of tiles) {
          const [cx, cy] = await window.__game.act('cell', idx);
          const px = Math.round((cx + cell * 0.22) * k), py = Math.round((cy - cell * 0.36) * k);
          const w = Math.max(3, Math.round(cell * 0.14 * k));
          const d = ctx.getImageData(px, py, w, w).data;
          for (let j = 0; j < d.length; j += 4) {
            tSum += 0.2126 * d[j] + 0.7152 * d[j + 1] + 0.0722 * d[j + 2]; tN++;
          }
        }
        const mean = mSum / mN;
        return { marbleMean: mean, marbleStd: Math.sqrt(Math.max(0, mSq / mN - mean * mean)), tileLum: tSum / tN, empties: empties.length, tiles: tiles.length };
      });

      const day = await sampleBoard();
      t.log(`W2-S1-01 Day 2D live (marble.webp): tileLum=${day.tileLum.toFixed(1)}, marbleMean=${day.marbleMean.toFixed(1)}, std=${day.marbleStd.toFixed(1)}`);
      t.expect(day.tileLum >= 236, `Day ivory ceramic tiles stay bright (#FFFDF5, lum=${day.tileLum.toFixed(1)} >= 236)`);
      t.expect(day.marbleMean >= 180 && day.marbleMean <= 216, `Day empty marble steps down into calm warm travertine (lum=${day.marbleMean.toFixed(1)}, target 180..216)`);
      t.expect(day.tileLum - day.marbleMean >= 28, `strict Day figure-ground step >= 28 lum pts (${(day.tileLum - day.marbleMean).toFixed(1)})`);
      t.expect(day.marbleStd < 12, `Day marble veining stays calm without harsh double-multiply clutter (std=${day.marbleStd.toFixed(1)} < 12)`);
      await t.shot('w2-b10-day-midgame-2d');

      // Switch to Night and verify calm twilight slate-limestone marble ground
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const night = await sampleBoard();
      t.log(`W2-S1-01 Night 2D live (marble.webp): tileLum=${night.tileLum.toFixed(1)}, marbleMean=${night.marbleMean.toFixed(1)}, std=${night.marbleStd.toFixed(1)}`);
      t.expect(night.marbleMean >= 38 && night.marbleMean <= 74, `Night empty marble uses calm twilight slate-limestone (lum=${night.marbleMean.toFixed(1)}, target 38..74)`);
      t.expect(night.tileLum - night.marbleMean >= 150, `Night ivory tiles pop sharply above twilight slate-limestone (delta=${(night.tileLum - night.marbleMean).toFixed(1)})`);

      // Confirm render2d.js removed the 0.45 double-multiply pass on marble.webp
      const src = fs.readFileSync(path.join(root, 'src/js/render2d.js'), 'utf8');
      t.expect(!/globalCompositeOperation\s*=\s*['"]multiply['"]/.test(src), 'render2d.js removed marble double-multiply pass');
    },
  },
  // ---------- W2-S1-04 ----------
  {
    name: 'W2-S1-04 Night theme calibrates twilight slate-limestone marble, warm brass-lamp 3D lighting, darkened twilight towels, warm-ivory tiles, and #3E3A54 fog boxes',
    viewports: ['desktop', 'mobile'],
    colorScheme: 'dark',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 10);
      await t.waitIdle(12000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      // 1) Layer 3: Night fogged plaque boxes recede to #3E3A54 (rgb(62, 58, 84)), never glaring #FFFFFF
      if (t.viewport === 'mobile') {
        const toggle = t.page.locator('#springs [data-springs-toggle]');
        if (await toggle.isVisible()) await toggle.click();
      }
      const plaqueInfo = await t.page.evaluate(() => {
        const fog = document.querySelector('#springs .pword b.fog');
        const rev = document.querySelector('#springs .pword b:not(.fog)');
        const fcs = fog ? getComputedStyle(fog) : null;
        const rcs = rev ? getComputedStyle(rev) : null;
        return {
          darkBody: document.body.classList.contains('theme-dark'),
          fogBg: fcs ? fcs.backgroundColor : null,
          fogBgImg: fcs ? fcs.backgroundImage : null,
          revBg: rcs ? rcs.backgroundColor : null,
          revColor: rcs ? rcs.color : null,
        };
      });
      t.equal(plaqueInfo.darkBody, true, 'Night theme sets body.theme-dark');
      t.equal(plaqueInfo.fogBg, 'rgb(62, 58, 84)', `Night .pword b.fog uses #3E3A54 (got ${plaqueInfo.fogBg})`);
      t.equal(plaqueInfo.fogBgImg, 'none', `Night .pword b.fog removes Day white radial-gradient (got ${plaqueInfo.fogBgImg})`);
      t.equal(plaqueInfo.revBg, 'rgb(237, 229, 212)', `Night revealed .pword b uses warm ivory #EDE5D4 (got ${plaqueInfo.revBg})`);
      if (t.viewport === 'mobile') {
        const toggle = t.page.locator('#springs [data-springs-toggle]');
        if (await toggle.isVisible()) await toggle.click();
      }

      // 2) Layer 2: 3D Night lighting calibration & darkened twilight linen towels
      const b3 = await t.game('act', 'b3');
      if (b3 && b3.on) {
        t.equal(b3.dark, true, '3D board is in dark theme');
        t.equal(b3.keyColor, 'ffe1b0', `Night 3D key uses warm brass-lamp 0xffe1b0 (got ${b3.keyColor})`);
        t.expect(b3.keyIntensity >= 480 && b3.keyIntensity <= 520, `Night 3D key intensity calibrated to 480..520 (got ${b3.keyIntensity})`);
        t.equal(b3.fillColor, '5c72b8', `Night 3D fill uses cool twilight 0x5c72b8 (got ${b3.fillColor})`);
        t.equal(b3.towelColor, '524b61', `Night 3D towels use darkened twilight linen #524b61 (got ${b3.towelColor})`);
      }

      // 3) Layer 1: Rendered Night frame luminance check — twilight slate-limestone marble stays calm below bright glare,
      //    warm-ivory tiles pop cleanly above it, and desktop towels recede in twilight
      const shotBuf = await t.page.locator('#boardwrap').screenshot();
      const png = decodePng(shotBuf);
      const pts = await t.page.evaluate(async () => {
        const st = window.__game.getState();
        const bw = document.getElementById('boardwrap').getBoundingClientRect();
        const { SQUARE: SQ } = await import(new URL('src/js/score.js', location.href).href);
        const empties = [], tiles = [];
        for (let i = 0; i < 225; i++) {
          const r = Math.floor(i / 15), c = i % 15;
          if (r < 2 || r > 12 || c < 2 || c > 12) continue;
          if (SQ[i] === '.' && !st.game.board[i] && empties.length < 8) empties.push(await window.__game.act('cell', i));
          else if (st.game.board[i] && !st.game.board[i].blank && tiles.length < 6) tiles.push(await window.__game.act('cell', i));
        }
        const [c0] = await window.__game.act('cell', 112);
        const [c1] = await window.__game.act('cell', 113);
        return { w: bw.width, h: bw.height, cell: Math.abs(c1 - c0), empties, tiles };
      });
      const sx = png.width / pts.w, sy = png.height / pts.h;
      let mSum = 0, tSum = 0;
      for (const [cx, cy] of pts.empties) {
        const p = samplePngBox(png, (cx - pts.cell * 0.22) * sx, (cy - pts.cell * 0.22) * sy, (cx + pts.cell * 0.22) * sx, (cy + pts.cell * 0.22) * sy);
        mSum += p.lum;
      }
      for (const [cx, cy] of pts.tiles) {
        // Upper-left warm-ivory tile face corner away from dark glyph
        const p = samplePngBox(png, (cx - pts.cell * 0.32) * sx, (cy - pts.cell * 0.32) * sy, (cx - pts.cell * 0.14) * sx, (cy - pts.cell * 0.14) * sy);
        tSum += p.lum;
      }
      const nightMarbleLum = mSum / pts.empties.length;
      const nightTileLum = tSum / pts.tiles.length;
      t.log(`W2-S1-04 Night rendered (${t.viewport}): marbleLum=${nightMarbleLum.toFixed(1)}, tileLum=${nightTileLum.toFixed(1)}, delta=${(nightTileLum - nightMarbleLum).toFixed(1)}`);
      t.expect(nightMarbleLum >= 42 && nightMarbleLum <= 118, `Night marble stays calm twilight slate-limestone, not glaring slab (lum=${nightMarbleLum.toFixed(1)}, target 42..118)`);
      t.expect(nightTileLum >= 165, `Night warm-ivory tiles stay clearly readable (lum=${nightTileLum.toFixed(1)} >= 165)`);
      t.expect(nightTileLum - nightMarbleLum >= 75, `Night tiles separate sharply from twilight marble (delta=${(nightTileLum - nightMarbleLum).toFixed(1)} >= 75)`);
      if (t.viewport === 'desktop' && b3 && b3.on) {
        const towel = samplePngBox(png, png.width * 0.045, png.height * 0.13, png.width * 0.085, png.height * 0.21);
        t.log(`Night 3D towel rendered sample: rgb(${towel.r.toFixed(0)},${towel.g.toFixed(0)},${towel.b.toFixed(0)}) lum=${towel.lum.toFixed(1)}`);
        t.expect(towel.lum < 105, `Night 3D towels stay darkened twilight linen (lum=${towel.lum.toFixed(1)} < 105)`);
      }
      await t.shot('w2-b10-night-midgame', { timeout: 15000 });
    },
  },
  // ---------- W2-S1-02 ----------
  {
    name: 'W2-S1-02 progressive open-square dimming renders depth-tested underneath 3D tiles at DIM_STEP=0.018 / DIM_MAX=0.30 (zero 2D overlay smudge), preserving stained-glass richness and softening Day plaque gloss',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);

      // 1) Verify DIM_STEP = 0.018 and DIM_MAX in 0.28..0.32
      const consts = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        return { step: R.DIM_STEP, max: R.DIM_MAX, dimmable: R.DIMMABLE.length };
      });
      t.equal(consts.step, 0.018, `DIM_STEP is 0.018 (got ${consts.step})`);
      t.expect(consts.max >= 0.28 && consts.max <= 0.32, `DIM_MAX is in 0.28..0.32 (got ${consts.max})`);

      // 2) Verify Day .plaque / .springs-bar softened gloss while preserving warm antique-brass identity & WCAG >= 5.5:1 contrast
      const plaqueStyle = await t.page.evaluate(() => {
        const el = document.querySelector('#springs .plaque, #springs .springs-bar');
        const cs = el ? getComputedStyle(el) : null;
        const stops = cs ? (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []) : [];
        return { found: !!el, bg: cs ? cs.backgroundImage : '', shadow: cs ? cs.boxShadow : '', color: cs ? cs.color : '', stops };
      });
      t.equal(plaqueStyle.found, true, 'Day Featured Springs plaque/bar rendered');
      t.expect(plaqueStyle.stops.length >= 3, `Day plaque retains multi-stop warm antique-brass gradient (${plaqueStyle.stops.length} stops)`);
      const parseRgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const v = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: v[0], g: v[1], b: v[2], a: v[3] == null ? 1 : v[3] }; };
      const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
      const relLum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
      const cr = (a, b) => { const l1 = relLum(a), l2 = relLum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
      const fg = parseRgb(plaqueStyle.color);
      const topStop = parseRgb(plaqueStyle.stops[0]);
      t.expect(topStop.r > topStop.g && topStop.g > topStop.b && topStop.r - topStop.b >= 70, `Day plaque preserves warm antique-brass hue (CD-WF2-04: ${plaqueStyle.stops[0]})`);
      t.expect(topStop.r <= 232 && topStop.g <= 208, `Day plaque top specular stop softened below old #F5E29B glare (${plaqueStyle.stops[0]})`);
      for (const st of plaqueStyle.stops) {
        const bg = parseRgb(st);
        t.expect(cr(fg, bg) >= 5.5, `Day plaque contrast ${plaqueStyle.color} vs ${st} = ${cr(fg, bg).toFixed(2)} >= 5.5`);
      }
      t.expect(!/rgba\(255,\s*250,\s*220,\s*0\.8/.test(plaqueStyle.shadow), `Day plaque specular top inset highlight softened (${plaqueStyle.shadow})`);

      // 3) Measure open Hot 3L & Bathhouse Row squares at 0-down baseline vs 10-down ramp vs 24-down max
      const hotIdx = SQUARE.findIndex((k, i) => k === 'h' && i >= 30 && i < 100);
      const rowIdx = SQUARE.findIndex((k, i) => k === 'B' && i >= 30 && i < 100);
      const mode3d = (await t.state()).view.mode3d;

      // Baseline: stage 1 tile on CENTER (down=0, preDim=false -> dimOpacity=0)
      const rack0 = (await t.state()).game.players[0].rack.find((l) => l !== '?') || 'E';
      await t.game('act', 'stage', [{ i: CENTER, l: rack0 }]);
      await t.waitFrames(3);
      const measureCell = async (idx) => {
        const overlayAlpha = await t.page.evaluate(async (cell) => {
          const cv = document.getElementById('board'), k = cv.width / cv.clientWidth;
          const [x, y] = await window.__game.act('cell', cell);
          const [x2] = await window.__game.act('cell', cell + 1);
          const c = Math.abs(x2 - x), r = Math.max(2, Math.round(0.07 * c * k));
          const px = Math.round((x - 0.36 * c) * k), py = Math.round((y - 0.36 * c) * k);
          const d = cv.getContext('2d').getImageData(px - r, py - r, 2 * r, 2 * r).data;
          let a = 0, n = 0;
          for (let j = 0; j < d.length; j += 4) { a += d[j + 3]; n++; }
          return a / n;
        }, idx);
        const buf = await t.page.locator('#boardwrap').screenshot();
        const png = decodePng(buf);
        const geom = await t.page.evaluate(async (cell) => {
          const bw = document.getElementById('boardwrap').getBoundingClientRect();
          const [x, y] = await window.__game.act('cell', cell);
          const [x2] = await window.__game.act('cell', cell + 1);
          return { w: bw.width, h: bw.height, x, y, c: Math.abs(x2 - x) };
        }, idx);
        const sx = png.width / geom.w, sy = png.height / geom.h;
        const r = Math.max(2, geom.c * 0.08);
        const cx = geom.x - 0.35 * geom.c, cy = geom.y - 0.35 * geom.c;
        const sample = samplePngBox(png, (cx - r) * sx, (cy - r) * sy, (cx + r) * sx, (cy + r) * sy);
        // Peak cool blue-vs-red hue delta inside the cell (confirms stained-glass cobalt saturation survives dimming)
        let peakBlue = -255;
        const bx0 = Math.max(0, Math.floor((geom.x - 0.42 * geom.c) * sx));
        const bx1 = Math.min(png.width, Math.ceil((geom.x + 0.42 * geom.c) * sx));
        const by0 = Math.max(0, Math.floor((geom.y - 0.42 * geom.c) * sy));
        const by1 = Math.min(png.height, Math.ceil((geom.y + 0.42 * geom.c) * sy));
        for (let py = by0; py < by1; py++) {
          for (let px = bx0; px < bx1; px++) {
            const o = (py * png.width + px) * png.bpp;
            const d = png.data[o + 2] - png.data[o];
            if (d > peakBlue) peakBlue = d;
          }
        }
        return { overlayAlpha, peakBlue, ...sample };
      };
      const baseHot = await measureCell(hotIdx);
      const baseRow = await measureCell(rowIdx);
      await t.game('act', 'recall');

      // 10 tiles down: intermediate smooth ramp (~0.18)
      const g10 = (await t.state()).game;
      for (let k = 0; k < 10; k++) g10.board[105 + k] = { l: 'ETAOINSHRD'[k], blank: false };
      await t.game('setState', { game: g10 });
      await t.waitFrames(3);
      if (mode3d) {
        const b3Mid = await t.game('act', 'b3');
        t.expect(Math.abs(b3Mid.dimOpacity - 0.18) < 0.005, `3D dimming ramps smoothly at 10 tiles (dimOpacity=${b3Mid.dimOpacity.toFixed(3)}, want 0.180)`);
      }

      // 24 tiles down: full DIM_MAX = 0.30
      const g24 = (await t.state()).game;
      for (let k = 0; k < 24; k++) g24.board[105 + k] = { l: 'ETAOINSHR'[k % 9], blank: false };
      await t.game('setState', { game: g24 });
      await t.waitIdle(6000);
      await t.game('act', 'freezeFx', 0);
      await t.waitFrames(3);

      const fullHot = await measureCell(hotIdx);
      const fullRow = await measureCell(rowIdx);
      t.log(`W2-S1-02 (${t.viewport}, ${mode3d ? '3D' : '2D'}): hot lum ${baseHot.lum.toFixed(1)} -> ${fullHot.lum.toFixed(1)} (overlay alpha=${fullHot.overlayAlpha.toFixed(1)}), row lum ${baseRow.lum.toFixed(1)} -> ${fullRow.lum.toFixed(1)}`);
      if (mode3d) {
        const b3Full = await t.game('act', 'b3');
        t.equal(b3Full.preDim, false, 'Turn-1 preDim is false once 24 tiles are down');
        t.expect(Math.abs(b3Full.dimOpacity - 0.30) < 0.005, `3D depth-tested dimming reaches DIM_MAX=0.30 at 24 tiles (got ${b3Full.dimOpacity.toFixed(3)})`);
        t.expect(fullHot.overlayAlpha < 1 && fullRow.overlayAlpha < 1, `2D #board overlay carries zero dimming wash over 3D tiles (alpha ${fullHot.overlayAlpha.toFixed(1)}, ${fullRow.overlayAlpha.toFixed(1)})`);
      }
      t.expect(fullHot.lum < baseHot.lum * 0.88 && fullHot.lum > baseHot.lum * 0.56, `Hot 3L square visibly dimmed while preserving richness (${baseHot.lum.toFixed(1)} -> ${fullHot.lum.toFixed(1)})`);
      t.expect(fullRow.lum < baseRow.lum * 0.88 && fullRow.lum > baseRow.lum * 0.56, `Bathhouse Row square visibly dimmed while preserving richness (${baseRow.lum.toFixed(1)} -> ${fullRow.lum.toFixed(1)})`);
      t.expect(fullHot.peakBlue >= 28, `dimmed Hot 3L stained-glass retains cool blue hue richness (peak b-r=${fullHot.peakBlue})`);
      await t.shot('w2-b10-day-dimming-plaques', { timeout: 15000 });
    },
  },
];
