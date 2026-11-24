// Wave 3, batch W3-B03: W4-S3-04 (CVD-safe dashed+tick badCells, 220 ms crimson perimeter pulse on
// doPlay()/loseTurn() refusal, and non-linear perimeter lastPulse with zero center wash preserving CD-WF2-04 brass rings).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const normalMode = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false, motion: 'full' }));
  }
};
const CENTER = 112;

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

// Sample #board overlay canvas around a cell at given 3D lift:
// - center: inner crown [+-0.18*cellPx] (must stay free of opaque crimson/yellow wash)
// - outer: outside-edge band [0.46..0.60*cellPx] (where the 220ms expanding crimson perimeter pulse lands)
// - ring: full perimeter [0.36..0.60*cellPx]
async function sampleBoardCell(t, cell, lift) {
  return t.page.evaluate(async ({ cell, lift }) => {
    const cv = document.getElementById('board');
    const ctx = cv.getContext('2d');
    const r = cv.getBoundingClientRect();
    const dpr = cv.width / r.width;
    const [cx, cy] = await window.__game.act('cell', cell, lift);
    const [nx] = await window.__game.act('cell', cell + (cell % 15 === 14 ? -1 : 1), lift);
    const cellPx = Math.abs(nx - cx);
    const half = Math.ceil(cellPx * 0.62 * dpr);
    const x0 = Math.max(0, Math.round(cx * dpr) - half);
    const y0 = Math.max(0, Math.round(cy * dpr) - half);
    const x1 = Math.min(cv.width, Math.round(cx * dpr) + half);
    const y1 = Math.min(cv.height, Math.round(cy * dpr) + half);
    const w = x1 - x0, h = y1 - y0;
    const d = ctx.getImageData(x0, y0, w, h).data;
    const cpx = cx * dpr, cpy = cy * dpr, cp = cellPx * dpr;
    let centerRed = 0, centerGold = 0, outerRed = 0, ringRed = 0, ringGold = 0, ringGoldAlpha = 0, ringBrass = 0;
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        const R = d[idx], G = d[idx + 1], B = d[idx + 2], A = d[idx + 3];
        if (A < 25) continue;
        const dx = Math.abs((x0 + px + 0.5) - cpx) / cp;
        const dy = Math.abs((y0 + py + 0.5) - cpy) / cp;
        const linf = Math.max(dx, dy);
        const isRed = R > 140 && G < 78 && B < 68;
        const isGold = R > 215 && G > 180 && B < 150 && (R - B) > 55;
        const isBrass = Math.abs(R - 122) < 18 && Math.abs(G - 75) < 18 && Math.abs(B - 7) < 18 && A > 180;
        if (linf <= 0.18) {
          if (isRed) centerRed++;
          if (isGold) centerGold++;
        } else {
          if (linf >= 0.48 && linf <= 0.60 && isRed) outerRed++;
          if (linf >= 0.36 && linf <= 0.60) {
            if (isRed) ringRed++;
            if (isGold) { ringGold++; ringGoldAlpha += A; }
            if (isBrass) ringBrass++;
          }
        }
      }
    }
    return { centerRed, centerGold, outerRed, ringRed, ringGold, ringGoldAlpha, ringBrass };
  }, { cell, lift });
}

