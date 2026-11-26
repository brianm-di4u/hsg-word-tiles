// Wave 4, batch W4-B08 (WF-2 discovery sightlines): W2-S1-18 (the brass inspect ring on an empty special square; the blank's sea glass
// was built by 050386d, tests: wave4-b01), W2-S3-14 (Bathhouse Row and the Display Spring on the zoomed minimap) and W2-S4-16 (what the
// Daily is and what a Hot Springs word pays, on Turn 1; the kinds on the strip and the plaques' names were built by fe9ce1b and cfbabc1).
import { ctx } from './lib.mjs';
import { createGame } from '../src/js/engine.js';
import { todaysSprings } from '../src/js/ui.js';
import { SQUARE, BATHHOUSES, CENTER } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
};
const TWO = { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] };
const WARM = 62, PLAIN = 63;   // row 4: an empty Warm spring and the plain square beside it
async function table(t) {
  await t.game('newGame', TWO);
  await t.waitIdle(8000);
  await t.game('act', 'reveal');
  await t.waitIdle(8000);
  await t.waitFrames(3);
}
// the board canvas around square i, against a copy taken by snap(): how many pixels of the ring band changed, and how many of those
// are brass; and how many changed outside the band (in the square's own box)
const snap = (t, i) => t.page.evaluate(async (i) => {
  const [cx, cy] = await window.__game.act('cell', i), [nx] = await window.__game.act('cell', i + 1);
  const cv = document.querySelector('#board'), k = cv.width / cv.getBoundingClientRect().width, cell = (nx - cx) * k;
  const x0 = Math.round(cx * k - cell * 0.6), y0 = Math.round(cy * k - cell * 0.6), w = Math.round(cell * 1.2);
  window.__b08 = { i, x0, y0, w, cell, cx: cx * k, cy: cy * k, d: cv.getContext('2d').getImageData(x0, y0, w, w).data };
}, i);
const ring = (t) => t.page.evaluate(() => {
  const b = window.__b08, cv = document.querySelector('#board'), d = cv.getContext('2d').getImageData(b.x0, b.y0, b.w, b.w).data;
  let band = 0, brass = 0, out = 0;
  for (let y = 0; y < b.w; y++) for (let x = 0; x < b.w; x++) {
    const p = (y * b.w + x) * 4, diff = Math.abs(d[p] - b.d[p]) + Math.abs(d[p + 1] - b.d[p + 1]) + Math.abs(d[p + 2] - b.d[p + 2]) + Math.abs(d[p + 3] - b.d[p + 3]);
    if (diff < 60) continue;
    const r = Math.hypot(b.x0 + x - b.cx, b.y0 + y - b.cy) / b.cell;
    if (r >= 0.3 && r <= 0.56) { band++; if (d[p + 3] > 180 && d[p] > 170 && d[p + 1] > 130 && d[p + 2] < 130 && d[p] - d[p + 2] > 80) brass++; } else if (r < 0.3) out++;
  }
  return { band, brass, out, cell: b.cell };
});

