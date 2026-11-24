// Wave 2, batch W2-B08:
//   - W2-S3-02: 3D overlay lift projection (R.proj.fn(bx, by, lift) for last, goodCells, badCells, goldSweep,
//     blocked, cursor) and scaled translucent/offset #ghost drag tiles keeping target & blocked outlines visible.

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112, N = 15;
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

async function startWithRack(t, rack) {
  await ready(t);
  await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
  await t.waitIdle(8000);
  const s = await t.state();
  s.game.players[0].rack = rack.split('');
  await t.game('setState', { game: s.game });
  await t.waitIdle(5000);
}

// Measure the vertical centroid (in CSS px on the given canvas) of pixels matching a predicate within a box around (cx, cy).
async function overlayCentroid(t, selector, cx, cy, halfW, halfH, matcherSrc) {
  return t.page.evaluate(({ sel, x, y, hw, hh, fnSrc }) => {
    const cv = document.querySelector(sel);
    const ctx = cv.getContext('2d');
    const r = cv.getBoundingClientRect();
    const dpr = cv.width / r.width;
    const x0 = Math.max(0, Math.floor((x - hw) * dpr));
    const y0 = Math.max(0, Math.floor((y - hh) * dpr));
    const x1 = Math.min(cv.width, Math.ceil((x + hw) * dpr));
    const y1 = Math.min(cv.height, Math.ceil((y + hh) * dpr));
    const d = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
    const match = new Function('r', 'g', 'b', 'a', `return (${fnSrc});`);
    let count = 0, sumY = 0, minY = Infinity, maxY = -Infinity;
    const w = x1 - x0;
    for (let py = 0; py < y1 - y0; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4;
        if (match(d[idx], d[idx + 1], d[idx + 2], d[idx + 3])) {
          const cssY = (y0 + py + 0.5) / dpr;
          count++; sumY += cssY;
          if (cssY < minY) minY = cssY;
          if (cssY > maxY) maxY = cssY;
        }
      }
    }
    return { count, meanY: count ? sumY / count : null, minY: count ? minY : null, maxY: count ? maxY : null };
  }, { sel: selector, x: cx, y: cy, hw: halfW, hh: halfH, fnSrc: matcherSrc });
}