export const tests = [
  {
    name: 'W4-S3-04 doPlay() refusal triggers a 220 ms crimson perimeter pulse on placement errors & non-words (zero center wash, expires at 220 ms, off under reduced motion)',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: normalMode,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      await stopClock(t);

      // 1) Placement-rule error lacking p.words/p.badWord: single tile at A1 (i = 0)
      const st0 = await t.state();
      const ch0 = st0.game.players[0].rack.find((l) => l !== '?');
      await t.game('act', 'stage', [{ i: 0, l: ch0 }]);
      await t.page.clock.runFor(40);
      t.equal((await t.state()).badPulse, null, 'no refusal pulse before doPlay()');
      const before = await sampleBoardCell(t, 0, 0.30);
      t.expect(before.ringRed >= 20, `static dashed badCells already highlights A1 (${before.ringRed} red px)`);
      t.equal(before.centerRed, 0, 'static badCells puts 0 crimson pixels on glyph crown center');

      // Click Play -> refused with 220 ms crimson perimeter pulse on [0]
      const r0 = await t.game('act', 'play');
      t.equal(r0.ok, false, 'off-center play at A1 refused');
      const imm = (await t.state()).badPulse;
      t.expect(imm && imm.dur === 220 && imm.cells.length === 1 && imm.cells[0] === 0, `doPlay() started 220 ms badPulse on [0] (${JSON.stringify(imm)})`);

      // At t = 50 ms: expanding outer crimson perimeter pulse lights outside the cell edge while keeping glyph center clear
      await t.page.clock.runFor(50);
      const during = await sampleBoardCell(t, 0, 0.30);
      t.expect(during.outerRed > before.outerRed + 10, `crimson perimeter pulse expands outside cell edge (${before.outerRed} -> ${during.outerRed} outer red px)`);
      t.equal(during.centerRed, 0, 'refusal perimeter pulse puts 0 crimson pixels on glyph crown center');
      await t.shot('w3-b03-doplay-refusal-pulse', { wait: false });

      // Advance past 220 ms -> badPulse expires cleanly while static dashed badCells remains
      await t.page.clock.runFor(220);
      t.equal((await t.state()).badPulse, null, 'badPulse expired cleanly after 220 ms');
      const after = await sampleBoardCell(t, 0, 0.30);
      t.expect(after.outerRed < during.outerRed, `outer crimson pulse faded back down (${during.outerRed} -> ${after.outerRed})`);
      t.expect(after.ringRed >= 20, `static dashed badCells persists after pulse ends (${after.ringRed} red px)`);

      // 2) Dictionary-error refusal on non-word QXZ pulses all badWord cells, and recall clears it immediately
      await t.game('act', 'recall');
      const st1 = await t.state();
      st1.game.players[0].rack = 'QXZAAAA'.split('');
      await t.game('setState', { game: st1.game });
      await t.game('act', 'stage', [{ i: CENTER, l: 'Q' }, { i: CENTER + 1, l: 'X' }, { i: CENTER + 2, l: 'Z' }]);
      await t.page.clock.runFor(20);
      t.equal((await t.game('act', 'play')).ok, false, 'non-word QXZ refused');
      const qxzPulse = (await t.state()).badPulse;
      t.equal(JSON.stringify(qxzPulse && qxzPulse.cells), JSON.stringify([CENTER, CENTER + 1, CENTER + 2]), 'non-word refusal pulses all QXZ cells');
      await t.game('act', 'recall');
      t.equal((await t.state()).badPulse, null, 'recalling staged tiles clears active badPulse');

      // 3) Reduced motion: refusal must NOT start animated badPulse (static badCells + preview err-flash remain)
      await t.page.evaluate(() => { window.__G.settings.motion = 'reduce'; });
      await t.game('act', 'stage', [{ i: 0, l: 'Q' }]);
      await t.page.clock.runFor(20);
      t.equal((await t.game('act', 'play')).ok, false, 'refused under reduced motion');
      t.equal((await t.state()).badPulse, null, 'no animated badPulse under reduced motion');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W4-S3-04 Challenge mode loseTurn() triggers a 220 ms crimson perimeter pulse on refused cells even after tiles recall',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: normalMode,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', {
        challenge: true,
        seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }],
      });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const st0 = await t.state();
      st0.game.players[0].rack = 'QXZAAAA'.split('');
      await t.game('setState', { game: st0.game });
      await t.game('act', 'reveal');
      await stopClock(t);

      // Stage non-word QXZ in Challenge mode: preview hides dictionary check until Play
      await t.game('act', 'stage', [{ i: CENTER, l: 'Q' }, { i: CENTER + 1, l: 'X' }, { i: CENTER + 2, l: 'Z' }]);
      await t.page.clock.runFor(20);
      t.equal((await t.state()).preview.ok, true, 'Challenge mode hides dictionary status during staging');

      // Play -> loseTurn() recalls tiles and fires 220 ms crimson perimeter pulse on [112, 113, 114]
      await t.game('act', 'play');
      const imm = await t.state();
      t.equal(imm.game.move, 1, 'Challenge refusal advanced move (lost turn)');
      t.equal(imm.game.log[0].challenge, 'QXZ', 'lost turn logged refused word QXZ');
      t.equal(imm.staged.length, 0, 'staged tiles recalled on loseTurn');
      t.equal(JSON.stringify(imm.badPulse && imm.badPulse.cells), JSON.stringify([CENTER, CENTER + 1, CENTER + 2]), 'loseTurn() started 220 ms badPulse on refused word cells');
      t.equal(imm.badPulse.dur, 220, 'loseTurn() badPulse duration is 220 ms');

      // Hide privacy curtain on pass-and-play turn flip so we can inspect the board canvas directly
      await t.game('act', 'reveal');
      await t.page.clock.runFor(45);
      const mid = await sampleBoardCell(t, CENTER, 0);
      t.expect(mid.ringRed >= 20, `loseTurn() draws crimson dashed perimeter + ticks on vacated cell (${mid.ringRed} red px)`);
      t.equal(mid.centerRed, 0, 'loseTurn() crimson pulse leaves cell center clear (0 red px)');
      await t.shot('w3-b03-challenge-loseturn-pulse', { wait: false });

      // Advance past afterAction's 150 ms turnWait (total ~175 ms < 220 ms): startTurn() must NOT prematurely clear badPulse
      await t.page.clock.runFor(130);
      t.expect(!!(await t.state()).badPulse, 'badPulse survives startTurn() at 150 ms until full 220 ms elapses');

      // Advance past 220 ms -> expires cleanly and crimson pixels vanish
      await t.page.clock.runFor(100);
      t.equal((await t.state()).badPulse, null, 'loseTurn() badPulse expired cleanly after 220 ms');
      const end = await sampleBoardCell(t, CENTER, 0);
      t.equal(end.ringRed, 0, 'no residual crimson pixels remain after loseTurn() pulse ends');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W4-S3-04 lastPulse renders a crisp non-linear perimeter glow outside the glyph crown (zero center wash) while preserving CD-WF2-04 dark-brass rings',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: normalMode,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      await stopClock(t);

      // Play Turn 1 as human, then let AI drop its reply so G.lastPulse fires on AI landing
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'human Turn 1 played');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      await t.page.keyboard.press('Space'); // land AI reply immediately (starts drop anim + schedules lastPulse at landing)
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });

      const pulseInfo = await t.page.evaluate(() => {
        const log = window.__G.s.log.filter((e) => e.kind === 'play');
        const last = log[log.length - 1];
        const lp = window.__G.lastPulse;
        return {
          cell: last.tiles[0].i,
          t0: lp ? lp.t0 : null,
          dur: lp ? lp.dur : null,
          now: performance.now(),
        };
      });
      t.expect(pulseInfo.t0 != null && pulseInfo.dur > 0, `AI play scheduled lastPulse (${JSON.stringify(pulseInfo)})`);

      // Step to early peak of lastPulse (t0 + 40 ms)
      const toPeak = Math.max(20, Math.round(pulseInfo.t0 - pulseInfo.now + 40));
      await t.page.clock.runFor(toPeak);
      const early = await sampleBoardCell(t, pulseInfo.cell, 0.24);
      t.equal(early.centerGold, 0, 'lastPulse paints 0 yellow/gold wash pixels over the glyph crown center');
      t.expect(early.ringGold >= 20, `lastPulse strokes crisp bright-gold perimeter glow around bevel (${early.ringGold} gold px)`);
      t.expect(early.ringBrass >= 12, `CD-WF2-04 dark-brass ring stays crisp on top of glow (${early.ringBrass} brass px)`);
      await t.shot('w3-b03-lastpulse-perimeter', { wait: false });

      // Step to midpoint (t0 + dur/2): non-linear decay (1 - 0.5)^1.7 = 0.308 < linear 0.50
      await t.page.clock.runFor(Math.round(pulseInfo.dur * 0.46));
      const mid = await sampleBoardCell(t, pulseInfo.cell, 0.24);
      t.equal(mid.centerGold, 0, 'midpoint lastPulse still paints 0 wash pixels over glyph crown center');
      t.expect(mid.ringGoldAlpha < early.ringGoldAlpha * 0.55, `lastPulse decays non-linearly faster than 0.50 linear (${early.ringGoldAlpha} -> ${mid.ringGoldAlpha})`);

      // Step past end of lastPulse -> glow ends cleanly, dark-brass ring persists
      await t.page.clock.runFor(pulseInfo.dur + 100);
      t.equal((await t.state()).pulse, false, 'lastPulse ended cleanly');
      const end = await sampleBoardCell(t, pulseInfo.cell, 0.24);
      t.expect(end.ringBrass >= 12, `CD-WF2-04 dark-brass ring persists after lastPulse ends (${end.ringBrass} brass px)`);
      await t.page.clock.resume();
    },
  },
];
