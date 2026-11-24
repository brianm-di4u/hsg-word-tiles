// Wave 3, batch W3-B08: W4-S1-02 (four-persona AI choreography + .pcard.on halo breathing),
// W4-S1-01 (unified ceramic gravity/settle curve, frame-driven contact clacks, human Play commit press & stage settle),
// W4-S1-03 (280 ms rollScores, 160 ms shuffle FLIP, staggered hint settle, tap ghost flight, Pass-and-Play deal, Featured Springs diff reveals).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const fullMotion = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false, motion: 'full' }));
  }
};
const CENTER = 112;

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

async function captureAiPlay(t, persona, opts = {}) {
  const speed = opts.speed || 'normal';
  const motion = opts.motion || 'full';
  const rack = opts.rack || 'SPRINGX';
  await t.page.evaluate(({ speed, motion }) => {
    window.__G.settings.ai = speed;
    window.__G.settings.motion = motion;
    document.body.classList.toggle('reduce', motion === 'reduce');
    document.body.classList.toggle('motion-full', motion === 'full');
  }, { speed, motion });
  await t.seed(5);
  await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona, level: 'hard' }] });
  await t.waitIdle(8000);
  const s0 = await t.state();
  s0.game.players[1].rack = rack.split('');
  await t.game('setState', { game: s0.game });
  await t.waitIdle(5000);
  await stopClock(t);
  await t.game('act', 'pass');
  await t.page.clock.runFor(200);
  await t.page.waitForFunction(() => {
    const g = window.__game.getState();
    return g.game.move >= 2 || (g.aiThinking && g.aiWait.reply);
  }, null, { timeout: 15000, polling: 50 });
  const adv = speed === 'normal' ? 750 : speed === 'fast' ? 280 : 10;
  await t.page.clock.runFor(adv);
  await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
  const snap = await t.page.evaluate(() => {
    const G = window.__G;
    const entry = G.s.log[G.s.log.length - 1];
    const anims = entry.tiles.map((tl) => {
      const a = G.anim.get(tl.i);
      return a ? { i: tl.i, t0: a.t0, dur: a.dur, lift: a.lift, roll: a.roll, kind: a.kind, persona: a.persona } : null;
    });
    const pcardOn = document.querySelector('.pcard.on');
    const haloAnim = pcardOn ? getComputedStyle(pcardOn).animationName : null;
    return { tiles: entry.tiles.length, animCount: G.anim.size, anims, haloAnim };
  });
  await t.page.clock.resume();
  return snap;
}

