// Wave 4, batch W4-B01 (WF-1 mechanics and tone): what the earlier waves left of W1-S5-04 and W1-S5-01 (W1-P-N03 was already built).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' }));
  }
};
const TWO = { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] };
// a two-person game with `rack` to play and the tiles of `board` ([square, letter]) already down
async function table(t, rack, board = [], mod = null) {
  await t.game('newGame', TWO);
  await t.waitIdle(8000);
  await t.game('act', 'reveal');
  const g = (await t.state()).game;
  g.players[0].rack = rack.split('');
  for (const [i, l] of board) g.board[i] = { l, blank: false, p: 1, t: 0 };
  if (board.length) { g.move = 1; g.cur = 0; }
  if (mod) mod(g);
  await t.game('setState', { game: g });
  await t.waitIdle(8000);
}

export const tests = [
  {
    name: 'W1-S5-04 a blank Steam tile is frosted sea glass with engraved curls, its letter at least 4.5:1, on every kind of tile and in both themes',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const { out, faint } = await t.page.evaluate(async () => {
        await document.fonts.ready;
        const R = await import(new URL('src/js/render2d.js', location.href).href);
        const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
        const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const px = (l, blank, w, kind, theme) => {
          const d = R.tileSprite(l, blank, w, kind, theme).getContext('2d').getImageData(0, 0, w, w).data;
          return (x, y) => { const o = (Math.round(y * w) * w + Math.round(x * w)) * 4; return [d[o], d[o + 1], d[o + 2]]; };
        };
        const each = (x0, x1, y0, y1, fn) => { for (let y = y0; y < y1; y += 0.01) for (let x = x0; x < x1; x += 0.01) fn(x, y); };
        // the ground beside an I's stem, where the curls pass behind a letter
        const beside = (f) => { let lo = 9, hi = 0; for (const [a, b] of [[0.34, 0.39], [0.58, 0.66]]) each(a, b, 0.42, 0.58, (x, y) => { const v = lum(f(x, y)); lo = Math.min(lo, v); hi = Math.max(hi, v); }); return { lo, hi }; };
        const out = [];
        for (const theme of ['light', 'dark']) for (const kind of ['rack', 'board', 'staged', 'face']) for (const w of [48, 128]) {
          const bare = px('', true, w, kind, theme), plain = px('', false, w, kind, theme);
          const a = bare(0.2, 0.8), b = plain(0.2, 0.8), la = lum(a), lb = lum(b);
          let n = 0, marks = 0, plainMarks = 0, value = 0, ink = 9;
          each(0.25, 0.75, 0.22, 0.78, (x, y) => { n++; if (lum(bare(x, y)) < la * 0.72) marks++; if (lum(plain(x, y)) < lb * 0.72) plainMarks++; });
          for (const l of 'EIMQW') { const f = px(l, true, w, kind, theme); let d = 9; each(0.15, 0.85, 0.15, 0.85, (x, y) => { d = Math.min(d, lum(f(x, y))); }); ink = ink === 9 ? d : Math.max(ink, d); }
          const f = px('I', true, w, kind, theme);
          each(0.72, 0.86, 0.74, 0.86, (x, y) => { if (lum(f(x, y)) < la * 0.5) value++; });
          out.push({ id: `${theme} ${kind} ${w}`, blank: a, plain: b, marks: marks / n, plainMarks, value, ratio: (beside(f).lo + 0.05) / (ink + 0.05) });
        }
        const g = beside(px('I', true, 256, 'face', 'light'));
        return { out, faint: g.lo / g.hi };
      });
      for (const r of out) {
        t.expect(r.blank[1] - r.blank[0] >= 8 && r.blank[2] > r.blank[0], `${r.id}: a blank is sea glass, green over red (${r.blank})`);
        t.expect(r.plain[0] >= r.plain[2], `${r.id}: an ivory tile stays warm (${r.plain})`);
        t.expect(r.marks >= 0.06, `${r.id}: the curls show on a blank with no letter (${(r.marks * 100).toFixed(1)}% of the middle)`);
        t.equal(r.plainMarks, 0, `${r.id}: and not on an ivory one`);
        t.expect(r.ratio >= 4.5, `${r.id}: letter ${r.ratio.toFixed(1)}:1`);
        t.equal(r.value, 0, `${r.id}: no value in its corner`);
      }
      t.log(`worst letter ${Math.min(...out.map((r) => r.ratio)).toFixed(2)}:1, fewest marks ${(Math.min(...out.map((r) => r.marks)) * 100).toFixed(1)}%, curls behind a letter ${faint.toFixed(3)}`);
      t.expect(faint > 0.8 && faint < 0.95, `behind a letter the curls are faint but there (${faint.toFixed(3)})`);

      // in the game: the rack's blank, then the same tile on the board
      await table(t, '?ATQQQQ', [[111, 'C']]);
      const rack = await t.page.evaluate(() => ['?', 'A'].map((l) => {
        const c = [...document.querySelectorAll('#rack .rtile')].find((b) => b.dataset.key.split('|')[1] === l).querySelector('canvas');
        return [...c.getContext('2d').getImageData(Math.round(c.width * 0.2), Math.round(c.height * 0.8), 1, 1).data];
      }));
      t.expect(rack[0][1] - rack[0][0] >= 8, `the rack's blank is sea glass (${rack[0]})`);
      t.expect(rack[1][0] >= rack[1][2], `the A beside it is ivory (${rack[1]})`);
      await t.shot('w4-b01-rack-blank');
      await t.game('act', 'stage', [{ i: 112, l: 'A' }, { i: 113, l: 'T', blank: true }]);
      await t.waitIdle(5000);
      await t.shot('w4-b01-board-blank');
      await t.page.emulateMedia({ colorScheme: 'dark' });
      await t.page.waitForFunction(() => document.body.classList.contains('theme-dark'));
      await t.waitIdle(5000);
      await t.shot('w4-b01-board-blank-night');
    },
  },
  {
    name: 'W1-S5-04 a plain play that uses a blank or covers a Boiling Spring lets off a short local puff; an ordinary play does not',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const fx = async (rack, board, tiles) => {
        await table(t, rack, board);
        await t.game('act', 'stage', tiles);
        // played and read in one step, so no particle has died before it is counted
        const r = await t.page.evaluate(async () => { const ok = (await window.__game.act('play')).ok; return { ok, fx: window.__game.getState().fx }; });
        t.expect(r.ok, `played ${JSON.stringify(tiles)}`);
        return r.fx;
      };
      const blank = await fx('?XXXXXX', [[110, 'C'], [111, 'A']], [{ i: 112, l: 'T', blank: true }]);
      t.equal(blank.lastEvent, 'boil-blank', 'a blank on a plain square');
      t.equal(blank.steamKinds, 2, 'two puffs for the one tile');
      const boil = await fx('AXXXXXX', [[5, 'T']], [{ i: 4, l: 'A' }]);
      t.equal(boil.steamKinds, 2, 'a Boiling Spring covered: two puffs');
      t.expect(boil.flashShapes.includes('oct'), 'beside its rim glint');
      const plain = await fx('TXXXXXX', [[110, 'C'], [111, 'A']], [{ i: 112, l: 'T' }]);
      t.equal(plain.steamKinds, 0, 'none on an ordinary play');
    },
  },
  {
    name: 'W1-S5-01 a plain word over a Bathhouse Row square says what the square pays a Hot Springs word, with or without a plaque letter left to clear, and moves nothing',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const PLAQUES = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
      const DONE = PLAQUES.map((f) => ({ ...f, by: 1, at: 0 }));
      const read = () => t.page.evaluate(() => {
        const p = document.querySelector('#preview'), box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10); };
        return { note: [...document.querySelectorAll('#preview .row-reveal')].map((e) => e.textContent).join(' | '), strip: p.offsetHeight, rack: box('#rackbar'), actions: box('#actions'), board: box('#boardwrap'), clipped: p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1 };
      });
      const narrow = t.viewport === 'mobile', plus = '+20 with a Hot Springs word';
      const sizes = narrow ? [[390, 844], [360, 740]] : [[1280, 800], [1024, 600]];
      for (const [width, height] of sizes) {
        await t.page.setViewportSize({ width, height });
        const at = `${width}x${height}`;
        const stage = async (rack, board, tiles, featured) => {
          await table(t, rack, board, (g) => { g.featured = featured.map((f) => ({ ...f })); });
          const before = await read();
          await t.game('act', 'stage', tiles);
          await t.page.waitForFunction(() => document.querySelector('#preview .words'));
          const now = await read();
          for (const k of ['rack', 'actions', 'board']) t.equal(JSON.stringify(now[k]), JSON.stringify(before[k]), `${at}: ${k} stays put under the note`);
          t.equal(now.clipped, false, `${at}: nothing clipped in the strip`);
          return now.note;
        };
        const CAT = [[[7, 'C']], [{ i: 8, l: 'A' }, { i: 9, l: 'T' }]];
        t.equal(await stage('ATQQQQQ', ...CAT, PLAQUES), narrow ? 'Row · clears 1 plaque letter' : `Row · clears 1 plaque letter | ${plus}`, `${at}: a letter to clear`);
        if (width === sizes[0][0]) await t.shot('w4-b01-row-note');
        await t.page.click('#preview .bdbtn');
        t.expect((await t.page.textContent('#preview .bd')).includes(`clears 1 fogged Featured Spring letter · ${plus}`), `${at}: and both in How it scores`);
        t.equal(await stage('ATQQQQQ', ...CAT, DONE), `Row · ${plus}`, `${at}: nothing left to clear`);
        if (width === sizes[0][0]) await t.shot('w4-b01-row-note-none');
        await t.page.click('#preview .bdbtn');
        t.expect(!/clears 1/.test(await t.page.textContent('#preview .bd')), `${at}: How it scores promises no letter either`);
        // a Hot Springs word there is already paid its +20, so the note only has the letter
        t.equal(await stage('AQQQQQQ', [[6, 'S'], [7, 'P']], [{ i: 8, l: 'A' }], PLAQUES), 'Row · clears 1 plaque letter', `${at}: SPA over the Row`);
      }
    },
  },
];
