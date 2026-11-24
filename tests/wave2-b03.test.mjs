// Wave 2, batch W2-B03: W2-S5-01, W2-S4-13, W2-S5-03, W2-S1-16.
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { SQUARE, CENTER, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const withTips = () => {
  window.__TEST_TIPS__ = true;
  localStorage.clear();
};

export const tests = [
  // ---------- W2-S5-01 ----------
  {
    name: 'W2-S5-01 Turn-1 Display Spring exposes turquoise pool under lower-rim ribbon, renders H8 spotlight halo + outer pre-dim, and removes coarse #boardwrap.coach-target inset border',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    initScript: withTips,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      await t.waitFrames(3);

      // 1) Coarse full-frame #boardwrap.coach-target inset border removed (while class semantics stay intact for S2-01)
      const coachStyle = await t.page.evaluate(() => {
        const bw = document.querySelector('#boardwrap');
        const cs = getComputedStyle(bw);
        const after = getComputedStyle(bw, '::after');
        return {
          hasClass: bw.classList.contains('coach-target'),
          outlineStyle: cs.outlineStyle,
          outlineWidth: parseFloat(cs.outlineWidth) || 0,
          animName: cs.animationName,
          afterContent: after.content,
          afterShadow: after.boxShadow,
        };
      });
      t.equal(coachStyle.hasClass, true, 'first-run coach still marks #boardwrap for S2-01 semantics');
      t.equal(coachStyle.outlineWidth, 0, '#boardwrap.coach-target carries no outer outline');
      t.equal(coachStyle.animName, 'none', '#boardwrap.coach-target does not pulse the whole board');
      t.expect(coachStyle.afterContent === 'none' || coachStyle.afterShadow === 'none', `coarse #boardwrap.coach-target::after inset border is removed (content=${coachStyle.afterContent}, shadow=${coachStyle.afterShadow})`);

      // 2) Turn-1 H8 spotlight halo + exposed luminous turquoise pool + lower-rim START ribbon + outer-ring pre-dim
      const outerGlass = SQUARE.findIndex((k, i) => k === 'h' && i >= 30);
      const sampleTurn1 = () => t.page.evaluate(async ({ cIdx, oIdx }) => {
        const cv = document.getElementById('board'), ctx = cv.getContext('2d');
        const k = cv.width / cv.clientWidth;
        const [hx, hy] = await window.__game.act('cell', cIdx);
        const [hx2] = await window.__game.act('cell', cIdx + 1);
        const cell = Math.abs(hx2 - hx);
        // Sample ring just outside H8 (radius ~0.64 * cell) for spotlight brass/aqua halo pixels
        let haloBrass = 0, haloAqua = 0;
        for (let deg = 0; deg < 360; deg += 5) {
          const rad = (deg * Math.PI) / 180;
          for (const mult of [0.54, 0.64]) {
            const px = Math.round((hx + Math.cos(rad) * cell * mult) * k);
            const py = Math.round((hy + Math.sin(rad) * cell * mult) * k);
            const p = ctx.getImageData(px, py, 1, 1).data;
            if (p[0] > 210 && p[1] > 185 && p[2] < 165) haloBrass++;
            if (p[1] > p[0] + 20 && p[2] > p[0] + 15 && p[1] > 150) haloAqua++;
          }
        }
        // Sample center of H8 pool (slightly above lower ribbon) to verify turquoise pool is exposed
        const pool = ctx.getImageData(Math.round((hx - 0.16 * cell) * k), Math.round((hy - 0.14 * cell) * k), Math.max(4, Math.round(0.32 * cell * k)), Math.max(4, Math.round(0.22 * cell * k))).data;
        let teal = 0, poolN = 0;
        for (let j = 0; j < pool.length; j += 4) { poolN++; if (pool[j + 1] > pool[j] + 15 && pool[j + 2] > pool[j] + 10) teal++; }
        // Sample outer Hot square corner luminance to measure Turn-1 0.12 pre-dim
        const [ox, oy] = await window.__game.act('cell', oIdx);
        const r = Math.max(2, Math.round(0.07 * cell * k));
        const od = ctx.getImageData(Math.round((ox - 0.36 * cell) * k) - r, Math.round((oy - 0.36 * cell) * k) - r, 2 * r, 2 * r).data;
        let lum = 0, n = 0;
        for (let j = 0; j < od.length; j += 4) { lum += (od[j] + od[j + 1] + od[j + 2]) / 3; n++; }
        return { haloBrass, haloAqua, tealRatio: teal / poolN, outerLum: lum / n };
      }, { cIdx: CENTER, oIdx: outerGlass });

      const onTurn1 = await sampleTurn1();
      t.expect(onTurn1.tealRatio > 0.4, `Display Spring turquoise pool exposed above lower ribbon (${(onTurn1.tealRatio * 100).toFixed(1)}%)`);
      t.expect(onTurn1.haloBrass >= 20, `concentric brass spotlight halo rendered around H8 (${onTurn1.haloBrass} samples)`);
      t.expect(onTurn1.haloAqua >= 12, `concentric aqua spotlight ring rendered around H8 (${onTurn1.haloAqua} samples)`);
      await t.shot('W2-S5-01-turn1-spotlight');

      // Stage a tile on CENTER: spotlight halo & Turn-1 pre-dim both lift cleanly
      const rack0 = (await t.state()).game.players[0].rack.find((l) => l !== '?') || 'E';
      await t.game('act', 'stage', [{ i: CENTER, l: rack0 }]);
      await t.waitFrames(3);
      const afterStage = await sampleTurn1();
      t.expect(afterStage.haloBrass < onTurn1.haloBrass * 0.4, `spotlight halo clears once tile staged on CENTER (${onTurn1.haloBrass} -> ${afterStage.haloBrass})`);
      t.expect(onTurn1.outerLum < afterStage.outerLum * 0.94, `Turn-1 ~0.12 pre-dim darkened outer DIMMABLE square before staging (${onTurn1.outerLum.toFixed(1)} vs ${afterStage.outerLum.toFixed(1)})`);
      await t.game('act', 'recall');

      // CD-WF2-03: verify CSS contains no #boardwrap.coach-target::after rule
      const css = fs.readFileSync(path.join(root, 'src/styles/main.css'), 'utf8');
      t.expect(!/#boardwrap\.coach-target::after/.test(css), 'src/styles/main.css removes #boardwrap.coach-target::after');
    },
  },
  {
    name: 'W2-S5-01 3D Turn-1 pre-dim mesh sits beneath tiles and turns off once CENTER is staged or covered',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(6000);
      const b3Start = await t.game('act', 'b3');
      if (!b3Start || !b3Start.on) { t.log('software GL fallback (2D mode): skipping 3D preDim check'); return; }
      t.equal(b3Start.preDim, true, '3D Turn-1 pre-dim mesh is visible while CENTER is open');
      const rack0 = (await t.state()).game.players[0].rack.find((l) => l !== '?') || 'E';
      await t.game('act', 'stage', [{ i: CENTER, l: rack0 }]);
      await t.waitFrames(2);
      const b3Staged = await t.game('act', 'b3');
      t.equal(b3Staged.preDim, false, '3D Turn-1 pre-dim mesh hides once a tile is staged on CENTER');
      await t.game('act', 'recall');
      await t.waitFrames(2);
      t.equal((await t.game('act', 'b3')).preDim, true, '3D Turn-1 pre-dim returns if CENTER is uncovered again');
    },
  },
  {
    name: 'W2-S5-01 reduced motion keeps Turn-1 H8 spotlight halo static and clean',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    reducedMotion: true,
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3 });
      await t.waitIdle(6000);
      await t.waitFrames(3);
      const brass = await t.page.evaluate(async (cIdx) => {
        const cv = document.getElementById('board'), ctx = cv.getContext('2d');
        const k = cv.width / cv.clientWidth;
        const [hx, hy] = await window.__game.act('cell', cIdx);
        const [hx2] = await window.__game.act('cell', cIdx + 1);
        const cell = Math.abs(hx2 - hx);
        let hits = 0;
        for (let deg = 0; deg < 360; deg += 5) {
          const rad = (deg * Math.PI) / 180;
          const p = ctx.getImageData(Math.round((hx + Math.cos(rad) * cell * 0.64) * k), Math.round((hy + Math.sin(rad) * cell * 0.64) * k), 1, 1).data;
          if (p[0] > 210 && p[1] > 185 && p[2] < 165) hits++;
        }
        return hits;
      }, CENTER);
      t.expect(brass >= 20, `reduced-motion spotlight halo still renders cleanly around H8 (${brass} brass samples)`);
    },
  },
  // ---------- W2-S4-13 ----------
  {
    name: 'W2-S4-13 inline #log chips, Pause Steam Ledger chips, and tapping placed Hot Springs board words all open sourced history cards',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.game('act', 'play');
      await t.waitIdle(10000);

      // 1) Inline #log renders STEAM as clickable <button class="themed-link" data-fact="steam" data-form="STEAM">
      const inlineChip = await t.page.evaluate(() => {
        const b = document.querySelector('#log button.themed-link[data-fact="steam"][data-form="STEAM"]');
        const r = b ? b.getBoundingClientRect() : null;
        return { found: !!b, h: r ? r.height : 0, text: b ? b.textContent.trim() : '' };
      });
      t.equal(inlineChip.found, true, 'inline #log renders STEAM as <button class="themed-link" data-fact="steam" data-form="STEAM">');
      if (t.viewport === 'mobile') t.expect(inlineChip.h >= 44, `mobile inline .themed-link touch height >= 44 px (${inlineChip.h.toFixed(1)} px)`);
      const cDay = await t.contrastReport({ selector: '#ledger', min: 4.5, largeMin: 3 });
      t.equal(cDay.fails.length, 0, 'inline #ledger .themed-link passes Day WCAG contrast (' + JSON.stringify(cDay.fails) + ')');

      await t.page.click('#log button.themed-link[data-fact="steam"]');
      t.equal((await t.state()).dialog, 'fact', 'clicking inline #log .themed-link opens fact card');
      t.expect(/Valley of Vapors/.test(await t.page.textContent('#modal')) && /Source:/.test(await t.page.textContent('#modal')), 'fact card displays sourced STEAM history');
      await t.shot('W2-S4-13-ledger-fact');
      await t.game('act', 'close');

      // 2) Pause -> Steam ledger modal renders clickable .themed-link chip opening the fact card
      await t.game('act', 'open', 'pause');
      await t.page.click('#modal [data-open="ledger"]');
      const dlgChip = await t.page.evaluate(() => {
        const b = document.querySelector('#modal .ledger-dlg button.themed-link[data-fact="steam"][data-form="STEAM"]');
        return { found: !!b, h: b ? b.getBoundingClientRect().height : 0 };
      });
      t.equal(dlgChip.found, true, 'Pause Steam Ledger renders STEAM as clickable .themed-link button');
      t.expect(dlgChip.h >= 44, `Pause Steam Ledger .themed-link height >= 44 px (${dlgChip.h.toFixed(1)} px)`);
      await t.page.click('#modal .ledger-dlg button.themed-link[data-fact="steam"]');
      t.equal((await t.state()).dialog, 'fact', 'clicking Pause Steam Ledger .themed-link opens fact card');
      t.expect(/Valley of Vapors/.test(await t.page.textContent('#modal')), 'Pause Steam Ledger opens STEAM fact card');
      await t.game('act', 'close');

      // 3) Tapping an already-placed Hot Springs word on the board (with nothing selected/staged) opens its history card
      const pt = await t.game('act', 'screen', CENTER);
      if (t.viewport === 'mobile') await t.tap(pt); else await t.page.mouse.click(pt[0], pt[1]);
      t.equal((await t.state()).dialog, 'fact', 'tapping placed STEAM on the board opens its fact card');
      t.expect(/Valley of Vapors/.test(await t.page.textContent('#modal')), 'board tap opened the STEAM fact card');
      await t.game('act', 'close');

      // 4) When a tile IS staged, tapping a placed Hot Springs word does NOT hijack staging with a fact card
      const freeCell = CENTER + N;
      const st2 = await t.state();
      const spare = st2.game.players[0].rack.find((l) => l !== '?') || 'E';
      if (!st2.game.board[freeCell]) {
        await t.game('act', 'stage', [{ i: freeCell, l: spare }]);
        if (t.viewport === 'mobile') await t.tap(pt); else await t.page.mouse.click(pt[0], pt[1]);
        t.equal((await t.state()).dialog, null, 'tapping placed Hot Springs word while tiles are staged does not open a modal');
        await t.game('act', 'recall');
      }

      // 5) Night-mode contrast check on inline #ledger .themed-link
      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'game');
      const cNight = await t.contrastReport({ selector: '#ledger', min: 4.5, largeMin: 3 });
      t.equal(cNight.fails.length, 0, 'inline #ledger .themed-link passes Night WCAG contrast (' + JSON.stringify(cNight.fails) + ')');
    },
  },
  // ---------- W2-S5-03 ----------
  {
    name: 'W2-S5-03 Bathhouse Register crowns all 6 categories with bundled card-<cat>.webp banners + progress bars, safe non-spoiler metadata & tap nudge on locked slots',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => localStorage.setItem('hs-letters-register-v1', JSON.stringify({
        SPRING: { id: 'spring', first: '2026-11-20', count: 1, best: 24 },
        STEAM: { id: 'steam', first: '2026-11-20', count: 1, best: 28 },
      })));
      await t.reload(); await ready(t);
      await t.game('scene', 'register');

      const reg = await t.page.evaluate(() => {
        const cats = [...document.querySelectorAll('.reg-cat')].map((sec) => {
          const banner = sec.querySelector('.reg-banner');
          const bar = sec.querySelector('.reg-progress[role="progressbar"]');
          return {
            cat: sec.dataset.regCat,
            bg: banner ? getComputedStyle(banner).backgroundImage : '',
            bannerH: banner ? banner.getBoundingClientRect().height : 0,
            barNow: bar ? Number(bar.getAttribute('aria-valuenow')) : -1,
            barMax: bar ? Number(bar.getAttribute('aria-valuemax')) : -1,
            h2: sec.querySelector('h2')?.textContent.trim() || '',
          };
        });
        const locked = [...document.querySelectorAll('.reg-lock[data-reg-locked]')];
        const sample = locked.slice(0, 6).map((b) => ({
          id: b.dataset.regLocked,
          len: b.dataset.len,
          tier: b.dataset.tier,
          h: b.getBoundingClientRect().height,
          text: b.textContent.trim(),
        }));
        return { cats, lockedCount: locked.length, sample };
      });

      t.equal(reg.cats.length, 6, 'all 6 Register categories rendered');
      for (const c of reg.cats) {
        t.expect(c.bg.includes('card-' + c.cat) || c.bg.includes('data:image/webp'), `${c.cat}: uses bundled card-${c.cat}.webp banner (${c.bg.slice(0, 60)})`);
        t.expect(c.bannerH >= 48, `${c.cat}: banner height >= 48 px (${c.bannerH})`);
        t.expect(c.barMax > 0 && c.barNow >= 0, `${c.cat}: progress bar present (${c.barNow}/${c.barMax})`);
      }
      t.expect(reg.lockedCount === 105, `105 locked slots rendered as interactive .reg-lock buttons (got ${reg.lockedCount})`);
      for (const s of reg.sample) {
        t.expect(s.h >= 44, `locked slot ${s.id} touch height >= 44 px (${s.h.toFixed(1)} px)`);
        t.expect(s.text.includes(`${s.len} letters`) && s.text.includes(`+${s.tier}`), `locked slot ${s.id} shows safe length & tier metadata (${s.text})`);
      }

      // Tap a locked slot: displays non-spoiler category/length/tier nudge without revealing any historical fact text
      await t.page.click('.reg-lock[data-reg-locked]');
      const nudgeText = await t.page.textContent('.reg-nudge');
      t.expect(/Not found yet: \d+-letter .+ \(\+\d+ Hot Springs bonus\)/.test(nudgeText), `locked slot tap shows clean non-spoiler nudge (${nudgeText})`);
      t.expect(!/Source:/.test(nudgeText), 'nudge contains zero fact spoilers (CD-WF0-06 / OQ-WF1-02)');

      // Day & Night contrast checks
      const cDay = await t.contrastReport({ selector: '.register', min: 4.5, largeMin: 3 });
      t.equal(cDay.fails.length, 0, 'Register passes Day WCAG contrast (' + JSON.stringify(cDay.fails) + ')');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W2-S5-03-register-day');

      await t.game('scene', 'settings');
      await t.page.click('[data-set="theme"][data-val="dark"]');
      await t.game('scene', 'register');
      await t.page.click('.reg-lock[data-reg-locked]');
      const cNight = await t.contrastReport({ selector: '.register', min: 4.5, largeMin: 3 });
      t.equal(cNight.fails.length, 0, 'Register passes Night WCAG contrast (' + JSON.stringify(cNight.fails) + ')');
      if (t.viewport === 'desktop') await t.shot('W2-S5-03-register-night');
    },
  },
  {
    name: 'W2-S5-03 Featured plaques show compact short category labels and #fx emits rising gold/steam wisp arc on themed/Bathhouse Row play (silent under reduced motion)',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
      }
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');

      // 1) Featured plaques show short category labels (Row / Springs / Park / Track / Club / Town)
      const labels = await t.page.evaluate(() => [...document.querySelectorAll('#springs .pcat-name')].map((el) => el.textContent.trim()));
      const valid = new Set(['Row', 'Springs', 'Park', 'Track', 'Club', 'Town']);
      t.expect(labels.length >= 1 && labels.every((x) => valid.has(x)), `Featured plaques carry compact short category labels (${labels.join(', ')})`);

      // 2) Play a Hot Springs word matching plaque 0's category -> rising gold/steam wisp arc fires on #fx
      const s = await t.state();
      s.game.featured[0] = { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null };
      s.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s.game });
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.game('act', 'play');
      const afterThemed = await t.state();
      t.expect(afterThemed.arcLog.length >= 1 && afterThemed.arcLog.some((a) => a.plaque === 0 && a.reason === 'themed'), `same-category themed play emitted #fx wisp arc toward plaque 0 (${JSON.stringify(afterThemed.arcLog)})`);
      t.expect(afterThemed.arcs >= 1, `active #fx wisp arc animating (${afterThemed.arcs})`);

      // 3) Under reduced motion, no animated wisp arcs fire
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"][data-val="reduce"]');
      await t.game('newGame', { seed: 4, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');
      const sr = await t.state();
      sr.game.featured[0] = { id: 'mineral', word: 'MINERAL', cat: 'springs', shown: [0], by: null, at: null };
      sr.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: sr.game });
      await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.game('act', 'play');
      const afterRed = await t.state();
      t.equal(afterRed.arcs, 0, 'reduced motion emits zero animated #fx wisp arcs');
      t.equal(afterRed.arcLog.length, 0, 'reduced motion logs zero animated wisp arcs');
    },
  },
  // ---------- W2-S1-16 ----------
  {
    name: 'W2-S1-16 outer terrazzo border inlays brass promenade markers outside all 8 Bathhouse Row landmarks (zero interior marble lines), octagonal bezels + +20 pips, and #fx sightline on Row cover',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    initScript: () => {
      window.__TEST_TIPS__ = false;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
      }
    },
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'Player 2' }] });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');

      // 1) Inspect the 2048 px painted board texture directly: brass promenade markers on outer terrazzo aligned to all 8 Bathhouse Row landmarks,
      //    dark-espresso/gold octagonal bezels + bottom-right '+20' pips on each Row square, and calm un-lined interior neutral marble (CD-WF2-03).
      const boardAudit = await t.page.evaluate(async () => {
        const base = (f) => new URL('src/js/' + f, location.href).href;
        const R = await import(base('render2d.js'));
        const { BATHHOUSES, ROWS } = await import(base('layout.js'));
        const size = 2048, cell = size / R.U, f = R.FRAME * cell, band = f * 0.78;
        const outerR = band * 0.18, innerR = f - cell * 0.06;
        const mid = (outerR + innerR) / 2, halfB = (innerR - outerR) * 0.34;
        const cv = R.paintBoard(size, 'light'), ctx = cv.getContext('2d');
        const brassInBand = (x, y, rx, ry) => {
          const d = ctx.getImageData(Math.round(x - rx), Math.round(y - ry), Math.max(2, Math.round(rx * 2)), Math.max(2, Math.round(ry * 2))).data;
          let brass = 0;
          for (let j = 0; j < d.length; j += 4) if (d[j] > 180 && d[j + 1] > 140 && d[j + 2] < 115) brass++;
          return brass;
        };
        // Control spot on empty outer terrazzo border (Top col 2: no Bathhouse Row landmark aligned here)
        const controlBrass = brassInBand(f + 2.5 * cell, mid, cell * 0.10, halfB * 0.75);
        const markers = [];
        for (const [k, name] of Object.entries(BATHHOUSES)) {
          const i = Number(k), r = Math.floor(i / 15), c = i % 15;
          let mx, my, horiz;
          if (r <= 1) { mx = f + (c + 0.5) * cell; my = mid; horiz = true; }
          else if (r >= 13) { mx = f + (c + 0.5) * cell; my = size - mid; horiz = true; }
          else if (c <= 1) { mx = mid; my = f + (r + 0.5) * cell; horiz = false; }
          else { mx = size - mid; my = f + (r + 0.5) * cell; horiz = false; }
          const borderBrass = brassInBand(mx, my, horiz ? cell * 0.10 : halfB * 0.75, horiz ? halfB * 0.75 : cell * 0.10);
          // Interior of bottom-right '+20' pip (strictly inside its gold border stroke so removing '+20' drops goldText to 0)
          const gap = Math.max(1, cell * 0.035), w = cell - gap;
          const sx = f + c * cell + gap / 2, sy = f + r * cell + gap / 2;
          const pw = w * 0.48, ph = w * 0.28, px = sx + w * 0.49, py = sy + w * 0.69;
          const pip = ctx.getImageData(Math.round(px + pw * 0.12), Math.round(py + ph * 0.22), Math.max(4, Math.round(pw * 0.76)), Math.max(4, Math.round(ph * 0.56))).data;
          let darkPip = 0, goldText = 0;
          for (let j = 0; j < pip.length; j += 4) {
            if (pip[j] < 50 && pip[j + 1] < 45 && pip[j + 2] < 40) darkPip++;
            if (pip[j] > 200 && pip[j + 1] > 170 && pip[j + 2] < 160) goldText++;
          }
          markers.push({ name, borderBrass, darkPip, goldText });
        }
        // Calm neutral interior marble check (CD-WF2-03): sample an empty neutral square (e.g. row 2 col 2) for zero dark-brass lines
        let neutralIdx = -1;
        for (let r = 2; r < 13 && neutralIdx < 0; r++) {
          for (let c = 2; c < 13 && neutralIdx < 0; c++) {
            if (ROWS[r][c] === '.') neutralIdx = r * 15 + c;
          }
        }
        const nr = Math.floor(neutralIdx / 15), nc = neutralIdx % 15;
        const nd = ctx.getImageData(Math.round(f + (nc + 0.15) * cell), Math.round(f + (nr + 0.15) * cell), Math.round(cell * 0.7), Math.round(cell * 0.7)).data;
        let neutralGold = 0;
        for (let j = 0; j < nd.length; j += 4) if (nd[j] > 180 && nd[j + 1] > 140 && nd[j + 2] < 95) neutralGold++;
        return { controlBrass, markers, neutralGold };
      });

      t.equal(boardAudit.markers.length, 8, 'all 8 Bathhouse Row landmarks audited');
      for (const m of boardAudit.markers) {
        t.expect(m.borderBrass >= boardAudit.controlBrass + 60, `${m.name}: inlaid brass promenade marker rises sharply above empty terrazzo control (${m.borderBrass} vs control ${boardAudit.controlBrass})`);
        t.expect(m.darkPip >= 120 && m.goldText >= 35, `${m.name}: dark-espresso '+20' pip interior renders crisp gold '+20' numerals (${m.darkPip} dark, ${m.goldText} gold text px)`);
      }
      t.equal(boardAudit.neutralGold, 0, 'interior neutral marble square stays completely free of brass pinwheel lines (CD-WF2-03)');

      // 2) Covering a Bathhouse Row square emits a rising gold/steam-pulse sightline on #fx toward Featured Springs
      const s = await t.state();
      // Place anchor tile adjacent to Superior Bathhouse (cell 8: row 0, col 8) so we can cover cell 8 legally with SPA
      s.game.board[7] = { l: 'S', blank: false, p: 1, t: 0 };
      s.game.players[0].rack = 'PAEEEEE'.split('');
      await t.game('setState', { game: s.game });
      await t.game('act', 'stage', [{ i: 8, l: 'P' }, { i: 9, l: 'A' }]);
      await t.game('act', 'play');
      const afterRow = await t.state();
      t.expect(afterRow.arcLog.some((a) => a.from === 8 && a.reason === 'row'), `covering Superior Bathhouse (cell 8) emitted #fx sightline arc (${JSON.stringify(afterRow.arcLog)})`);
      await t.shot('W2-S1-16-promenade-and-bezels');
    },
  },
];
