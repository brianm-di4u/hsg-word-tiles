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
];
