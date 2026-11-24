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
  {
    name: 'W5-S5-03 #preview/#toast ARIA visibility and .bdbtn keyboard focus + aria-expanded',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(5000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);
      t.expect((await t.page.getAttribute('#preview', 'aria-hidden')) !== 'true', '#preview is not aria-hidden');
      t.equal(await t.page.getAttribute('#toast', 'aria-hidden'), 'true', '#toast starts aria-hidden=true when idle');
      // stage a legal play so .bdbtn appears in #preview
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      const bdInfo = await t.page.evaluate(() => {
        const b = document.querySelector('#preview .bdbtn:not([data-hintnext])');
        return b ? { tabIndex: b.tabIndex, attrTab: b.getAttribute('tabindex'), expanded: b.getAttribute('aria-expanded'), hiddenAnc: !!b.closest('[aria-hidden="true"]') } : null;
      });
      t.expect(!!bdInfo, '.bdbtn rendered');
      t.equal(bdInfo.tabIndex, 0, '.bdbtn is keyboard focusable (tabIndex 0)');
      t.equal(bdInfo.attrTab, null, '.bdbtn does not carry tabindex=-1');
      t.equal(bdInfo.expanded, 'false', '.bdbtn starts with aria-expanded=false');
      t.equal(bdInfo.hiddenAnc, false, '.bdbtn has no aria-hidden=true ancestor');
      // activate .bdbtn via keyboard Enter and verify aria-expanded flips and focus stays on .bdbtn
      await t.page.focus('#preview .bdbtn:not([data-hintnext])');
      await t.page.keyboard.press('Enter');
      const bdOpen = await t.page.evaluate(() => {
        const b = document.querySelector('#preview .bdbtn:not([data-hintnext])');
        return { expanded: b && b.getAttribute('aria-expanded'), panel: !!document.querySelector('#preview .bd'), focused: document.activeElement === b };
      });
      t.equal(bdOpen.expanded, 'true', '.bdbtn flips to aria-expanded=true on keyboard Enter');
      t.equal(bdOpen.panel, true, 'breakdown panel opened');
      t.equal(bdOpen.focused, true, 'focus stays on .bdbtn after toggling');
      // play STEAM to trigger a fact toast and verify #toast aria-hidden syncs with .on
      await t.game('act', 'play');
      await t.page.waitForSelector('#toast.on [data-fact]', { timeout: 3000 });
      const toastOn = await t.page.evaluate(() => {
        const el = document.querySelector('#toast');
        const btn = el.querySelector('[data-fact]');
        return { ariaHidden: el.getAttribute('aria-hidden'), hasOn: el.classList.contains('on'), hiddenAnc: !!btn.closest('[aria-hidden="true"]') };
      });
      t.equal(toastOn.hasOn, true, '#toast has .on');
      t.equal(toastOn.ariaHidden, 'false', '#toast sets aria-hidden=false while visible');
      t.equal(toastOn.hiddenAnc, false, '#toast [data-fact] is not trapped inside aria-hidden=true');
      await t.page.click('#toast [data-fact]');
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      const toastOff = await t.page.evaluate(() => {
        const el = document.querySelector('#toast');
        return { ariaHidden: el.getAttribute('aria-hidden'), btns: el.querySelectorAll('button').length };
      });
      t.equal(toastOff.ariaHidden, 'true', '#toast restores aria-hidden=true when closed');
      t.equal(toastOff.btns, 0, '#toast clears focusable buttons when closed');
      await t.game('act', 'close');
    },
  },
  {
    name: 'W5-S5-03 keyboard rack select->Enter stage, Alt+Arrow reorder, Space/flash liveSay, and +/-/0 zoom',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(5000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);
      // 1. Alt+ArrowRight / Alt+ArrowLeft on focused .rtile reorders the rack
      await t.page.focus('#rack .rtile[data-pos="0"]');
      const beforeOrder = (await t.state()).order.slice();
      await t.page.keyboard.press('Alt+ArrowRight');
      const afterRight = (await t.state()).order.slice();
      t.equal(afterRight[1], beforeOrder[0], 'Alt+ArrowRight moved first rack tile right');
      t.equal(afterRight[0], beforeOrder[1], 'second tile shifted left');
      t.equal(await t.page.evaluate(() => +document.activeElement.dataset.k), beforeOrder[0], 'focus stayed on moved tile');
      await t.page.waitForFunction(() => /moved to position 2 of 7/.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      await t.page.keyboard.press('Alt+ArrowLeft');
      const afterLeft = (await t.state()).order.slice();
      t.equal(afterLeft[0], beforeOrder[0], 'Alt+ArrowLeft moved tile back to slot 0');
      // 2. Keyboard select .rtile -> Enter on #board stages G.selected at G.cursor.i
      await t.page.keyboard.press('Enter');
      t.equal(await t.page.getAttribute(`#rack .rtile[data-k="${beforeOrder[0]}"]`, 'aria-pressed'), 'true', 'Enter on .rtile selects it (aria-pressed=true)');
      await t.page.focus('#board');
      await t.page.keyboard.press('Enter');
      let st = await t.state();
      t.equal(st.staged.length, 1, 'Enter on #board staged the selected tile');
      t.equal(st.staged[0].i, CENTER, 'staged at cursor square (CENTER)');
      t.equal(st.staged[0].l, 'S', 'staged the selected letter S');
      // 3. Space flips direction and speaks to #live
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => /Direction: down/.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => /Direction: across/.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      // 4. flash() errors speak to #live (typing a letter not on rack)
      await t.page.keyboard.press('z');
      await t.page.waitForFunction(() => /No Z on your rack/.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      // 5. + / - / 0 keyboard zoom on #board
      await t.page.keyboard.press('+');
      await t.waitIdle(3000);
      t.expect((await t.state()).view.zoom > 1.5, '+ zoomed in on #board');
      await t.page.waitForFunction(() => /Board zoomed to/.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
      const z1 = (await t.state()).view.zoom;
      await t.page.keyboard.press('=');
      await t.waitIdle(3000);
      t.expect((await t.state()).view.zoom > z1, '= stepped zoom further');
      await t.page.keyboard.press('-');
      await t.waitIdle(3000);
      t.expect((await t.state()).view.zoom < 2.0, '- zoomed back out a step');
      await t.page.keyboard.press('0');
      await t.waitIdle(3000);
      t.equal((await t.state()).view.zoom, 1, '0 reset zoom to whole board');
      await t.page.waitForFunction(() => /Whole board shown/.test(document.querySelector('#live').textContent), null, { timeout: 2000 });
    },
  },
  {
    name: 'W5-S4-05 reduced motion disables animations/transitions across all selectors and renders static ... on .thinking i',
    viewports: ['desktop', 'mobile'],
    reducedMotion: true,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      const checkSelectors = async (label) => {
        const res = await t.page.evaluate(() => {
          const prev = document.querySelector('#preview');
          const origPrevHtml = prev.innerHTML, origPrevCls = prev.className;
          prev.className = 'ai';
          prev.innerHTML = '<span class="thinking">Hollis Crane is thinking<i>.</i><i>.</i><i>.</i></span>';
          const dots = [...prev.querySelectorAll('.thinking i')].map((el) => {
            const cs = getComputedStyle(el);
            return { anim: cs.animationName, op: cs.opacity };
          });
          prev.className = 'shake';
          const shakeAnim = getComputedStyle(prev).animationName;
          prev.className = origPrevCls; prev.innerHTML = origPrevHtml;

          const rtile = document.querySelector('#rack .rtile');
          const rtileCs = getComputedStyle(rtile);
          rtile.classList.add('deal');
          const dealAnim = getComputedStyle(rtile).animationName;
          rtile.classList.remove('deal');

          const scoreEl = document.querySelector('[data-score]');
          scoreEl.classList.add('bump');
          const bumpAnim = getComputedStyle(scoreEl).animationName;
          scoreEl.classList.remove('bump');

          const pop = document.createElement('div');
          pop.className = 'pop themed';
          pop.textContent = '+24';
          document.querySelector('#boardwrap').append(pop);
          const popAnim = getComputedStyle(pop).animationName;
          pop.remove();

          return {
            hasReduce: document.body.classList.contains('reduce'),
            dots,
            shakeAnim,
            rtileTrans: rtileCs.transitionProperty === 'none' || rtileCs.transitionDuration === '0s',
            dealAnim,
            bumpAnim,
            popAnim,
          };
        });
        t.expect(res.dots.length === 3 && res.dots.every((d) => d.anim === 'none' && d.op === '1'), `${label}: .thinking i dots are static (opacity 1, no animation)`);
        t.equal(res.shakeAnim, 'none', `${label}: #preview.shake animation disabled`);
        t.equal(res.rtileTrans, true, `${label}: .rtile transition disabled`);
        t.equal(res.dealAnim, 'none', `${label}: .rtile.deal animation disabled`);
        t.equal(res.bumpAnim, 'none', `${label}: .score.bump animation disabled`);
        t.equal(res.popAnim, 'pop-fade', `${label}: .pop uses 0px opacity-only pop-fade instead of rising pop`);
      };

      // 1. OS prefers-reduced-motion: reduce (Motion: Auto)
      await checkSelectors('OS reduce');
      // 2. Verify @media (prefers-reduced-motion: reduce) works even if body.reduce is absent (first-paint fallback)
      await t.page.evaluate(() => document.body.classList.remove('reduce'));
      await checkSelectors('@media reduce fallback');
      await t.page.evaluate(() => document.body.classList.add('reduce'));
      // 3. Open Swap dialog and verify .stile[aria-pressed="true"] has no transition and no transform jump
      await t.game('act', 'open', 'swap');
      await t.page.click('#modal .stile[data-sw="0"]');
      const stileInfo = await t.page.evaluate(() => {
        const el = document.querySelector('#modal .stile[data-sw="0"]');
        const dlg = document.querySelector('#modal .dialog');
        const cs = getComputedStyle(el), dcs = getComputedStyle(dlg);
        return {
          pressed: el.getAttribute('aria-pressed'),
          transNone: cs.transitionProperty === 'none' || cs.transitionDuration === '0s',
          transform: cs.transform,
          dlgAnim: dcs.animationName,
        };
      });
      t.equal(stileInfo.pressed, 'true', 'swap tile toggled');
      t.equal(stileInfo.transNone, true, '.stile transition disabled under reduced motion');
      t.equal(stileInfo.transform, 'none', '.stile[aria-pressed="true"] transform suppressed under reduced motion');
      t.equal(stileInfo.dlgAnim, 'none', '.dialog animation disabled under reduced motion');
      await t.game('act', 'close');
      // 4. Explicit Settings -> Motion: Full overrides @media (prefers-reduced-motion: reduce)
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"][data-val="full"]');
      await t.game('scene', 'game');
      const fullState = await t.page.evaluate(() => ({
        reduce: document.body.classList.contains('reduce'),
        motionFull: document.body.classList.contains('motion-full'),
        rtileDur: getComputedStyle(document.querySelector('#rack .rtile')).transitionDuration,
      }));
      t.equal(fullState.reduce, false, 'Motion: Full clears body.reduce');
      t.equal(fullState.motionFull, true, 'Motion: Full sets body.motion-full');
      t.expect(fullState.rtileDur !== '0s', `Motion: Full restores .rtile transition (${fullState.rtileDur})`);
    },
  },
  {
    name: 'W5-S4-05 live OS prefers-reduced-motion toggle updates body.reduce and motion state without reload',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 2 });
      await t.waitIdle(5000);
      t.equal(await t.page.evaluate(() => document.body.classList.contains('reduce')), false, 'starts without body.reduce under no-preference');
      // Live OS toggle -> reduce (no reload)
      await t.page.emulateMedia({ reducedMotion: 'reduce' });
      await t.page.waitForFunction(() => document.body.classList.contains('reduce'), null, { timeout: 2000 });
      const liveReduced = await t.page.evaluate(() => ({
        reduce: document.body.classList.contains('reduce'),
        wisps: window.__game.getState().wisps.length,
        rtileDur: getComputedStyle(document.querySelector('#rack .rtile')).transitionDuration,
      }));
      t.equal(liveReduced.reduce, true, 'live OS toggle adds body.reduce without reload');
      t.equal(liveReduced.wisps, 0, 'live OS toggle clears ambient steam wisps immediately');
      t.equal(liveReduced.rtileDur, '0s', 'live OS toggle disables .rtile transition immediately');
      // Live OS toggle -> no-preference (no reload)
      await t.page.emulateMedia({ reducedMotion: 'no-preference' });
      await t.page.waitForFunction(() => !document.body.classList.contains('reduce'), null, { timeout: 2000 });
      t.equal(await t.page.evaluate(() => document.body.classList.contains('reduce')), false, 'live OS toggle back clears body.reduce without reload');
    },
  },
  {
    name: 'W5-S4-05 restrained non-vestibular highlights under reduced motion: 0px espresso-pill .pop fade, error border, score & plaque tints',
    viewports: ['desktop', 'mobile'],
    reducedMotion: true,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(5000);
      const s0 = await t.state();
      const featIdx = s0.game.featured.findIndex((f) => f.word.length <= 7);
      t.expect(featIdx >= 0, 'seed 3 has a <=7-letter Featured Spring');
      const featWord = s0.game.featured[featIdx].word;
      // 1. Error border highlight on invalid play (no shake motion)
      s0.game.players[0].rack = 'ZZZZZZZ'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(3000);
      await t.game('act', 'stage', [{ i: CENTER, l: 'Z' }, { i: CENTER + 1, l: 'Z' }]);
      await t.game('act', 'play');
      const errInfo = await t.page.evaluate(() => {
        const p = document.querySelector('#preview');
        const cs = getComputedStyle(p);
        return { hasErr: p.classList.contains('err-flash'), hasShake: p.classList.contains('shake'), anim: cs.animationName, shadow: cs.boxShadow, bg: cs.backgroundColor };
      });
      t.equal(errInfo.hasErr, true, '#preview gets .err-flash on invalid play under reduced motion');
      t.equal(errInfo.hasShake, false, '#preview does not get .shake under reduced motion');
      t.equal(errInfo.anim, 'none', '#preview error highlight has zero animation');
      t.expect(errInfo.shadow !== 'none' && /rgba?\(92,\s*22,\s*16/.test(errInfo.bg), `crimson error border highlight rendered (${errInfo.bg})`);
      if (t.viewport === 'desktop') await t.shot('16-reduced-err', { wait: false });
      await t.game('act', 'recall');

      // 2. 0px static espresso-pill .pop fade, updated-score tint, and updated-plaque tint on valid Featured Spring play
      const s1 = await t.state();
      s1.game.players[0].rack = (featWord + 'EEEEEEE').slice(0, 7).split('');
      await t.game('setState', { game: s1.game });
      await t.waitIdle(3000);
      const startCol = Math.max(0, 7 - Math.floor(featWord.length / 2));
      const tiles = [...featWord].map((l, k) => ({ i: 7 * N + startCol + k, l }));
      const playRes = await t.page.evaluate(async ({ tl, fIdx }) => {
        await window.__game.act('stage', tl);
        const r = await window.__game.act('play');
        const pop = document.querySelector('.pop');
        const score = document.querySelector('[data-score="0"]');
        const plaque = document.querySelector(`[data-plaque="${fIdx}"]`);
        let popCheck = null;
        if (pop) {
          const anim = pop.getAnimations()[0];
          const cs = getComputedStyle(pop);
          const dur = parseFloat(cs.animationDuration) * 1000;
          anim.pause();
          anim.currentTime = dur * 0.25;
          const b1 = pop.getBoundingClientRect(), op1 = parseFloat(getComputedStyle(pop).opacity);
          anim.currentTime = dur * 0.65;
          const b2 = pop.getBoundingClientRect(), op2 = parseFloat(getComputedStyle(pop).opacity);
          popCheck = {
            staticCls: pop.classList.contains('static'),
            animName: cs.animationName,
            bg: cs.backgroundColor,
            rise: pop.style.getPropertyValue('--rise'),
            dy: Math.abs(b2.top - b1.top),
            dx: Math.abs(b2.left - b1.left),
            dh: Math.abs(b2.height - b1.height),
            op1, op2,
          };
        }
        const scs = score && getComputedStyle(score);
        const pcs = plaque && getComputedStyle(plaque);
        return {
          ok: r.ok,
          popCheck,
          scoreUpdated: !!score && score.classList.contains('score-updated'),
          scoreAnim: scs && scs.animationName,
          scoreShadow: scs && scs.boxShadow,
          plaqueUpdated: !!plaque && plaque.classList.contains('plaque-updated'),
          plaqueAnim: pcs && pcs.animationName,
          plaqueShadow: pcs && pcs.boxShadow,
        };
      }, { tl: tiles, fIdx: featIdx });
      t.equal(playRes.ok, true, 'play succeeded');
      t.expect(!!playRes.popCheck && playRes.popCheck.staticCls, 'static espresso-pill .pop rendered');
      t.equal(playRes.popCheck.animName, 'pop-fade', '.pop uses opacity-only pop-fade');
      t.equal(playRes.popCheck.rise, '0%', '.pop rise is 0%');
      t.expect(/rgba?\(24,\s*16,\s*10/.test(playRes.popCheck.bg), `espresso-pill background applied (${playRes.popCheck.bg})`);
      t.expect(playRes.popCheck.dy <= 0.1 && playRes.popCheck.dx <= 0.1 && playRes.popCheck.dh <= 0.1, `0px movement across lifetime (dx=${playRes.popCheck.dx}, dy=${playRes.popCheck.dy}, dh=${playRes.popCheck.dh})`);
      t.expect(playRes.popCheck.op1 >= 0.9 && playRes.popCheck.op2 >= 0.9, `visible during plateau (op1=${playRes.popCheck.op1}, op2=${playRes.popCheck.op2})`);
      t.equal(playRes.scoreUpdated, true, 'updated score gets .score-updated tint');
      t.equal(playRes.scoreAnim, 'none', 'updated score has zero animation');
      t.expect(playRes.scoreShadow && playRes.scoreShadow !== 'none', 'updated score has visible brass border tint');
      t.equal(playRes.plaqueUpdated, true, 'claimed Featured Spring plaque gets .plaque-updated tint');
      t.equal(playRes.plaqueAnim, 'none', 'updated plaque has zero animation');
      t.expect(playRes.plaqueShadow && playRes.plaqueShadow !== 'none', 'updated plaque has visible highlight ring');
      if (t.viewport === 'desktop') await t.shot('16-reduced-pop-score', { wait: false });
    },
  },
];