export const tests = [
  {
    name: 'W2-S3-02 3D overlay lift projection: last, goodCells, badCells, and goldSweep wrap raised 3D tile faces',
    url: 'index.html?gl=3d',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await startWithRack(t, 'SPRINGE');
      const s0 = await t.state();
      t.equal(s0.view.mode3d, true, '3D board active with ?gl=3d');

      // 1) Verify R.proj.fn(bx, by, lift) shifts projected Y upward as lift increases from 0 -> 0.24 -> 0.30
      const p0 = await t.game('act', 'cell', CENTER, 0);
      const p24 = await t.game('act', 'cell', CENTER, 0.24);
      const p30 = await t.game('act', 'cell', CENTER, 0.30);
      t.expect(p24[1] < p0[1] - 2.0, `3D lift 0.24 shifts Y upward (${p0[1]} -> ${p24[1]})`);
      t.expect(p30[1] < p24[1] - 0.5, `3D lift 0.30 shifts Y further upward (${p24[1]} -> ${p30[1]})`);

      // 2) Stage valid Hot Springs word SPRING across CENTER-2..CENTER+3 (goodCells at staged lift 0.30)
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      await t.waitFrames(3);
      const cellPx = await t.page.evaluate(() => {
        const a = window.__game.act('cell', 112);
        const b = window.__game.act('cell', 113);
        return Promise.all([a, b]).then(([p, q]) => Math.hypot(q[0] - p[0], q[1] - p[1]));
      });
      // Sample teal goodCells outline around CENTER (staged tile -> lift 0.30)
      const good = await overlayCentroid(t, '#board', p30[0], p0[1], cellPx * 0.52, cellPx * 0.85,
        'a > 120 && g > 130 && b > 120 && r < 90');
      t.expect(good.count >= 40, `teal goodCells outline pixels rendered (${good.count})`);
      const goodErr30 = Math.abs(good.meanY - p30[1]);
      const goodErr0 = Math.abs(good.meanY - p0[1]);
      t.expect(goodErr30 < goodErr0 && goodErr30 <= 2.5,
        `goodCells teal ring centers on staged tile top y=${p30[1]} (meanY=${good.meanY?.toFixed(1)}, board y0=${p0[1]})`);

      // 3) Stage an invalid word (QXZ) to check badCells crimson dashed outline at lift 0.30
      await t.game('act', 'recall');
      const stBad = await t.state();
      stBad.game.players[0].rack = 'QXZAAAA'.split('');
      await t.game('setState', { game: stBad.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', [{ l: 'Q', i: CENTER }, { l: 'X', i: CENTER + 1 }, { l: 'Z', i: CENTER + 2 }]);
      await t.waitFrames(3);
      const bad = await overlayCentroid(t, '#board', p30[0], p0[1], cellPx * 0.52, cellPx * 0.85,
        'a > 120 && r > 140 && g < 70 && b < 60');
      t.expect(bad.count >= 40, `crimson badCells outline pixels rendered (${bad.count})`);
      const badErr30 = Math.abs(bad.meanY - p30[1]);
      const badErr0 = Math.abs(bad.meanY - p0[1]);
      t.expect(badErr30 < badErr0 && badErr30 <= 2.5,
        `badCells crimson ring centers on staged tile top y=${p30[1]} (meanY=${bad.meanY?.toFixed(1)}, board y0=${p0[1]})`);
      await t.shot('w2-b08-3d-badcells', { timeout: 15000 });

      // 4) Play Hot Springs word SPRING in a 2-human game so SPRING stays the isolated horizontal `last` play:
      // verify both `last` dark-brass ring and `#fx` goldSweep wrap the placed tile face at lift 0.24.
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const stPlay = await t.state();
      stPlay.game.players[0].rack = 'SPRINGE'.split('');
      await t.game('setState', { game: stPlay.game });
      await t.waitIdle(5000);
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      await t.game('act', 'play');
      await t.waitFrames(2);
      // Reveal next seat so #privacy does not obscure the board screenshot
      await t.game('act', 'reveal');
      await t.waitFrames(2);

      // Freeze FX early (swAt + 50 ms) when goldSweep peaks right on the first cell (CENTER-2) and steam puffs have barely started
      const swAt = (await t.state()).sweepAt;
      const firstCell = CENTER - 2;
      const fp0 = await t.game('act', 'cell', firstCell, 0);
      const fp24 = await t.game('act', 'cell', firstCell, 0.24);
      if (swAt != null) {
        await t.game('act', 'freezeFx', swAt + 50);
        await t.waitFrames(3);
        const sweep = await overlayCentroid(t, '#fx', fp24[0], fp0[1], cellPx * 0.55, cellPx * 0.85,
          'a > 40 && r > 225 && g > 195 && (r - b) > 45');
        t.expect(sweep.count >= 40, `goldSweep pixels rendered on #fx (${sweep.count})`);
        const swMid = (sweep.minY + sweep.maxY) / 2;
        const swErr24 = Math.abs(swMid - fp24[1]);
        const swErr0 = Math.abs(swMid - fp0[1]);
        t.expect(swErr24 < swErr0 && swErr24 <= 2.5,
          `goldSweep centers on placed tile top y=${fp24[1]} (midY=${swMid.toFixed(1)}, board y0=${fp0[1]})`);
      } else {
        t.fail('expected active goldSweep after playing Hot Springs word SPRING');
      }
      await t.game('act', 'freezeFx', null);

      // Verify `last` dark-brass ring on CENTER (middle of horizontal SPRING, no vertical neighbors) wraps placed tile top at lift 0.24
      const lastRing = await overlayCentroid(t, '#board', p24[0], p0[1], cellPx * 0.48, cellPx * 0.72,
        'a > 120 && r > 90 && r < 165 && g > 50 && g < 110 && b < 40');
      t.expect(lastRing.count >= 40, `dark-brass last-play ring pixels rendered (${lastRing.count})`);
      const lastMid = (lastRing.minY + lastRing.maxY) / 2;
      const lastErr24 = Math.abs(lastMid - p24[1]);
      const lastErr0 = Math.abs(lastMid - p0[1]);
      t.expect(lastErr24 < lastErr0 && lastErr24 <= 2.0,
        `last-play ring centers on placed tile top y=${p24[1]} (midY=${lastMid.toFixed(1)}, board y0=${p0[1]})`);

      // Stage a valid connecting word for Bo so screenshot shows BOTH `last` (lift 0.24) and `goodCells` (lift 0.30/0.24)
      const moves = await t.game('act', 'moves', 1);
      if (moves.length) {
        await t.game('act', 'stage', moves[0].tiles);
        await t.waitFrames(3);
      }
      await t.shot('w2-b08-3d-last-and-staged', { timeout: 15000 });
      t.expect((await t.state()).view.mode3d, '3D stayed active throughout');
    },
  },
  {
    name: 'W2-S3-02 #ghost drag sizing, translucency, and offset keep target & blocked outlines visible (desktop & mobile)',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await startWithRack(t, 'SPRINGE');
      // Stage S at CENTER so CENTER is a taken square (blocked) and CENTER+1 is an empty target square
      await t.game('act', 'stage', [{ l: 'S', i: CENTER }]);
      await t.waitFrames(2);

      const targetPt = await t.game('act', 'screen', CENTER + 1);
      const blockedPt = await t.game('act', 'screen', CENTER);
      const nextPt = await t.game('act', 'screen', CENTER + 2);
      const cellPx = Math.hypot(nextPt[0] - targetPt[0], nextPt[1] - targetPt[1]);
      const tilePt = await t.game('act', 'rackTile', 0);
      const touch = t.viewport === 'mobile';
      const lift = touch ? await t.game('act', 'dragLift') : 0;

      let cdp = null;
      const moveTo = async (x, y) => {
        if (touch) {
          await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y, id: 1 }] });
        } else {
          await t.page.mouse.move(x, y, { steps: 6 });
        }
        await t.waitFrames(3);
      };

      if (touch) {
        cdp = await t.page.context().newCDPSession(t.page);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tilePt[0], y: tilePt[1], id: 1 }] });
        for (let k = 1; k <= 10; k++) {
          await cdp.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: tilePt[0] + (targetPt[0] - tilePt[0]) * k / 10, y: tilePt[1] + (targetPt[1] + lift - tilePt[1]) * k / 10, id: 1 }],
          });
        }
        await t.waitFrames(3);
      } else {
        await t.page.mouse.move(tilePt[0], tilePt[1]);
        await t.page.mouse.down();
        await t.page.mouse.move(targetPt[0], targetPt[1], { steps: 8 });
        await t.waitFrames(3);
      }

      // 1) Over empty target cell: #ghost scaled near cellPx (~1.05x), translucent, and offset above the cell center
      const stTarget = await t.state();
      t.equal(stTarget.drag && stTarget.drag.target, CENTER + 1, 'drag targets empty square CENTER+1');
      const maxSize = Math.max(24, Math.ceil(cellPx * 1.15));
      t.expect(stTarget.drag.size <= maxSize, `#ghost size (${stTarget.drag.size}px) <= ~1.05-1.15x cell (${cellPx.toFixed(1)}px, limit ${maxSize}px)`);
      const ghTarget = await t.page.evaluate(() => {
        const el = document.querySelector('#ghost');
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          hidden: el.hidden,
          hasTarget: el.classList.contains('over-target'),
          hasBlocked: el.classList.contains('over-blocked'),
          opacity: parseFloat(cs.opacity),
          cx: r.left + r.width / 2,
          cy: r.top + r.height / 2,
          w: r.width,
        };
      });
      t.equal(ghTarget.hidden, false, '#ghost is visible during drag');
      t.equal(ghTarget.hasTarget, true, '#ghost carries .over-target over empty square');
      t.equal(ghTarget.hasBlocked, false, '#ghost does not carry .over-blocked over empty square');
      t.expect(ghTarget.opacity < 0.75, `#ghost is translucent over target (${ghTarget.opacity})`);
      t.expect(ghTarget.cy < targetPt[1] - 3, `#ghost center Y (${ghTarget.cy.toFixed(1)}) sits above snapped cell center Y (${targetPt[1].toFixed(1)})`);
      await t.shot('w2-b08-drag-target', { wait: false });

      // 2) Over taken square (CENTER): #ghost carries .over-blocked, lower opacity, and crimson dashed outline renders on #board
      await moveTo(blockedPt[0], blockedPt[1] + lift);
      const stBlocked = await t.state();
      t.equal(stBlocked.drag && stBlocked.drag.blocked, CENTER, 'drag reports blocked over taken square CENTER');
      const ghBlocked = await t.page.evaluate(() => {
        const el = document.querySelector('#ghost');
        const r = el.getBoundingClientRect();
        const cs = getComputedStyle(el);
        return {
          hasTarget: el.classList.contains('over-target'),
          hasBlocked: el.classList.contains('over-blocked'),
          opacity: parseFloat(cs.opacity),
          cy: r.top + r.height / 2,
        };
      });
      t.equal(ghBlocked.hasBlocked, true, '#ghost carries .over-blocked over taken square');
      t.equal(ghBlocked.hasTarget, false, '#ghost drops .over-target over taken square');
      t.expect(ghBlocked.opacity <= 0.55, `#ghost is clearly translucent over blocked square (${ghBlocked.opacity})`);
      t.expect(ghBlocked.cy < blockedPt[1] - 3, `#ghost sits above blocked cell center (${ghBlocked.cy.toFixed(1)} < ${blockedPt[1].toFixed(1)})`);
      await t.shot('w2-b08-drag-blocked', { wait: false });

      // 3) Release over taken square -> returns to rack cleanly, #ghost hidden with classes cleared
      if (touch) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await cdp.detach();
      } else {
        await t.page.mouse.up();
      }
      await t.page.waitForFunction(() => document.querySelector('#ghost').hidden, null, { timeout: 3000 });
      const ghEnd = await t.page.evaluate(() => {
        const el = document.querySelector('#ghost');
        return { hidden: el.hidden, cls: el.className };
      });
      t.equal(ghEnd.hidden, true, '#ghost hidden after drag ends');
      t.equal(ghEnd.cls, '', '#ghost hover classes cleared after drag ends');
    },
  },
];
