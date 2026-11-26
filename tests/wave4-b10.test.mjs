// Wave 4, batch W4-B10 (WF-2 spatial_blockout):
// - W2-S3-05: earlier commits 7bc5acc (W3-S3-01) and 3dd8fa0 (W6-S4-05) tightened desktop 3D framing to >=90% board
//   height and hid B3.bell when narrow; this batch adds the optional lightweight bounding-sphere click check on B3.bell
//   (soft brass desk-bell ding + 180 ms plunger bob, reduced-motion safe, non-skipping during AI waits).
// - W2-S4-11: already solved by a8644f0 (W1-S2-05) grouping Pause utilities into 2 .row2 pairs; guarded here for compact
//   vertical/horizontal backdrop clearance on 800 px desktop and mobile viewports.

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true, fx: true, music: false, amb: false, theme: 'light' }));
  }
};
const normal = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: true, fx: true, music: false, amb: false, theme: 'light' }));
  }
};
const seeded = new Function('window.__TEST_TIPS__ = false; let a = 7 >>> 0; Math.random = () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };');

export const tests = [
  // ---------- W2-S3-05 (3D bell click, bob, hover, reduced motion, hidden-when-narrow) ----------
  {
    name: 'W2-S3-05 desktop 3D keeps tightened >=90% board framing and rings/bobs B3.bell on bounding-sphere click without disturbing board play',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.clock.install();
      await t.reload();
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian' }] });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      const b0 = await t.game('act', 'b3');
      if (!t.gpu || !b0 || !b0.on) {
        t.log('software GL active; skipping live 3D bell click/bob assertions');
        return;
      }

      // 1) Confirm tightened CD-WF2-06 desktop framing from 7bc5acc still holds
      const boardH = (b0.bezel.maxY - b0.bezel.minY) / b0.bezel.H;
      t.expect(b0.fit < 35.8, `desktop fit stays tightened (${b0.fit.toFixed(2)} < 35.8)`);
      t.expect(boardH >= 0.90, `board + walnut frame fills ${(boardH * 100).toFixed(1)}% >= 90% of #boardwrap`);
      t.equal(b0.props.bell.visible, true, 'B3.bell is visible at 1280x800');
      t.equal(b0.bellRings, 0, 'bell starts un-rung');

      const rect = await t.page.evaluate(() => {
        const r = document.getElementById('board').getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
      });
      const bellX = rect.left + (b0.props.bell.minX + b0.props.bell.maxX) / 2;
      const bellY = rect.top + (b0.props.bell.minY + b0.props.bell.maxY) / 2;
      const missX = rect.left + Math.min(rect.width - 12, b0.props.bell.minX + 10);
      const missY = rect.top + rect.height - 20;

      // 2) Hovering over B3.bell shows pointer cursor without altering #preview; empty counter clears cursor
      const prevBefore = await t.page.textContent('#preview');
      await t.page.mouse.move(bellX, bellY);
      const curOn = await t.page.evaluate(() => document.getElementById('board').style.cursor);
      t.equal(curOn, 'pointer', 'hovering over B3.bell sets pointer cursor');
      t.equal(await t.page.textContent('#preview'), prevBefore, 'hovering over B3.bell leaves #preview undisturbed');
      await t.page.mouse.move(missX, missY);
      const curOff = await t.page.evaluate(() => document.getElementById('board').style.cursor);
      t.equal(curOff, '', 'moving off B3.bell onto empty counter clears pointer cursor');

      // 3) Clicking empty counter misses the bounding sphere
      await t.page.mouse.click(missX, missY);
      const afterMiss = await t.game('act', 'b3');
      t.equal(afterMiss.bellRings, 0, 'clicking empty counter outside B3.bell does not ring');

      // 4) Clicking B3.bell triggers soft 'bell' ding + 180 ms brass plunger bob returning cleanly to y = 0
      const now0 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now0 + 500);
      await t.page.mouse.click(bellX, bellY);
      await t.page.clock.runFor(45);
      const midBob = await t.game('act', 'b3');
      const audioMid = await t.game('audioState');
      t.equal(midBob.bellRings, 1, 'clicking B3.bell increments bellRings');
      t.equal(midBob.bellBob, true, 'brass dome/plunger is visibly depressed mid-bob');
      t.expect(midBob.bellY < -0.02, `brass plunger dipped to y=${midBob.bellY} (< -0.02)`);
      t.expect(midBob.props.bell.worldMinY >= 0, `bell plinth stays anchored on counter (worldMinY=${midBob.props.bell.worldMinY})`);
      t.equal(audioMid.played[audioMid.played.length - 1], 'bell', 'soft brass desk-bell cue fired');
      await t.shot('w4-b10-bell-bob', { wait: false, timeout: 15000 });

      await t.page.clock.runFor(240);
      const afterBob = await t.game('act', 'b3');
      t.equal(afterBob.bellBob, false, 'plunger bob settles back cleanly after 180 ms');
      t.equal(afterBob.bellY, 0, 'brass dome returns to exact rest y = 0');

      // 5) Reduced motion: clicking B3.bell still dings softly with zero plunger bob
      await t.page.clock.resume();
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"][data-val="reduce"]');
      await t.game('scene', 'game');
      await t.waitFrames(3);
      const now1 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now1 + 500);
      await t.page.mouse.click(bellX, bellY);
      await t.page.clock.runFor(45);
      const redBob = await t.game('act', 'b3');
      t.equal(redBob.bellRings, 2, 'reduced motion still allows bell click');
      t.equal(redBob.bellBob, false, 'reduced motion skips plunger bob animation');
      t.equal(redBob.bellY, 0, 'reduced motion keeps brass y = 0');
      await t.page.clock.resume();

      // 6) Narrow desktop (1024x768) where bellFits() hides B3.bell: clicking that corner never rings
      await t.page.setViewportSize({ width: 1024, height: 768 });
      await t.page.waitForFunction(async () => {
        const b = await window.__game.act('b3');
        return b && b.props && b.props.bell && b.props.bell.visible === false;
      }, null, { timeout: 8000 });
      await t.page.mouse.click(Math.min(1010, bellX), bellY);
      const hiddenAfter = await t.game('act', 'b3');
      t.equal(hiddenAfter.bellRings, 2, 'hidden bell at 1024x768 cannot be clicked');
      await t.page.setViewportSize({ width: 1280, height: 800 });
    },
  },
  {
    name: 'W2-S3-05 tapping B3.bell while the computer thinks rings the bell without skipping the computer move',
    viewports: ['desktop'],
    initScript: normal,
    async run(t) {
      await ready(t);
      await t.page.clock.install();
      await t.reload();
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      const b0 = await t.game('act', 'b3');
      if (!t.gpu || !b0 || !b0.on || !b0.props.bell.visible) {
        t.log('software GL active; skipping live 3D bell AI-wait check');
        return;
      }
      const now = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now + 500);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      await t.game('act', 'play');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });

      const rect = await t.page.evaluate(() => {
        const r = document.getElementById('board').getBoundingClientRect();
        return { left: r.left, top: r.top };
      });
      await t.page.mouse.click(rect.left + (b0.props.bell.minX + b0.props.bell.maxX) / 2, rect.top + (b0.props.bell.minY + b0.props.bell.maxY) / 2);
      const st = await t.state();
      const b1 = await t.game('act', 'b3');
      t.equal(b1.bellRings, 1, 'bell rang during computer wait');
      t.equal(st.game.move, 1, 'tapping the desk bell did not skip the computer move');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W2-S3-05 desk-bell audio cue is soft, audible, short, and unclipped solo and in full-volume busy mixes',
    viewports: ['desktop'],
    initScript: seeded,
    async run(t) {
      await ready(t);
      let defPeak = 0, fullPeak = 0, fullPre = 0, maxMs = 0;
      for (let k = 0; k < 12; k++) {
        const d = await t.game('act', 'renderSfx', 'bell', 0.35);
        const f = await t.game('act', 'renderSfx', 'bell', 1.0);
        defPeak = Math.max(defPeak, d.peak);
        fullPeak = Math.max(fullPeak, f.peak);
        fullPre = Math.max(fullPre, f.prePeak);
        maxMs = Math.max(maxMs, d.ms);
      }
      t.expect(defPeak > 0.01 && defPeak < 0.35, `default bell peak ${defPeak} is soft and audible (0.01..0.35)`);
      t.expect(fullPre < 0.95 && fullPeak < 0.95, `full-volume bell unclipped (prePeak=${fullPre}, peak=${fullPeak})`);
      t.expect(maxMs < 1500, `bell cue is short (${maxMs} ms < 1500 ms)`);

      const mixReport = [];
      for (const combo of ['bell+bell@0.18', 'play+featured@0.28+steam+bell', 'play+big@0.28+steam+bell']) {
        let worstPre = 0, worstPeak = 0;
        for (let k = 0; k < 4; k++) {
          const r = await t.game('act', 'renderSfx', combo, 1.0);
          worstPre = Math.max(worstPre, r.prePeak);
          worstPeak = Math.max(worstPeak, r.peak);
        }
        mixReport.push(`${combo}=${worstPre}/${worstPeak}`);
        t.expect(worstPre < 0.95 && worstPeak < 0.95, `full-volume mix ${combo} stays under 0.95 (prePeak=${worstPre}, peak=${worstPeak})`);
      }
      t.log(`W2-S3-05 bell audio: default peak=${defPeak}, full=${fullPre}/${fullPeak}, ms=${maxMs}; mixes: ${mixReport.join(', ')}`);
    },
  },

  // ---------- W2-S4-11 (already_done by a8644f0 regression guard) ----------
  {
    name: 'W2-S4-11 Pause modal stays compact in 2 .row2 pairs with generous backdrop clearance and >=44 px targets',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal' }] });
      await t.waitIdle(8000);
      await t.page.click('#b-menu');

      const geom = await t.page.evaluate(() => {
        const card = document.querySelector('#modal .pause');
        const r = card.getBoundingClientRect();
        const rows = [...card.querySelectorAll('.menu > *')];
        const row2s = card.querySelectorAll('.menu > .row2');
        const btns = [...card.querySelectorAll('button')];
        const minBtnH = Math.min(...btns.map((b) => b.getBoundingClientRect().height));
        return {
          h: Math.round(r.height), w: Math.round(r.width),
          top: Math.round(r.top), bot: Math.round(innerHeight - r.bottom),
          left: Math.round(r.left), right: Math.round(innerWidth - r.right),
          rowCount: rows.length, row2Count: row2s.length, minBtnH: +minBtnH.toFixed(1),
        };
      });
      t.equal(geom.row2Count, 2, 'Pause groups secondary links into 2 .row2 pairs (Steam ledger/Read the board, How to play/Settings)');
      t.expect(geom.rowCount <= 5, `Pause menu has <= 5 rows (${geom.rowCount} vs old 7 single-column rows)`);
      t.expect(geom.minBtnH >= 44, `all Pause buttons >= 44 px (${geom.minBtnH} px)`);
      if (t.viewport === 'desktop') {
        t.expect(geom.h <= 520, `desktop Pause card height ${geom.h} px <= 520 px (65% of 800 px)`);
        t.expect(geom.top >= 120 && geom.bot >= 120, `generous vertical backdrop clearance (top=${geom.top}px, bottom=${geom.bot}px)`);
        t.expect(geom.left >= 300 && geom.right >= 300, `generous horizontal backdrop clearance (left=${geom.left}px, right=${geom.right}px)`);
      }
      t.log(`W2-S4-11 Pause (${t.viewport}): ${geom.w}x${geom.h}, rows=${geom.rowCount} (row2=${geom.row2Count}), margins T/B=${geom.top}/${geom.bot} L/R=${geom.left}/${geom.right}, minBtnH=${geom.minBtnH}`);
    },
  },
];
