// Wave 3, batch W3-B04: W5-S2-02 (Day/Night semantic surface tokens for .stile, .tchip, .reg-item button,
// .winner, .daily-box, .wchip; separated Night --brass vs --primary/--gold; fill-rule="evenodd" cutout pips in ICON.cat.dice).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { ICON } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quietNight = () => {
  window.__TEST_TIPS__ = false;
  localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'dark' }));
};
const quietDay = () => {
  window.__TEST_TIPS__ = false;
  localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' }));
};

function parseRgb(c) {
  const m = c && c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const v = m[1].split(/[ ,/]+/).filter(Boolean).map(parseFloat);
  return { r: v[0], g: v[1], b: v[2], a: v[3] == null ? 1 : v[3] };
}
function lum({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a, b) {
  const L1 = lum(a), L2 = lum(b);
  return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
}

async function auditSurface(t, label, selector, { darkSurface, minContrast = 4.5, subSelector = null }) {
  const info = await t.page.evaluate(({ sel, sub }) => {
    const el = document.querySelector(sel);
    if (!el) return { found: false };
    const cs = getComputedStyle(el);
    const bgImg = cs.backgroundImage || '';
    const stops = bgImg.match(/rgba?\([^)]+\)/g) || [];
    const bgCol = cs.backgroundColor;
    const subEl = sub ? el.querySelector(sub) : null;
    const subCol = subEl ? getComputedStyle(subEl).color : null;
    return { found: true, color: cs.color, bgImg, bgCol, stops, subCol };
  }, { sel: selector, sub: subSelector });
  t.equal(info.found, true, `${label}: ${selector} rendered`);
  const fg = parseRgb(info.color);
  t.expect(!!fg, `${label}: parsed foreground ${info.color}`);
  const bgs = info.stops.length ? info.stops.map(parseRgb).filter(Boolean) : [parseRgb(info.bgCol)].filter(Boolean);
  t.expect(bgs.length > 0, `${label}: has background color/stops`);
  for (const bg of bgs) {
    const L = lum(bg);
    if (darkSurface) t.expect(L < 0.16, `${label}: Night surface stop rgb(${bg.r},${bg.g},${bg.b}) stays dark twilight (lum=${L.toFixed(3)} < 0.16)`);
    else t.expect(L > 0.40, `${label}: Day surface stop rgb(${bg.r},${bg.g},${bg.b}) stays light parchment/gold (lum=${L.toFixed(3)} > 0.40)`);
    const cr = contrast(fg, bg);
    t.expect(cr >= minContrast, `${label}: text ${info.color} vs stop rgb(${bg.r},${bg.g},${bg.b}) = ${cr.toFixed(2)} (need >= ${minContrast})`);
    if (info.subCol) {
      const scr = contrast(parseRgb(info.subCol), bg);
      t.expect(scr >= minContrast, `${label} (${subSelector}): ${info.subCol} vs stop rgb(${bg.r},${bg.g},${bg.b}) = ${scr.toFixed(2)} (need >= ${minContrast})`);
    }
  }
}

