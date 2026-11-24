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
];