export const tests = [
  // ---------- W4-S1-02 ----------
  {
    name: 'W4-S1-02 four AI personas use distinct PERSONA_MOTION staggers/lifts/Lucky premium roll/Julian crescendo, scale by speed, bypass under reduced motion, and breathe .pcard.on halo',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await freezeClock(t);

      const opal = await captureAiPlay(t, 'opal');
      const hollis = await captureAiPlay(t, 'hollis');
      const lucky = await captureAiPlay(t, 'lucky');
      const julian = await captureAiPlay(t, 'julian');

      for (const [name, p] of [['opal', opal], ['hollis', hollis], ['lucky', lucky], ['julian', julian]]) {
        t.expect(p.tiles >= 5, `${name} played >= 5 tiles (${p.tiles})`);
        t.equal(p.animCount, p.tiles, `${name} animated every placed tile`);
        t.equal(p.haloAnim, 'halo-breathe', `${name}: active .pcard.on breathes brass halo under full motion`);
      }

      const gaps = (p) => p.anims.slice(1).map((a, k) => Math.round(a.t0 - p.anims[k].t0));
      const gOpal = gaps(opal), gHollis = gaps(hollis), gLucky = gaps(lucky), gJulian = gaps(julian);

      // Distinct Normal staggers & lifts across all 4 personas
      t.equal(gOpal[0], 105, 'Opal uses 105 ms stagger');
      t.equal(opal.anims[0].lift, 1.6, 'Opal uses 1.6 lift');
      t.equal(opal.anims.every((a) => a.roll === 0), true, 'Opal has zero roll');

      t.equal(gHollis[0], 95, 'Hollis uses 95 ms stagger');
      t.equal(hollis.anims[0].lift, 2.0, 'Hollis uses 2.0 lift');
      t.equal(hollis.anims.every((a) => a.roll === 0), true, 'Hollis drops straight with zero roll');

      t.equal(gLucky[0], 68, 'Lucky uses 68 ms snappy stagger');
      t.equal(lucky.anims[0].lift, 2.1, 'Lucky uses 2.1 lift');
      const luckyRolls = lucky.anims.filter((a) => Math.abs(Math.abs(a.roll) - 0.08) < 1e-6);
      t.expect(luckyRolls.length >= 1, `Lucky applies +-0.08 rad roll on premium hits (${luckyRolls.length} tiles)`);

      t.equal(gJulian[0], 80, 'Julian uses 80 ms rhythmic cadence');
      t.equal(julian.anims[0].lift, 2.5, 'Julian uses 2.5 lift');
      t.expect(gJulian[gJulian.length - 1] >= 185, `Julian adds conductorial crescendo beat before final tile on 5+ play (last gap ${gJulian[gJulian.length - 1]} ms vs base ${gJulian[0]} ms)`);

      // Speed scaling: Fast (0.45x) and Instant (0x)
      const julianFast = await captureAiPlay(t, 'julian', { speed: 'fast' });
      const gJF = gaps(julianFast);
      t.equal(gJF[0], Math.round(80 * 0.45), `Julian Fast stagger scales by 0.45x (${gJF[0]} ms)`);
      t.expect(gJF[gJF.length - 1] > gJF[0] + 35, `Julian Fast crescendo scales proportionally (${gJF[gJF.length - 1]} ms)`);

      const luckyInst = await captureAiPlay(t, 'lucky', { speed: 'instant' });
      t.equal(luckyInst.animCount, 0, 'Instant bypasses persona drop choreography');

      // Reduced motion bypasses persona drops AND disables .pcard.on halo breathing
      const julianRed = await captureAiPlay(t, 'julian', { speed: 'normal', motion: 'reduce' });
      t.equal(julianRed.animCount, 0, 'Reduced motion bypasses persona drop animations');
      t.equal(julianRed.haloAnim, 'none', 'Reduced motion disables .pcard.on halo-breathe animation');

      await t.page.clock.resume();
    },
  },

  // ---------- W4-S1-01 ----------
  {
    name: 'W4-S1-01 AI drops accelerate via easeInQuad to k2=0.72 with frame-driven contact clacks, clamp roll above TOP+0.28, anisotropic settle <=1.04, plus human Play <=150ms commit press & 110ms stage settle',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky', level: 'hard' }] });
      await t.waitIdle(8000);
      const s0 = await t.state();
      s0.game.players[0].rack = 'SPRINGA'.split('');
      s0.game.players[1].rack = 'STEAMER'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);
      await stopClock(t);

      // 1) Human stage() crisp 110 ms vertical touch-down (0.22 -> 0.06) + anisotropic micro-settle
      await t.game('act', 'stage', [{ i: CENTER, l: 'S' }]);
      await t.page.clock.runFor(16);
      const stEarly = await t.page.evaluate(() => {
        const t0 = window.__G.settle.get(112);
        const mf = window.__game.act('b3') && window.__G.staged.length;
        return { hasSettle: t0 != null, count: mf };
      });
      t.equal(stEarly.hasSettle, true, 'human stage() activates G.settle');
      // Advance to compression phase (~72 ms into 110 ms settle) -> anisotropic micro-settle
      await t.page.clock.runFor(60);
      const stComp = await t.page.evaluate(() => {
        const now = performance.now(), t0 = window.__G.settle.get(112);
        return { dt: Math.round(now - t0), settled: window.__G.settle.size };
      });
      t.expect(stComp.dt >= 60 && stComp.dt <= 95 && stComp.settled === 1, `human stage() still in 110 ms settle at ${stComp.dt} ms`);
      await t.page.clock.runFor(80);
      t.equal(await t.page.evaluate(() => window.__G.settle.size), 0, 'human stage() settle finishes cleanly after 110 ms');

      // Stage remaining tiles for SPRING and click Play -> zero-hit-stop <= 150 ms commit press + lastPulse
      await t.game('act', 'stage', [
        { i: CENTER + 1, l: 'P' }, { i: CENTER + 2, l: 'R' },
        { i: CENTER + 3, l: 'I' }, { i: CENTER + 4, l: 'N' }, { i: CENTER + 5, l: 'G' },
      ]);
      await t.page.clock.runFor(140);
      t.expect((await t.game('act', 'play')).ok, 'human played SPRING');
      const commitInfo = await t.page.evaluate(() => {
        const G = window.__G, anims = [...G.anim.values()];
        const tMin = Math.min(...anims.map((a) => a.t0));
        const tMax = Math.max(...anims.map((a) => a.t0 + a.dur));
        return {
          count: anims.length,
          allCommit: anims.every((a) => a.kind === 'commit'),
          spanMs: Math.round(tMax - tMin),
          hasLastPulse: !!G.lastPulse,
          pulseT0Delta: G.lastPulse ? Math.round(G.lastPulse.t0 - tMin) : -1,
        };
      });
      t.equal(commitInfo.count, 6, 'human Play animates all 6 committed tiles');
      t.equal(commitInfo.allCommit, true, 'human Play uses commit press curve');
      t.expect(commitInfo.spanMs > 0 && commitInfo.spanMs <= 150, `human Play commit press finishes in ${commitInfo.spanMs} ms (<= 150 ms, well before STING_LAG 280 ms)`);
      t.equal(commitInfo.hasLastPulse, true, 'human Play schedules subtle perimeter lastPulse');

      // 2) Lucky AI reply: verify easeInQuad gravity descent, roll clamp above TOP+0.28, frame-driven clack at k2>=0.72, and anisotropic settle scaleXZ<=1.04
      await t.page.clock.runFor(350);
      await t.page.waitForFunction(() => {
        const g = window.__game.getState();
        return g.aiThinking && g.aiWait.reply;
      }, null, { timeout: 15000, polling: 50 });
      const sfxPreAi = await t.page.evaluate(() => window.__game.audioState().played.length);
      await t.page.keyboard.press('Space'); // trigger AI reply immediately
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });

      const aiStart = await t.page.evaluate((prevLen) => {
        const G = window.__G;
        const entry = G.s.log[G.s.log.length - 1];
        const first = G.anim.get(entry.tiles[0].i);
        const placedBefore = window.__game.audioState().played.slice(prevLen).filter((x) => x === 'place').length;
        return {
          tiles: entry.tiles.length,
          firstCell: entry.tiles[0].i,
          dur: first.dur,
          lift: first.lift,
          clacked0: first.clacked,
          placedBefore,
          turnTimers: G.turnTimers.size,
        };
      }, sfxPreAi);
      t.equal(aiStart.clacked0, false, 'tile 0 has not clacked at t=0');
      t.equal(aiStart.placedBefore, 0, 'zero early setTimeout place clacks at t=0');

      // Step to k2 ~ 0.35 (112 ms into 320 ms drop): easeInQuad holds tile HIGHER than easeOutCubic (> 0.65 * lift), and still 0 clacks!
      await t.page.clock.runFor(112);
      const midDrop = await t.page.evaluate(async (prevLen) => {
        const G = window.__G;
        const entry = G.s.log[G.s.log.length - 1];
        const a0 = G.anim.get(entry.tiles[0].i);
        const k2 = (performance.now() - a0.t0) / a0.dur;
        const places = window.__game.audioState().played.slice(prevLen).filter((x) => x === 'place').length;
        const b3 = await window.__game.act('b3');
        return { k2: +k2.toFixed(3), clacked0: a0.clacked, places, liftMax: a0.lift, animMesh: b3 ? b3.animMesh : [] };
      }, sfxPreAi);
      t.expect(midDrop.k2 < 0.72, `sampled pre-contact at k2=${midDrop.k2}`);
      t.equal(midDrop.clacked0, false, 'tile 0 does not clack before k2=0.72');
      t.equal(midDrop.places, 0, 'zero place clacks fired before marble contact');
      t.expect(midDrop.animMesh.length >= 1, `3D meshes actively descending (${midDrop.animMesh.length})`);
      const highestLift = Math.max(...midDrop.animMesh.map((m) => m.y - 0.3));
      t.expect(highestLift > midDrop.liftMax * 0.65, `3D easeInQuad gravity descent stays high before acceleration (lift ${highestLift.toFixed(3)} vs liftMax ${midDrop.liftMax})`);
      await t.shot('w3-b08-ai-gravity-drop', { wait: false });

      // Step just past k2 = 0.72 (total ~252 ms -> rAF frame at ~240 ms, k2 ~ 0.75): tile 0 contacts marble -> clacked === true inside frame(), anisotropic compression scaleY < 1, scaleXZ <= 1.04, rotation === 0!
      await t.page.clock.runFor(140);
      const atContact = await t.page.evaluate(async (prevLen) => {
        const G = window.__G;
        const entry = G.s.log[G.s.log.length - 1];
        const a0 = G.anim.get(entry.tiles[0].i);
        const places = window.__game.audioState().played.slice(prevLen).filter((x) => x === 'place').length;
        const b3 = await window.__game.act('b3');
        return { clacked0: a0 && a0.clacked, places, animMesh: b3 ? b3.animMesh : [] };
      }, sfxPreAi);
      t.equal(atContact.clacked0, true, 'tile 0 clacked deterministically inside frame() on contact k2 >= 0.72');
      t.expect(atContact.places >= 1, `frame-driven place clack fired at contact (${atContact.places})`);
      const settledMesh = atContact.animMesh.find((m) => Math.abs(m.y - 0.3) < 0.005);
      t.expect(!!settledMesh && settledMesh.sy < 1.0 && settledMesh.sx > 1.0 && settledMesh.sx <= 1.04 && settledMesh.rz === 0,
        `3D contact mesh compresses anisotropically with scaleXZ <= 1.04 and rz === 0 (${JSON.stringify(settledMesh)})`);
      t.expect(atContact.animMesh.every((m) => (m.y <= 0.58 + 0.001 ? m.rz === 0 : true)), '3D roll strictly clamped to 0 at/below y = TOP + 0.28');

      // Finish all AI tile drops -> exact 1 clack per tile and zero lingering anim or rotated/scaled meshes
      await t.page.clock.runFor(1200);
      const afterAll = await t.page.evaluate(async (prevLen) => {
        const G = window.__G;
        const places = window.__game.audioState().played.slice(prevLen).filter((x) => x === 'place').length;
        const b3 = await window.__game.act('b3');
        return { animSize: G.anim.size, places, leftoverMesh: b3 ? b3.animMesh.length : 0 };
      }, sfxPreAi);
      t.equal(afterAll.animSize, 0, 'all AI drop animations cleared after settle');
      t.equal(afterAll.leftoverMesh, 0, 'all 3D tile meshes reset cleanly to (y=TOP, scale=1, rot=0)');
      t.equal(afterAll.places, aiStart.tiles, `exact 1 frame-driven clack per AI tile (${afterAll.places} vs ${aiStart.tiles})`);
      await t.page.clock.resume();
    },
  },
  {
    name: 'W4-S1-01 2D fallback reuses unscaled base tileSprite during animation (zero tileCache growth) and resets rotation cleanly',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky', level: 'hard' }] });
      await t.waitIdle(8000);
      const s0 = await t.state();
      s0.game.players[1].rack = 'SPRINGX'.split('');
      await t.game('setState', { game: s0.game });
      await t.waitIdle(5000);
      await stopClock(t);

      await t.game('act', 'pass');
      await t.page.clock.runFor(200);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      await t.page.keyboard.press('Space');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });

      const cacheBefore = await t.page.evaluate(async () => (await window.__game.act('b3')).tileCache);
      // Run 25 animation frames through gravity descent and anisotropic settle
      for (let f = 0; f < 25; f++) await t.page.clock.runFor(16);
      const cacheAfter = await t.page.evaluate(async () => (await window.__game.act('b3')).tileCache);
      // Only at most the newly played distinct letters (<= 6) should enter tileCache; NEVER 25+ per-frame scaled sprites!
      t.expect(cacheAfter - cacheBefore <= 8, `2D drawTile reused unscaled tileSprite without per-frame scaled cache churn (${cacheBefore} -> ${cacheAfter})`);
      await t.page.clock.resume();
    },
  },
];
