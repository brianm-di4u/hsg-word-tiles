// Accessibility: text contrast by day and by night on every screen, a live region that announces plays,
// reduced motion, text size, surface-calibrated focus rings, claimed plaque contrast, and cursor dual halo.
import { SQUARE, N, CENTER } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

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

async function sweep(t, label) {
  let fails = 0;
  for (const scene of ['title', 'setup', 'help', 'settings', 'register', 'about', 'game']) {
    if (scene === 'game') { await t.game('newGame', { seed: 2 }); await t.waitIdle(5000); }
    else await t.game('scene', scene);
    const r = await t.contrastReport({ fallbackBg: [46, 28, 16] });
    for (const f of r.fails) { fails++; t.log(`${label} ${scene}: ${f}`); }
  }
  return fails;
}

export const tests = [
  {
    name: 'contrast by day',
    colorScheme: 'light',
    async run(t) {
      await ready(t);
      t.equal(await sweep(t, 'day'), 0, 'no contrast failures by day');
    },
  },
  {
    name: 'contrast by night',
    colorScheme: 'dark',
    async run(t) {
      await ready(t);
      t.equal(await sweep(t, 'night'), 0, 'no contrast failures by night');
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      await t.shot('16-night');
      await t.game('scene', 'title');
      await t.shot('16-night-title');
    },
  },
  {
    name: 'live region announces each play',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      await t.page.waitForFunction(() => /You played/.test(document.querySelector('#live').textContent), null, { timeout: 3000 });
      await t.waitIdle(10000);
      await t.page.waitForFunction(() => /Hollis Crane (played|swapped|passed)/.test(document.querySelector('#live').textContent), null, { timeout: 5000 });
      t.log(await t.page.textContent('#live'));
    },
  },
  {
    name: 'reduced motion: no flying tiles, feedback still shown',
    browsers: ['chromium', 'firefox', 'webkit'],
    reducedMotion: true,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      const anim = await t.page.evaluate(() => window.__G.anim.size);
      t.equal(anim, 0, 'no tile animation');
      await t.waitIdle(10000);
      t.expect(/played/.test(await t.page.textContent('#preview')), 'the play is still reported');
    },
  },
  {
    name: 'text size 130% keeps the layout',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => { const s = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}'); s.text = 1.3; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(s)); });
      await t.reload(); await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      await t.checkLayout();
      await t.shot('16-text130');
    },
  },
  {
    name: 'W5-S5-02 claimed Featured Springs plaques pass >= 5.5:1 across all gradient stops in Day and Night',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const s = await t.state();
      s.game.featured[0].by = 0;
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);
      const checkTheme = async (label) => {
        const info = await t.page.evaluate(() => {
          const el = document.querySelector('.plaque.claimed');
          const pby = el && el.querySelector('.pby');
          const cs = el && getComputedStyle(el);
          const bg = cs ? cs.backgroundImage : '';
          const stops = (bg.match(/rgba?\([^)]+\)/g) || []);
          return {
            found: !!el,
            color: cs && cs.color,
            pbyColor: pby && getComputedStyle(pby).display !== 'none' ? getComputedStyle(pby).color : null,
            stops,
          };
        });
        t.expect(info.found, `${label}: claimed plaque rendered`);
        t.expect(info.stops.length >= 2, `${label}: claimed plaque has gradient stops (${info.stops.length})`);
        const fg = parseRgb(info.color);
        t.expect(!!fg, `${label}: parsed claimed plaque foreground`);
        for (const st of info.stops) {
          const bg = parseRgb(st);
          const ratio = contrast(fg, bg);
          t.expect(ratio >= 5.5, `${label}: claimed plaque color ${info.color} vs stop ${st} = ${ratio.toFixed(2)} (need >= 5.5)`);
          if (info.pbyColor) {
            const r2 = contrast(parseRgb(info.pbyColor), bg);
            t.expect(r2 >= 5.5, `${label}: claimed .pby color ${info.pbyColor} vs stop ${st} = ${r2.toFixed(2)} (need >= 5.5)`);
          }
        }
      };
      await checkTheme('day');
      if (t.viewport === 'desktop') await t.shot('16-claimed-day');
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      await t.waitIdle(5000);
      await checkTheme('night');
      if (t.viewport === 'desktop') await t.shot('16-claimed-night');
    },
  },
  {
    name: 'W5-S5-02 surface-calibrated :focus-visible rings meet >= 5:1 in Day and Night',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      const checkFocus = async (label, selector, surfaceBgs) => {
        await t.page.keyboard.press('Tab');
        const res = await t.page.evaluate((sel) => {
          const el = document.querySelector(sel);
          if (!el) return { found: false };
          el.focus();
          const cs = getComputedStyle(el);
          return {
            found: true,
            fv: el.matches(':focus-visible'),
            outlineStyle: cs.outlineStyle,
            outlineWidth: parseFloat(cs.outlineWidth),
            outlineColor: cs.outlineColor,
            boxShadow: cs.boxShadow,
          };
        }, selector);
        t.expect(res.found, `${label}: ${selector} exists`);
        t.expect(res.fv, `${label}: ${selector} matches :focus-visible`);
        t.expect(res.outlineStyle !== 'none' && res.outlineWidth >= 2.5, `${label}: outline visible (${res.outlineWidth}px ${res.outlineStyle})`);
        t.expect(res.boxShadow && res.boxShadow !== 'none', `${label}: dual-ring halo box-shadow present`);
        const oc = parseRgb(res.outlineColor);
        t.expect(!!oc, `${label}: parsed outlineColor ${res.outlineColor}`);
        for (const bgRgb of surfaceBgs) {
          const ratio = contrast(oc, bgRgb);
          t.expect(ratio >= 5.0, `${label}: outline ${res.outlineColor} vs surface rgb(${bgRgb.r},${bgRgb.g},${bgRgb.b}) = ${ratio.toFixed(2)} (need >= 5.0)`);
        }
      };
      const DAY_PAGE = [{ r: 74, g: 48, b: 32 }, { r: 46, g: 28, b: 16 }];
      const DAY_SURFACES = [{ r: 244, g: 240, b: 230 }, { r: 234, g: 226, b: 208 }, { r: 255, g: 253, b: 247 }];
      const NIGHT_SURFACES = [{ r: 31, g: 28, b: 46 }, { r: 41, g: 37, b: 60 }];
      await checkFocus('day title .btn', '.title .btn', DAY_PAGE);
      await t.game('scene', 'setup');
      await checkFocus('day setup .btn', '.sheet [data-start]', DAY_SURFACES);
      await checkFocus('day setup input', '.sheet input[data-name="0"]', DAY_SURFACES);
      await checkFocus('day setup .opp', '.sheet .opp[aria-checked="true"]', DAY_SURFACES);
      await checkFocus('day setup .check input', '.sheet [data-hints]', DAY_SURFACES);
      await t.shot('16-focus-day-setup');
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(5000);
      await checkFocus('day privacy reveal', '.privacy-card [data-reveal]', DAY_SURFACES);
      await t.game('act', 'reveal');
      await checkFocus('day #b-menu', '#b-menu', DAY_PAGE);
      await checkFocus('day .plaque', '.plaque', DAY_PAGE);
      await t.game('act', 'open', 'pause');
      await checkFocus('day pause .btn', '#modal .btn.primary', DAY_SURFACES);
      await t.game('act', 'open', 'swap');
      await checkFocus('day swap .stile', '#modal .stile', DAY_SURFACES);
      await t.game('act', 'close');
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'setup');
      await checkFocus('night setup .btn', '.sheet [data-start]', NIGHT_SURFACES);
      await t.game('scene', 'game');
      await t.game('act', 'open', 'pause');
      await checkFocus('night pause .btn', '#modal .btn.primary', NIGHT_SURFACES);
    },
  },
  {
    name: 'W5-S5-02 board keyboard cursor renders dark-espresso and bright-gold dual halo over Hot 3L',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const hotIdx = SQUARE.indexOf('h');
      t.expect(hotIdx >= 0, 'board has a Hot 3L square');
      const sampleHot = () => t.page.evaluate((idx) => {
        const cv = document.querySelector('#board');
        const ctx = cv.getContext('2d');
        const rect = cv.getBoundingClientRect();
        const dpr = cv.width / rect.width;
        const [sx, sy] = window.__game.act ? [0, 0] : [0, 0];
        // compute cell center from R.cellCenter via window.__game.act('cell', idx)
        return window.__game.act('cell', idx).then(([cx, cy]) => {
          const half = Math.max(8, Math.round((cv.width / 15.76) * 0.52));
          const x0 = Math.max(0, Math.round(cx * dpr) - half);
          const y0 = Math.max(0, Math.round(cy * dpr) - half);
          const w = Math.min(cv.width - x0, half * 2);
          const h = Math.min(cv.height - y0, half * 2);
          const d = ctx.getImageData(x0, y0, w, h).data;
          let darkPx = 0, goldPx = 0;
          for (let i = 0; i < d.length; i += 4) {
            const r = d[i], g = d[i + 1], b = d[i + 2];
            if (r < 45 && g < 35 && b < 25) darkPx++;
            if (r > 225 && g > 200 && b > 105 && b < 170) goldPx++;
          }
          return { darkPx, goldPx };
        });
      }, hotIdx);
      const before = await sampleHot();
      await t.page.focus('#board');
      const dr = Math.floor(hotIdx / N) - Math.floor(CENTER / N);
      const dc = (hotIdx % N) - (CENTER % N);
      for (let k = 0; k < Math.abs(dr); k++) await t.page.keyboard.press(dr < 0 ? 'ArrowUp' : 'ArrowDown');
      for (let k = 0; k < Math.abs(dc); k++) await t.page.keyboard.press(dc < 0 ? 'ArrowLeft' : 'ArrowRight');
      await t.waitFrames(3);
      const after = await sampleHot();
      t.expect(after.darkPx - before.darkPx >= 30, `dark-espresso cursor halo rendered on Hot 3L (delta ${after.darkPx - before.darkPx})`);
      t.expect(after.goldPx - before.goldPx >= 30, `bright-gold cursor ring rendered on Hot 3L (delta ${after.goldPx - before.goldPx})`);
      await t.shot('16-cursor-halo');
    },
  },
];
