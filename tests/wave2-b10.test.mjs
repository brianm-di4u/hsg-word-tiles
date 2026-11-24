// Wave 2, batch W2-B10: W2-S2-06, W2-S1-01, W2-S1-04, W2-S1-02 (visual hierarchy).
import zlib from 'node:zlib';

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
];
