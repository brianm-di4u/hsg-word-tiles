// Wave 4, batch W4-B16 (WF-4 animation_craft):
// - W4-S1-06: trigger 180 ms damped spring dip/rock (scale.y + subtle rotation.z) on B3.bell whenever a Featured Spring
//   bell sounds (human & AI touchdown) as well as on desktop click (completes 6ed2eb1 W2-S3-05; bypassed under reduced()).
// - W4-S1-05: already solved by 2f4e95e (W4-S3-02); regression guard here verifies @keyframes pop's 14%-55% full-opacity
//   apex hold, dark-espresso pill badge, and single-.pop collision clearing.
// - W4-P-N05: already solved by afa5962 (W4-S1-01), f851a85 (W6-S6-05), and 800cfd8 (W3-S4-05); covered by wave3-b08,
//   wave3-b22, and wave4-b14.

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const fullMotion = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: true, fx: true, music: false, amb: false, motion: 'full', theme: 'light' }));
  }
};
const CENTER = 112;
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));

export const tests = [
  // ---------- W4-S1-06 ----------
  {
    name: 'W4-S1-06 3D brass desk bell dips and rocks (scale.y + rotation.z) for 180 ms on Featured Spring claims (human & AI touchdown) and clicks, bypassed under reduced motion',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await t.page.clock.install();
      await t.reload();
      await ready(t);
      await t.seed(41);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      await t.waitIdle(8000);
      await t.waitFrames(3);

      const b0 = await t.game('act', 'b3');
      if (!t.gpu || !b0 || !b0.on) {
        t.log('software GL active; skipping live 3D desk-bell animation assertions');
        return;
      }

      // Preserve CD-WF2-06 tightened desktop framing
      const boardH = (b0.bezel.maxY - b0.bezel.minY) / b0.bezel.H;
      t.expect(b0.fit < 35.8 && boardH >= 0.90, `CD-WF2-06 desktop framing preserved (fit=${b0.fit.toFixed(2)}, boardH=${(boardH * 100).toFixed(1)}%)`);
      t.equal(b0.props.bell.visible, true, 'B3.bell visible on 1280x800 desktop');
      t.equal(b0.bellRings, 0, 'bell starts un-rung');

      // 1) Human claims a Featured Spring -> 180 ms damped dip (position.y, scale.y) + rock (rotation.z) reversing across half-cycles, then exact rest
      const s0 = await t.state();
      s0.game.featured[0] = { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null };
      s0.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);
      const now0 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now0 + 500);

      await t.game('act', 'stage', across('STEAM'));
      t.expect((await t.game('act', 'play')).ok, 'human claimed Featured Spring STEAM');
      await t.page.clock.runFor(45);
      const dip1 = await t.game('act', 'b3');
      const audio1 = await t.game('audioState');
      t.equal(dip1.bellRings, 1, 'Featured Spring claim rang B3.bell');
      t.equal(dip1.bellBob, true, 'B3.bell actively animating at 45 ms');
      t.expect(dip1.bellY < -0.02, `plunger dipped at 45 ms (bellY=${dip1.bellY})`);
      t.expect(dip1.bellScaleY < 0.98, `bell compressed along scale.y at 45 ms (scaleY=${dip1.bellScaleY})`);
      t.expect(dip1.bellRotZ > 0.01, `bell rocked positively in rotation.z at 45 ms (rotZ=${dip1.bellRotZ})`);
      t.expect(dip1.props.bell.worldMinY >= 0, `bronze plinth stays anchored on counter (worldMinY=${dip1.props.bell.worldMinY})`);
      t.expect(audio1.played.includes('featured'), 'featured audio cue fired alongside bell animation');
      await t.shot('w4-b16-bell-featured-dip', { wait: false, timeout: 15000 });

      await t.page.clock.runFor(45);
      const dip2 = await t.game('act', 'b3');
      t.expect(dip2.bellRotZ < -0.008, `damped spring rock reverses sign at 90 ms (rotZ=${dip2.bellRotZ})`);

      await t.page.clock.runFor(150);
      const rest1 = await t.game('act', 'b3');
      t.equal(rest1.bellBob, false, 'bell settles cleanly after 180 ms');
      t.equal([rest1.bellY, rest1.bellScaleY, rest1.bellRotZ], [0, 1, 0], 'bell returns to exact rest transform (y=0, scaleY=1, rotZ=0)');

      // 2) AI claims a Featured Spring at Normal speed -> stays still mid-flight, then dips/rocks in sync with touchdown
      await t.page.clock.resume();
      await t.seed(42);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      await t.waitIdle(8000);
      const s1 = await t.state();
      s1.game.featured[0] = { id: 'spring', word: 'SPRING', cat: 'springs', shown: [0, 1, 2, 3, 4], by: null, at: null };
      s1.game.players[1].rack = 'SPRINGX'.split('');
      await t.game('setState', { game: s1.game });
      await t.waitIdle(5000);
      const ringsBeforeAi = (await t.game('act', 'b3')).bellRings;
      const now1 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now1 + 500);

      await t.game('act', 'pass');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      await t.page.keyboard.press('Space'); // start AI drop flight
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });

      const aiMid = await t.game('act', 'b3');
      const aiFeatured = await t.page.evaluate(() => {
        const log = window.__game.getState().game.log;
        return log[log.length - 1]?.featured || null;
      });
      t.equal(aiFeatured, 'SPRING', 'AI played Featured Spring SPRING');
      t.equal(aiMid.bellRings, ringsBeforeAi, 'B3.bell does not ring prematurely while AI tiles are still in flight');
      t.equal(aiMid.bellBob, false, 'B3.bell stays still while AI tiles are in flight');

      // Advance to touchdown (~750 ms for Julian 6-tile SPRING) + 40 ms into the 180 ms bell dip
      await t.page.clock.runFor(810);
      const aiLand = await t.game('act', 'b3');
      t.equal(aiLand.bellRings, ringsBeforeAi + 1, 'B3.bell rang in sync with AI Featured Spring touchdown');
      t.equal(aiLand.bellBob, true, 'B3.bell animating at AI touchdown');
      t.expect(aiLand.bellScaleY < 0.99 && Math.abs(aiLand.bellRotZ) > 0.004, `AI touchdown drives dip/rock (scaleY=${aiLand.bellScaleY}, rotZ=${aiLand.bellRotZ})`);

      await t.page.clock.runFor(240);
      const aiRest = await t.game('act', 'b3');
      t.equal(aiRest.bellBob, false, 'bell settles cleanly after AI Featured Spring');
      t.equal([aiRest.bellY, aiRest.bellScaleY, aiRest.bellRotZ], [0, 1, 0], 'bell returns to exact rest after AI Featured Spring');

      // 3) Reduced motion: Featured Spring claim bypasses B3.bell animation completely
      await t.page.clock.resume();
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"][data-val="reduce"]');
      await t.game('scene', 'game');
      await t.seed(43);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'human', name: 'P2' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const s2 = await t.state();
      s2.game.featured[0] = { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null };
      s2.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: s2.game });
      await t.waitIdle(5000);
      const ringsBeforeRed = (await t.game('act', 'b3')).bellRings;
      const now2 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now2 + 500);

      await t.game('act', 'stage', across('STEAM'));
      t.expect((await t.game('act', 'play')).ok, 'human claimed STEAM under reduced motion');
      await t.page.clock.runFor(45);
      const redBell = await t.game('act', 'b3');
      t.equal(redBell.bellRings, ringsBeforeRed, 'reduced motion bypasses Featured Spring bell trigger');
      t.equal(redBell.bellBob, false, 'reduced motion keeps B3.bell static');
      t.equal([redBell.bellY, redBell.bellScaleY, redBell.bellRotZ], [0, 1, 0], 'reduced motion keeps exact rest transform');

      // 4) Full motion restored: desktop click on B3.bell also runs the 180 ms damped dip + rock
      await t.page.clock.resume();
      await t.game('scene', 'settings');
      await t.page.click('[data-set="motion"][data-val="full"]');
      await t.game('scene', 'game');
      await t.game('act', 'reveal');
      await t.waitFrames(3);
      const bClick0 = await t.game('act', 'b3');
      const rect = await t.page.evaluate(() => {
        const r = document.getElementById('board').getBoundingClientRect();
        return { left: r.left, top: r.top };
      });
      const bellX = rect.left + (bClick0.props.bell.minX + bClick0.props.bell.maxX) / 2;
      const bellY = rect.top + (bClick0.props.bell.minY + bClick0.props.bell.maxY) / 2;
      const now3 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now3 + 500);
      await t.page.mouse.click(bellX, bellY);
      await t.page.clock.runFor(45);
      const clickDip = await t.game('act', 'b3');
      t.equal(clickDip.bellRings, bClick0.bellRings + 1, 'desktop click rang B3.bell');
      t.expect(clickDip.bellScaleY < 0.98 && clickDip.bellRotZ > 0.01, `desktop click drives dip + rock (scaleY=${clickDip.bellScaleY}, rotZ=${clickDip.bellRotZ})`);
      await t.page.clock.runFor(200);
      const clickRest = await t.game('act', 'b3');
      t.equal([clickRest.bellBob, clickRest.bellY, clickRest.bellScaleY, clickRest.bellRotZ], [false, 0, 1, 0], 'desktop click bell settles cleanly to rest');
      await t.page.clock.resume();
    },
  },

  // ---------- W4-S1-05 (already_done by 2f4e95e regression guard) ----------
  {
    name: 'W4-S1-05 @keyframes pop holds full opacity across 14%-55% apex plateau inside dark-espresso pill and clears colliding live pops',
    viewports: ['desktop'],
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await t.seed(11);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const s = await t.state();
      s.game.players[0].rack = 'SPRINGA'.split('');
      s.game.players[1].rack = 'SPATUBX'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);

      await t.game('act', 'stage', across('SPRING'));
      t.expect((await t.game('act', 'play')).ok, 'SPRING played');

      const samples = await t.page.evaluate(() => {
        const el = document.querySelector('#boardwrap .pop');
        if (!el) return null;
        const cs = getComputedStyle(el);
        const anim = el.getAnimations()[0];
        const ms = parseFloat(cs.animationDuration) * 1000;
        anim.pause();
        const at = (frac) => {
          anim.currentTime = ms * frac;
          const st = getComputedStyle(el);
          return { frac, op: +parseFloat(st.opacity).toFixed(3), tf: st.transform };
        };
        return {
          bg: cs.backgroundColor,
          radius: parseFloat(cs.borderTopLeftRadius),
          p0: at(0), p14: at(0.14), p35: at(0.35), p55: at(0.55), p85: at(0.85), p100: at(0.999),
        };
      });
      t.expect(!!samples && /rgba?\(24,\s*16,\s*10/.test(samples.bg) && samples.radius >= 20, `dark-espresso pill style active (${samples && samples.bg})`);
      t.expect(samples.p0.op <= 0.05, `starts faded in at 0% (op=${samples.p0.op})`);
      t.expect(samples.p14.op >= 0.99, `reaches full opacity at 14% peak (op=${samples.p14.op})`);
      t.expect(samples.p35.op >= 0.99, `holds full opacity mid-apex at 35% (op=${samples.p35.op})`);
      t.expect(samples.p55.op >= 0.99, `holds full opacity through 55% apex hang (op=${samples.p55.op})`);
      t.expect(samples.p85.op < 0.65 && samples.p100.op <= 0.05, `fades out cleanly after 55% (85%=${samples.p85.op}, 100%=${samples.p100.op})`);

      // Consecutive play clears prior live .pop so pops never collide
      await t.game('act', 'reveal');
      await t.game('act', 'stage', [{ i: CENTER - 2 + 15, l: 'P' }, { i: CENTER - 2 + 30, l: 'A' }]);
      t.expect((await t.game('act', 'play')).ok, 'consecutive play SPA succeeded');
      t.equal(await t.page.locator('#boardwrap .pop').count(), 1, 'prior .pop dismissed on consecutive play');
    },
  },
];
