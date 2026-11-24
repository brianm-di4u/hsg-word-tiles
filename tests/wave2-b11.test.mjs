// Wave 2, batch W2-B11: W3-P-N01, W3-P-N02, W3-S5-01, W3-S5-02 (tech-art & pipeline hygiene).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { root } from './lib.mjs';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
  }
};

export const tests = [
  // ---------- W3-P-N01 ----------
  {
    name: 'W3-P-N01 tileCache skips kind=face, keys on (theme, art.version), refreshes rack/board/3D tiles after font load and live Day<->Night switch',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      // Hold assets/fonts.css so gameplay starts before Fraunces 800 loads (reproducing fast-start fallback font freeze).
      let releaseFonts;
      const fontGate = new Promise((res) => { releaseFonts = res; });
      let intercepted = 0;
      await t.page.route('**/assets/fonts.css', async (route) => {
        intercepted++;
        await fontGate;
        await route.continue();
      });
      await t.page.reload({ waitUntil: 'domcontentloaded' });
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.game('act', 'autoplay', 4);
      await t.page.waitForFunction(() => window.__game.getState().game.move >= 4, null, { timeout: 10000 });
      await t.waitFrames(3);

      t.expect(intercepted >= 1, 'assets/fonts.css was held back before game start');

      // 1) Verify kind === 'face' never enters 2D tileCache (zero duplicate 512px canvas in CPU RAM)
      const cacheCheck = await t.page.evaluate(async () => {
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        R.invalidateTileCache();
        const n0 = R.tileCacheSize();
        const f1 = R.tileSprite('Q', false, 512, 'face', 'light');
        const f2 = R.tileSprite('Q', false, 512, 'face', 'light');
        const nAfterFace = R.tileCacheSize();
        const b1 = R.tileSprite('Q', false, 64, 'board', 'light');
        const b2 = R.tileSprite('Q', false, 64, 'board', 'light');
        const nAfterBoard = R.tileCacheSize();
        return { n0, nAfterFace, nAfterBoard, faceDistinct: f1 !== f2, boardCached: b1 === b2, faceW: f1.width };
      });
      t.equal(cacheCheck.n0, 0, 'R.invalidateTileCache() clears tileCache');
      t.equal(cacheCheck.nAfterFace, 0, 'R.tileSprite(..., "face") skips tileCache (no 512px CPU duplicate)');
      t.equal(cacheCheck.faceDistinct, true, 'kind="face" returns an uncached canvas directly');
      t.equal(cacheCheck.nAfterBoard, 1, '2D kind="board" still caches in tileCache');
      t.equal(cacheCheck.boardCached, true, '2D kind="board" returns cached sprite');

      // Capture rack tile snapshot before fonts load (fallback Georgia/serif)
      const beforeFont = await t.page.evaluate(() => {
        const btn = document.querySelector('#rack .rtile');
        const cv = btn && btn.querySelector('canvas');
        const loaded = [...(document.fonts || [])].some((f) => f.family.replace(/["']/g, '') === 'Fraunces' && String(f.weight) === '800' && f.status === 'loaded');
        return {
          key: btn ? btn.dataset.key : '',
          dataUrl: cv ? cv.toDataURL() : '',
          frauncesLoaded: loaded,
        };
      });
      t.expect(beforeFont.key.endsWith('|light|0'), `rack tile key includes theme and art.version=0 before fonts load (${beforeFont.key})`);
      t.equal(beforeFont.frauncesLoaded, false, 'Fraunces 800 @font-face has not loaded yet');

      // 2) Release assets/fonts.css and verify loadArt() refreshes rack tiles + board + 3D faceCache to Fraunces 800
      releaseFonts();
      await t.page.waitForFunction(() => {
        const btn = document.querySelector('#rack .rtile');
        return btn && /\|light\|[1-9]/.test(btn.dataset.key || '');
      }, null, { timeout: 10000 });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      const afterFont = await t.page.evaluate(async () => {
        const btn = document.querySelector('#rack .rtile');
        const cv = btn && btn.querySelector('canvas');
        const ctx = cv.getContext('2d');
        const p = ctx.getImageData(Math.round(cv.width * 0.16), Math.round(cv.height * 0.16), 1, 1).data;
        const b3 = await window.__game.act('b3');
        const loaded = [...(document.fonts || [])].some((f) => f.family.replace(/["']/g, '') === 'Fraunces' && String(f.weight) === '800' && f.status === 'loaded');
        return {
          key: btn ? btn.dataset.key : '',
          dataUrl: cv ? cv.toDataURL() : '',
          cornerRgb: [p[0], p[1], p[2]],
          frauncesLoaded: loaded,
          b3,
        };
      });
      t.equal(afterFont.frauncesLoaded, true, 'Fraunces 800 loaded');
      t.expect(afterFont.dataUrl !== beforeFont.dataUrl, 'rack tile canvas re-rasterized after Fraunces 800 loaded');
      t.expect(afterFont.cornerRgb[0] >= 248 && afterFont.cornerRgb[1] >= 242, `Day rack tile corner is crisp ivory (${afterFont.cornerRgb.join(',')})`);
      if (afterFont.b3 && afterFont.b3.on) {
        t.expect(afterFont.b3.faceCache > 0, `3D faceCache populated after font load (${afterFont.b3.faceCache})`);
      }

      // 3) Live Day -> Night theme toggle updates rack tiles, 2D tileCache, and 3D faceCache cleanly
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(6000);
      await t.waitFrames(3);

      const afterNight = await t.page.evaluate(async () => {
        const btn = document.querySelector('#rack .rtile');
        const cv = btn && btn.querySelector('canvas');
        const ctx = cv.getContext('2d');
        const p = ctx.getImageData(Math.round(cv.width * 0.16), Math.round(cv.height * 0.16), 1, 1).data;
        const b3 = await window.__game.act('b3');
        return {
          key: btn ? btn.dataset.key : '',
          dataUrl: cv ? cv.toDataURL() : '',
          cornerRgb: [p[0], p[1], p[2]],
          b3,
        };
      });
      t.expect(/\|dark\|[1-9]/.test(afterNight.key), `rack tile key switched to dark theme (${afterNight.key})`);
      t.expect(afterNight.dataUrl !== afterFont.dataUrl, 'rack tile canvas re-rasterized for Night palette');
      t.expect(afterNight.cornerRgb[0] < afterFont.cornerRgb[0] - 5, `Night rack tile shifted to warm #EDE5D4 ivory (${afterFont.cornerRgb.join(',')} -> ${afterNight.cornerRgb.join(',')})`);
      if (afterNight.b3 && afterNight.b3.on) {
        t.equal(afterNight.b3.dark, true, '3D board switched to Night theme');
        t.expect(afterNight.b3.faceCache > 0, `3D faceCache rebuilt for Night tiles (${afterNight.b3.faceCache})`);
      }
      await t.shot('w2-b11-night-live-tiles', { timeout: 15000 });
      await t.page.unroute('**/assets/fonts.css');
    },
  },
  // ---------- W3-P-N02 ----------
  {
    name: 'W3-P-N02 ?art=0 triggers zero .webp and zero art-data.js loads across all screens, Help squares, Fact Cards, and gameplay',
    viewports: ['desktop'],
    url: 'index.html?art=0',
    initScript: quiet,
    async run(t) {
      const badReqs = [];
      t.page.on('request', (req) => {
        const u = req.url();
        if (/\.webp(\?|$)/i.test(u) || /art-data\.js(\?|$)/i.test(u)) badReqs.push(u);
      });
      await t.page.reload({ waitUntil: 'load' });
      await ready(t);

      // Check Title vector fallback & body.no-art class
      const titleCheck = await t.page.evaluate(() => ({
        noArt: document.body.classList.contains('no-art'),
        webpImgs: [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => /\.webp/i.test(s || '')),
        vectorTitle: !!document.querySelector('.title-art.vector'),
      }));
      t.equal(titleCheck.noArt, true, 'body.no-art class set under ?art=0');
      t.equal(titleCheck.vectorTitle, true, 'Title uses vector fallback art');
      t.equal(titleCheck.webpImgs.length, 0, 'Title has zero .webp <img> elements');

      // Visit Setup, Help (all tabs including Squares & Words), Register, Records, About
      for (const sc of ['setup', 'register', 'records', 'about']) {
        await t.game('scene', sc);
        const imgs = await t.page.evaluate(() => [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => /\.webp/i.test(s || '')));
        t.equal(imgs.length, 0, `${sc} has zero .webp <img> elements`);
      }
      await t.game('scene', 'help');
      for (const tab of ['rules', 'squares', 'words', 'keys']) {
        await t.page.click(`[data-tab="${tab}"]`);
        const info = await t.page.evaluate(() => {
          const imgs = [...document.querySelectorAll('img')].map((i) => i.getAttribute('src')).filter((s) => /\.webp/i.test(s || ''));
          const sqBgs = [...document.querySelectorAll('.sq-w, .sq-h, .sq-s, .sq-b')].map((el) => getComputedStyle(el).backgroundImage);
          return { imgs, sqBgs };
        });
        t.equal(info.imgs.length, 0, `Help (${tab}) has zero .webp <img> elements`);
        for (const bg of info.sqBgs) t.expect(!/\.webp/i.test(bg), `Help (${tab}) .sq-* uses pure CSS gradient (${bg})`);
      }
      await t.page.click('[data-tab="squares"]');
      await t.shot('w2-b11-noart-help-squares');

      // Start game, inspect #rackbar CSS, open a Fact Card, and run to Game Over
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 4);
      await t.waitIdle(8000);
      const rackBg = await t.page.evaluate(() => getComputedStyle(document.querySelector('#rackbar')).backgroundImage);
      t.expect(!/\.webp/i.test(rackBg), `#rackbar uses pure CSS gradient under body.no-art (${rackBg})`);
      await t.shot('w2-b11-noart-board', { timeout: 15000 });

      await t.game('act', 'fact', 'spring', 'SPRING');
      const factCheck = await t.page.evaluate(() => ({
        imgs: [...document.querySelectorAll('#modal img')].map((i) => i.getAttribute('src')).filter((s) => /\.webp/i.test(s || '')),
        vectorVig: !!document.querySelector('#modal .vig.vector'),
      }));
      t.equal(factCheck.imgs.length, 0, 'Fact card has zero .webp <img> elements under ?art=0');
      t.equal(factCheck.vectorVig, true, 'Fact card renders vector fallback vignette');
      await t.game('act', 'close');

      t.equal(badReqs.length, 0, `zero .webp or art-data.js requests under ?art=0 (got: ${badReqs.join(', ')})`);
    },
  },
  {
    name: 'W3-P-N02 ?art=0 on file:// skips assets/art-data.js script injection and triggers zero .webp loads',
    viewports: ['desktop'],
    fileUrl: true,
    url: 'index.html?art=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41 });
      await t.waitIdle(8000);
      const res = await t.page.evaluate(() => ({
        noArt: document.body.classList.contains('no-art'),
        artDataScripts: document.querySelectorAll('script[src*="art-data.js"]').length,
        hasArtDataGlobal: typeof window.__ART_DATA !== 'undefined',
        webpImgs: [...document.querySelectorAll('img')].filter((i) => /\.webp/i.test(i.getAttribute('src') || '')).length,
      }));
      t.equal(res.noArt, true, 'file:// ?art=0 sets body.no-art');
      t.equal(res.artDataScripts, 0, 'file:// ?art=0 never injects assets/art-data.js');
      t.equal(res.hasArtDataGlobal, false, 'file:// ?art=0 leaves window.__ART_DATA undefined');
      t.equal(res.webpImgs, 0, 'file:// ?art=0 renders zero .webp <img> elements');
    },
  },
];