export const tests = [
  {
    name: 'W5-S2-02 ICON.cat.dice uses fill-rule="evenodd" cutout pips with zero hardcoded white fill, and CSS defines all semantic Day/Night tokens',
    node: true,
    async run(t) {
      const dice = ICON.cat.dice;
      t.expect(/fill-rule="evenodd"/.test(dice), `ICON.cat.dice uses fill-rule="evenodd" cutouts (${dice})`);
      t.equal(/#fff|#ffffff|\bwhite\b/i.test(dice), false, 'ICON.cat.dice has zero hardcoded white fill');
      t.equal(/<circle\b/i.test(dice), false, 'ICON.cat.dice cuts pips into the path instead of painting opaque circles');

      const css = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
      const rootBlock = css.slice(css.indexOf(':root {'), css.indexOf('body.theme-dark {'));
      const darkBlock = css.slice(css.indexOf('body.theme-dark {'), css.indexOf('* { box-sizing'));
      for (const tok of ['--tile-bg', '--tile-ink', '--reward-bg', '--reward-ink', '--daily-bg', '--daily-ink']) {
        t.expect(rootBlock.includes(tok + ':'), `:root defines ${tok}`);
        t.expect(darkBlock.includes(tok + ':'), `body.theme-dark defines ${tok}`);
      }
      const mPri = darkBlock.match(/--primary:\s*([^;]+);/);
      const mBra = darkBlock.match(/--brass:\s*([^;]+);/);
      const mGld = darkBlock.match(/--gold:\s*([^;]+);/);
      t.expect(!!mPri && !!mBra && !!mGld, 'body.theme-dark defines --primary, --brass, and --gold');
      t.expect(mPri[1].trim().toLowerCase() !== mBra[1].trim().toLowerCase(), `Night separates --brass (${mBra[1].trim()}) from --primary (${mPri[1].trim()})`);
      t.expect(mBra[1].trim().toLowerCase() !== mGld[1].trim().toLowerCase(), `Night separates --brass (${mBra[1].trim()}) from --gold (${mGld[1].trim()})`);
    },
  },
  {
    name: 'W5-S2-02 Night theme surfaces (.stile, .tchip, .reg-item, .winner, .wchip, .daily-box), separated --brass/--primary, CD-WF5-03 hierarchy, and cutout dice pips >= 5:1',
    viewports: ['desktop', 'mobile'],
    initScript: quietNight,
    async run(t) {
      await ready(t);

      // 1) Verify live computed Night token separation (--brass != --primary)
      const tokens = await t.page.evaluate(() => {
        const cs = getComputedStyle(document.body);
        const get = (k) => cs.getPropertyValue(k).trim();
        return {
          dark: document.body.classList.contains('theme-dark'),
          primary: get('--primary'),
          brass: get('--brass'),
          gold: get('--gold'),
          tileInk: get('--tile-ink'),
          rewardInk: get('--reward-ink'),
          dailyInk: get('--daily-ink'),
        };
      });
      t.equal(tokens.dark, true, 'Night theme active');
      t.expect(tokens.primary.toLowerCase() !== tokens.brass.toLowerCase(), `Night --primary (${tokens.primary}) != passive --brass (${tokens.brass})`);
      t.expect(tokens.gold.toLowerCase() !== tokens.brass.toLowerCase(), `Night --gold (${tokens.gold}) != passive --brass (${tokens.brass})`);

      // 2) Signed Bathhouse Register .reg-item button in Night
      await t.page.evaluate(() => {
        localStorage.setItem('hs-letters-register-v1', JSON.stringify({
          SPRING: { id: 'spring', first: '2026-11-20', count: 2, best: 34 },
          CASINO: { id: 'casino', first: '2026-11-21', count: 1, best: 48 },
        }));
      });
      await t.game('scene', 'register');
      await t.waitFrames(2);
      await auditSurface(t, 'Night Register signed .reg-item button', '.reg-item:not(.locked) button', { darkSurface: true, subSelector: 'small' });
      const regContrast = await t.contrastReport({ selector: '.sheet.register', min: 4.5, largeMin: 3 });
      t.equal(regContrast.fails.length, 0, `Night Register passes WCAG contrast (${JSON.stringify(regContrast.fails)})`);
      if (t.viewport === 'desktop') await t.shot('w3-b04-night-register');

      // 3) Help -> Squares .tchip in Night
      await t.game('scene', 'help');
      await t.page.click('[data-tab="squares"]');
      await t.waitFrames(2);
      await auditSurface(t, 'Night Help .tchip', '.help .tchip', { darkSurface: true, subSelector: 'small' });
      const helpContrast = await t.contrastReport({ selector: '.sheet.help', min: 4.5, largeMin: 3 });
      t.equal(helpContrast.fails.length, 0, `Night Help -> Squares passes WCAG contrast (${JSON.stringify(helpContrast.fails)})`);

      // 4) In-game Night: Swap .stile (idle + selected), Tracker .tchip, and Club plaque ICON.cat.dice cutout pips
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(6000);

      // Force a Club Featured Spring so ICON.cat.dice renders on a Night plaque
      await t.page.evaluate(() => {
        const G = window.__G;
        G.s.featured[0] = { word: 'CASINO', cat: 'club', id: 'casino', shown: [0], by: null };
      });
      await t.game('act', 'reveal');
      if (t.viewport === 'mobile') {
        const toggle = t.page.locator('[data-springs-toggle]');
        if (await toggle.isVisible()) await toggle.click();
      }
      await t.waitFrames(2);

      // Rasterize the rendered Night Club plaque dice SVG onto its actual plaque background to verify pip cutout contrast
      const diceCheck = await t.page.evaluate(async () => {
        const plaque = document.querySelector('.plaque[data-plaque="0"]');
        const svg = plaque && plaque.querySelector('.pcat svg');
        if (!plaque || !svg) return { found: false };
        const cs = getComputedStyle(plaque);
        const bgStops = (cs.backgroundImage.match(/rgba?\([^)]+\)/g) || []);
        const fg = cs.color;
        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', '96');
        clone.setAttribute('height', '96');
        clone.style.color = fg;
        // Replace currentColor explicitly for standalone SVG data URL rasterization
        const xml = new XMLSerializer().serializeToString(clone).replace(/currentColor/g, fg);
        const im = await new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
        });
        const cv = document.createElement('canvas'); cv.width = 96; cv.height = 96;
        const ctx = cv.getContext('2d');
        ctx.fillStyle = bgStops[1] || bgStops[0] || '#2E2718';
        ctx.fillRect(0, 0, 96, 96);
        ctx.drawImage(im, 0, 0, 96, 96);
        const px = (x, y) => { const d = ctx.getImageData(x, y, 1, 1).data; return { r: d[0], g: d[1], b: d[2], a: d[3] }; };
        // Center pip is at (12, 12) -> (48, 48); solid die body at (12, 6) -> (48, 24)
        return {
          found: true,
          fg,
          bg: bgStops[1] || bgStops[0],
          hasWhiteFill: /#fff|#ffffff/i.test(xml),
          hasEvenOdd: /fill-rule="evenodd"/.test(xml),
          pipRgb: px(48, 48),
          bodyRgb: px(48, 24),
          pip1Rgb: px(34, 34),
          pip3Rgb: px(62, 62),
        };
      });
      t.equal(diceCheck.found, true, 'Night Club plaque dice SVG rendered');
      t.equal(diceCheck.hasWhiteFill, false, 'Night Club dice SVG contains no hardcoded white fill');
      t.equal(diceCheck.hasEvenOdd, true, 'Night Club dice SVG uses fill-rule="evenodd"');
      const pipCr = contrast(diceCheck.pipRgb, diceCheck.bodyRgb);
      const pip1Cr = contrast(diceCheck.pip1Rgb, diceCheck.bodyRgb);
      const pip3Cr = contrast(diceCheck.pip3Rgb, diceCheck.bodyRgb);
      t.expect(pipCr >= 5.0 && pip1Cr >= 5.0 && pip3Cr >= 5.0, `Night dice cutout pips show dark plaque ground >= 5:1 vs gold die body (center=${pipCr.toFixed(2)}, tl=${pip1Cr.toFixed(2)}, br=${pip3Cr.toFixed(2)})`);
      if (t.viewport === 'desktop') await t.shot('w3-b04-night-plaque-dice');

      // Swap dialog .stile (unselected + selected)
      await t.game('act', 'open', 'swap');
      await t.waitFrames(2);
      await auditSurface(t, 'Night Swap .stile', '#modal .stile', { darkSurface: true });
      await t.page.click('#modal .stile[data-sw="0"]');
      await auditSurface(t, 'Night Swap selected .stile[aria-pressed="true"]', '#modal .stile[aria-pressed="true"]', { darkSurface: true });
      if (t.viewport === 'desktop') await t.shot('w3-b04-night-swap');
      await t.game('act', 'close');

      // Tracker .tchip in Night
      await t.game('act', 'open', 'tracker');
      await t.waitFrames(2);
      await auditSurface(t, 'Night Tracker .tchip', '#modal .tchip', { darkSurface: true, subSelector: 'small' });
      await t.game('act', 'close');

      // 5) Final Soak .winner and .wchip in Night (plus CD-WF5-03 distinction from .fchip)
      await t.page.evaluate(() => {
        const G = window.__G;
        G.s.over = true;
        G.s.players[0].score = 342;
        G.s.players[1].score = 298;
        G.s.players[0].best = { word: 'STEAM', score: 42 };
        G.s.log.push({ p: 0, kind: 'play', n: 1, score: 42, full: 0, themed: 10, words: [{ w: 'STEAM', score: 32, bonus: 10, themed: 'steam' }] });
        G.s.result = { why: 'out', out: 0, adjust: [12, -12], winners: [0] };
      });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      await auditSurface(t, 'Night Final Soak .winner', '.sheet.over .winner', { darkSurface: true, subSelector: '.wmeta small' });
      await auditSurface(t, 'Night Final Soak .wchip', '.sheet.over .wchip', { darkSurface: true });
      const chipDiff = await t.page.evaluate(() => {
        const w = document.querySelector('.sheet.over .wchip');
        const f = document.querySelector('.sheet.over .feat-list li');
        const wcs = w && getComputedStyle(w), fcs = f && getComputedStyle(f);
        return { wBg: wcs && wcs.backgroundImage, fBg: fcs && fcs.backgroundColor, wCol: wcs && wcs.color };
      });
      t.expect(/gradient/.test(chipDiff.wBg || ''), `CD-WF5-03: Night .wchip keeps antique-gold gradient distinct from .fchip (${chipDiff.wBg} vs ${chipDiff.fBg})`);
      const overContrast = await t.contrastReport({ selector: '.sheet.over', min: 4.5, largeMin: 3 });
      t.equal(overContrast.fails.length, 0, `Night Final Soak passes WCAG contrast (${JSON.stringify(overContrast.fails)})`);
      await t.shot('w3-b04-night-over');

      // 6) Daily Soak .daily-box in Night
      await t.game('newGame', { mode: 'daily', date: '2026-11-24' });
      await t.waitIdle(6000);
      await t.page.evaluate(() => {
        const G = window.__G;
        G.s.over = true;
        G.s.players[0].score = 215;
        G.s.result = { why: 'daily', out: null, adjust: [0], winners: [0] };
      });
      await t.game('scene', 'over');
      await t.waitFrames(2);
      await auditSurface(t, 'Night Daily Soak .daily-box', '.sheet.over .daily-box', { darkSurface: true, subSelector: '.note' });
      const dailyContrast = await t.contrastReport({ selector: '.sheet.over', min: 4.5, largeMin: 3 });
      t.equal(dailyContrast.fails.length, 0, `Night Daily results pass WCAG contrast (${JSON.stringify(dailyContrast.fails)})`);
      if (t.viewport === 'desktop') await t.shot('w3-b04-night-daily');
    },
  },
  {
    name: 'W5-S2-02 Day theme preserves warm cream/gold/mint semantic surfaces and >= 4.5:1 contrast',
    viewports: ['desktop'],
    initScript: quietDay,
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => {
        localStorage.setItem('hs-letters-register-v1', JSON.stringify({
          SPRING: { id: 'spring', first: '2026-11-20', count: 2, best: 34 },
        }));
      });
      await t.game('scene', 'register');
      await auditSurface(t, 'Day Register signed .reg-item button', '.reg-item:not(.locked) button', { darkSurface: false, subSelector: 'small' });
      await t.game('scene', 'help');
      await t.page.click('[data-tab="squares"]');
      await auditSurface(t, 'Day Help .tchip', '.help .tchip', { darkSurface: false, subSelector: 'small' });
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(6000);
      await t.game('act', 'open', 'swap');
      await auditSurface(t, 'Day Swap .stile', '#modal .stile', { darkSurface: false });
      await t.game('act', 'close');
      await t.page.evaluate(() => {
        const G = window.__G;
        G.s.over = true;
        G.s.players[0].score = 342; G.s.players[1].score = 298;
        G.s.log.push({ p: 0, kind: 'play', n: 1, score: 42, full: 0, themed: 10, words: [{ w: 'STEAM', score: 32, bonus: 10, themed: 'steam' }] });
        G.s.result = { why: 'out', out: 0, adjust: [12, -12], winners: [0] };
      });
      await t.game('scene', 'over');
      await auditSurface(t, 'Day Final Soak .winner', '.sheet.over .winner', { darkSurface: false, subSelector: '.wmeta small' });
      await auditSurface(t, 'Day Final Soak .wchip', '.sheet.over .wchip', { darkSurface: false });
      await t.game('newGame', { mode: 'daily', date: '2026-11-24' });
      await t.waitIdle(6000);
      await t.page.evaluate(() => {
        const G = window.__G;
        G.s.over = true; G.s.players[0].score = 215;
        G.s.result = { why: 'daily', out: null, adjust: [0], winners: [0] };
      });
      await t.game('scene', 'over');
      await auditSurface(t, 'Day Daily Soak .daily-box', '.sheet.over .daily-box', { darkSurface: false, subSelector: '.note' });
    },
  },
];