export const tests = [
  // ---------- W2-S1-18 ----------
  {
    name: 'W2-S1-18 an empty special square whose rule the strip shows wears a thin brass ring on the board: under the mouse, and after a tap on a touch screen while its tip shows',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      t.equal(SQUARE[WARM] + SQUARE[PLAIN], 'w.', 'a Warm spring with a plain square beside it');
      await table(t);
      const mode3d = (await t.state()).view.mode3d;
      await snap(t, WARM);
      const pt = (i) => t.game('act', 'screen', i);
      if (t.viewport === 'desktop') {
        const [x, y] = await pt(WARM);
        await t.page.mouse.move(x, y);
        await t.page.waitForFunction(() => /Warm spring/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
        await t.waitFrames(3);
        const on = await ring(t);
        t.expect(on.band > on.cell * 2 && on.brass > on.cell, `${mode3d ? '3D' : '2D'}: a brass ring round the Warm spring (${on.band} px changed in the ring's band, ${on.brass} brass; a square is ${on.cell.toFixed(1)} px)`);
        t.expect(on.out < on.cell * 0.5, `and the square's own middle is left alone (${on.out} px)`);
        await t.shot('w4-b08-inspect-ring');
        const [px, py] = await pt(PLAIN);
        await t.page.mouse.move(px, py);
        await t.waitFrames(3);
        t.expect((await ring(t)).band < on.cell * 0.5, 'gone when the mouse moves to a plain square');
        await snap(t, PLAIN);
        await t.waitFrames(2);
        t.expect((await ring(t)).band < on.cell * 0.5, 'and a plain square, which has no rule to show, gets none');
        await t.page.mouse.move(x, y);
        await t.waitFrames(3);
        await t.page.mouse.move(5, 5);
        await t.waitFrames(3);
        await snap(t, WARM);
        await t.page.mouse.move(x, y);
        await t.waitFrames(3);
        t.expect((await ring(t)).band > on.cell * 2, 'back on the Warm spring');
        await t.page.mouse.move(5, 5);
        await t.waitFrames(3);
        t.expect((await ring(t)).band < on.cell * 0.5, 'and gone when the mouse leaves the board');
        return;
      }
      await t.tap(await pt(WARM));
      const t0 = Date.now();
      await t.page.waitForFunction(() => /Warm spring/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
      await t.shot('w4-b08-inspect-ring');
      // the board takes focus from the touch and draws the keyboard cursor's box on the square (seen before this batch, W4-B07's
      // notes); blurring it leaves the ring alone to measure
      await t.page.evaluate(() => document.activeElement && document.activeElement.blur());
      await t.waitFrames(3);
      const on = await ring(t);
      t.expect(on.band > on.cell * 2 && on.brass > on.cell, `${mode3d ? '3D' : '2D'}: a tapped Warm spring wears the ring (${on.band} px changed in the band, ${on.brass} brass; a square is ${on.cell.toFixed(1)} px)`);
      t.expect(on.out < on.cell * 0.5, `and the square's own middle is left alone (${on.out} px)`);
      // it goes when the tip does (3.6 s)
      await t.page.waitForFunction(() => !/Warm spring/.test(document.querySelector('#preview').textContent), null, { timeout: 7000 });
      await t.waitFrames(3);
      const gone = Date.now() - t0;
      t.expect(gone > 2500, `the ring stays while the tip shows (${gone} ms)`);
      t.expect((await ring(t)).band < on.cell * 0.5, 'and is gone with the tip');
    },
  },
  // ---------- W2-S3-14 ----------
  {
    name: 'W2-S3-14 the zoomed minimap shows each open Bathhouse Row square as a brass stud and the open Display Spring as a teal beacon; a covered one shows its tile',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await table(t);
      await t.game('act', 'zoom', 1.7, 4, 4);
      await t.waitFrames(4);
      const mm = await t.game('act', 'minimap');
      t.expect(mm.on, 'the minimap is up');
      const px = (cells) => t.page.evaluate(([cells, b]) => {
        const cv = document.querySelector('#board'), k = cv.width / cv.getBoundingClientRect().width, c = b.S / 15, g = cv.getContext('2d');
        return cells.map((i) => [...g.getImageData(Math.floor((b.x0 + (i % 15 + 0.5) * c) * k), Math.floor((b.y0 + (Math.floor(i / 15) + 0.5) * c) * k), 1, 1).data]);
      }, [cells, mm.box]);
      const rows = Object.keys(BATHHOUSES).map(Number);
      t.equal(rows.length, 8, 'eight Bathhouse Row squares');
      const isBrass = ([r, g, b]) => r > 200 && g > 160 && g < 210 && b < 120;
      const isTeal = ([r, g, b]) => g > 180 && b > 170 && r < 160;
      const isTile = ([r, g, b]) => Math.abs(r - 0x8C) < 20 && Math.abs(g - 0x6A) < 20 && Math.abs(b - 0x1E) < 20;
      const got = await px([...rows, CENTER]);
      rows.forEach((i, k) => t.expect(isBrass(got[k]), `Row square ${i}: brass (${got[k].slice(0, 3)})`));
      t.expect(isTeal(got[8]), `the Display Spring: teal (${got[8].slice(0, 3)})`);
      await t.shot('w4-b08-minimap-landmarks');
      // a placed tile on a Row square and a staged tile on the Display Spring cover their markers
      const g = (await t.state()).game;
      g.board[rows[0]] = { l: 'A', blank: false, p: 0, t: 0 };
      await t.game('setState', { game: g });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const l = (await t.state()).game.players[0].rack.find((x) => x !== '?');
      t.equal((await t.game('act', 'stage', [{ i: CENTER, l }])).ok, true, 'a tile staged on the Display Spring');
      await t.game('act', 'zoom', 1.7, 4, 4);
      await t.waitFrames(4);
      const after = await px([rows[0], rows[1], CENTER]);
      t.expect(isTile(after[0]) && !isBrass(after[0]), `a covered Row square shows its tile (${after[0].slice(0, 3)})`);
      t.expect(isBrass(after[1]), 'the open ones keep their studs');
      t.expect(!isTeal(after[2]), `a covered Display Spring has no beacon (${after[2].slice(0, 3)})`);
    },
  },
  // ---------- W2-S4-16 ----------
  {
    name: 'W2-S4-16 Turn 1 of the Daily says what it is and what a Hot Springs word pays: the tiers from the word list, wide screens only in the strip (Node)',
    node: true,
    async run(t) {
      const c = await ctx();
      const s = createGame({ mode: 'daily', date: '2026-11-25', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      const tiers = Object.values(c.lex.data.tiers);
      t.equal(`${Math.min(...tiers)}-${Math.max(...tiers)}`, '10-30', 'the tiers run +10 to +30');
      const w = todaysSprings(s, c.lex, false, true), b = todaysSprings(s, c.lex, true, true);
      const line = '10 turns · same tiles for everyone · Hot Springs words earn +10 to +30 and open history cards';
      t.equal(w.rules, line, 'the line');
      t.expect(w.html.includes(`</span><span class="rules">${line}</span><span class="said">`), 'on wide screens it follows the kinds, before what a word of such a kind does');
      t.expect(!b.html.includes('class="rules"'), 'phones keep their two lines for the kinds and what they do');
    },
  },
  {
    name: 'W2-S4-16 in the game: on Turn 1 of the Daily the line shows whole and readable on wide screens, is read out on all, and is gone after the first play',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { mode: 'daily' });
      await t.waitIdle(8000);
      await t.waitFrames(2);
      await t.page.waitForFunction(() => /^Today's Springs: /.test(document.querySelector('#live').textContent), null, { timeout: 3000 });
      t.expect(/10 turns, same tiles for everyone, Hot Springs words earn \+10 to \+30 and open history cards\./.test(await t.page.textContent('#live')), 'the live region reads it');
      const r = await t.page.evaluate(() => {
        const e = document.querySelector('#preview .day .rules'), day = document.querySelector('#preview .day');
        if (!e) return null;
        const a = e.getBoundingClientRect(), b = day.getBoundingClientRect();
        return { text: e.textContent, whole: a.top >= b.top - 0.6 && a.bottom <= b.bottom + 0.6 && e.scrollWidth <= e.clientWidth + 1 && getComputedStyle(e).display !== 'none' };
      });
      if (t.viewport === 'mobile') { t.equal(r, null, 'phones: not in the strip'); return; }
      t.expect(r && r.whole, `wide screens: whole in the strip (${JSON.stringify(r)})`);
      const cr = await t.contrastReport({ selector: '#preview', min: 4.5, largeMin: 3 });
      t.equal(cr.fails.length, 0, `readable (${JSON.stringify(cr.fails)})`);
      await t.shot('w4-b08-daily-line');
      // on desktops from 1024x600 up the line is whole and moves nothing but the ledger's bottom edge (the strip sits in the side column)
      const boxes = () => t.page.evaluate(() => {
        const b = (s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v)); };
        const e = document.querySelector('#preview .day .rules'), day = document.querySelector('#preview .day'), a = e.getBoundingClientRect(), d = day.getBoundingClientRect();
        const without = (() => { const keep = e.style.display; e.style.display = 'none'; const o = { rack: b('#rackbar'), actions: b('#actions'), board: b('#boardwrap'), springs: b('#springs'), ledger: b('#ledger') }; e.style.display = keep; return o; })();
        return { whole: a.top >= d.top - 0.6 && a.bottom <= d.bottom + 0.6 && e.scrollWidth <= e.clientWidth + 1, rack: b('#rackbar'), actions: b('#actions'), board: b('#boardwrap'), springs: b('#springs'), ledger: b('#ledger'), without };
      });
      for (const [width, height] of [[1280, 800], [1180, 820], [1024, 768], [1024, 600]]) {
        await t.page.setViewportSize({ width, height });
        await t.waitFrames(4);
        const g = await boxes();
        t.expect(g.whole, `${width}x${height}: the line is whole`);
        for (const k of ['rack', 'actions', 'board', 'springs']) t.equal(JSON.stringify(g[k]), JSON.stringify(g.without[k]), `${width}x${height}: ${k} does not move for it`);
        t.log(`${width}x${height}: ledger ${g.ledger && g.ledger[3]} px tall (${g.without.ledger && g.without.ledger[3]} without the line)`);
        t.expect(!g.ledger || g.ledger[3] >= 60, `${width}x${height}: the ledger keeps room (${g.ledger && g.ledger[3]} px)`);
      }
      await t.shot('w4-b08-daily-line-1024x600');
      await t.page.setViewportSize({ width: 1280, height: 800 });
      await t.waitFrames(4);
      const mv = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv[0].tiles);
      t.equal((await t.game('act', 'play')).ok, true, 'Turn 1 played');
      await t.waitIdle(8000);
      t.equal(await t.page.$('#preview .rules'), null, 'gone on Turn 2');
    },
  },
];
