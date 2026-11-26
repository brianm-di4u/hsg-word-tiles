// Wave 4, batch W4-B25 (WF-5 ui_mograph): W5-S4-04, W5-S4-01, W5-S4-06, W5-S4-03.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const fullMotion = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', theme: 'light' }));
  }
};

export const tests = [
  // ---------- W5-S4-04 ----------
  {
    name: 'W5-S4-04 :root motion tokens, 120ms .stile transition, fading #toast.on entrance, and instant blur(10px) #privacy (CD-WF5-02)',
    viewports: ['desktop', 'mobile'],
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
      await t.waitIdle(6000);

      // 1) Shared :root motion tokens
      const tokens = await t.page.evaluate(() => {
        const cs = getComputedStyle(document.documentElement);
        return {
          press: cs.getPropertyValue('--dur-press').trim(),
          tile: cs.getPropertyValue('--dur-tile').trim(),
          sheet: cs.getPropertyValue('--dur-sheet').trim(),
          roll: cs.getPropertyValue('--dur-roll').trim(),
          ceramic: cs.getPropertyValue('--ease-ceramic').trim(),
          easePress: cs.getPropertyValue('--ease-press').trim(),
        };
      });
      t.equal(tokens.press, '60ms', ':root --dur-press is 60ms');
      t.equal(tokens.tile, '140ms', ':root --dur-tile is 140ms');
      t.equal(tokens.sheet, '180ms', ':root --dur-sheet is 180ms');
      t.equal(tokens.roll, '280ms', ':root --dur-roll is 280ms');
      t.equal(tokens.ceramic, 'cubic-bezier(0.22, 1, 0.36, 1)', ':root --ease-ceramic matches locked curve');
      t.equal(tokens.easePress, 'cubic-bezier(0.2, 0, 0, 1)', ':root --ease-press matches locked curve');

      // 2) #privacy preserves instant 0 ms blur(10px) anti-peek shield (CD-WF5-02)
      const priv = await t.page.evaluate(() => {
        const el = document.querySelector('#privacy');
        const cs = getComputedStyle(el);
        return {
          hidden: el.hidden,
          anim: cs.animationName,
          transDur: cs.transitionDuration,
          backdrop: cs.backdropFilter,
        };
      });
      t.equal(priv.hidden, false, '#privacy visible on pass-and-play handoff');
      t.equal(priv.anim, 'none', 'CD-WF5-02 #privacy has zero entrance animation');
      t.equal(priv.transDur, '0s', 'CD-WF5-02 #privacy has zero transition delay');
      t.expect(/blur\(10px\)/.test(priv.backdrop || ''), `CD-WF5-02 #privacy preserves blur(10px) (${priv.backdrop})`);

      await t.game('act', 'reveal');

      // 3) .stile carries 120ms transition in full motion and 0s/none under reduced motion
      await t.game('act', 'open', 'swap');
      const stileFull = await t.page.evaluate(() => {
        const st = document.querySelector('#modal .stile');
        const dlg = document.querySelector('#modal .dialog');
        const cs = getComputedStyle(st), dcs = getComputedStyle(dlg);
        return {
          props: cs.transitionProperty,
          durs: cs.transitionDuration,
          dlgAnim: dcs.animationName,
          dlgDur: dcs.animationDuration,
        };
      });
      t.expect(stileFull.props.includes('transform') && /0\.12s/.test(stileFull.durs), `.stile transitions transform in 120ms (${stileFull.props} / ${stileFull.durs})`);
      t.equal(stileFull.dlgAnim, 'sheet', '.dialog uses sheet entrance');
      t.equal(stileFull.dlgDur, '0.18s', '.dialog uses --dur-sheet (180ms)');

      await t.page.evaluate(() => document.body.classList.add('reduce'));
      const stileRed = await t.page.evaluate(() => {
        const cs = getComputedStyle(document.querySelector('#modal .stile'));
        return { prop: cs.transitionProperty, dur: cs.transitionDuration };
      });
      t.expect(stileRed.prop === 'none' || stileRed.dur === '0s', `.stile transition disabled under body.reduce (${stileRed.prop}/${stileRed.dur})`);
      await t.page.evaluate(() => document.body.classList.remove('reduce'));
      await t.game('act', 'close');

      // 4) #toast.on animates opacity 0 -> 1 alongside translateY(8px -> 0) in 180ms, disabled under reduced motion
      await t.game('act', 'toast', { kind: 'themed', title: 'STEAM +18', sub: 'Valley of Vapors' });
      const toastInfo = await t.page.evaluate(() => {
        const el = document.querySelector('#toast');
        const cs = getComputedStyle(el);
        const anim = el.getAnimations()[0];
        if (!anim) return { on: el.classList.contains('on'), name: cs.animationName, dur: cs.animationDuration, hasAnim: false };
        anim.pause();
        const ms = parseFloat(cs.animationDuration) * 1000;
        anim.currentTime = 0;
        const op0 = +parseFloat(getComputedStyle(el).opacity).toFixed(3);
        const tf0 = getComputedStyle(el).transform;
        anim.currentTime = ms * 0.5;
        const opMid = +parseFloat(getComputedStyle(el).opacity).toFixed(3);
        anim.currentTime = ms;
        const op1 = +parseFloat(getComputedStyle(el).opacity).toFixed(3);
        anim.play();
        return { on: el.classList.contains('on'), name: cs.animationName, dur: cs.animationDuration, hasAnim: true, op0, opMid, op1, tf0 };
      });
      t.equal(toastInfo.on, true, '#toast.on visible');
      t.equal(toastInfo.name, 'toastin', '#toast.on runs toastin animation');
      t.equal(toastInfo.dur, '0.18s', '#toast.on uses --dur-sheet (180ms)');
      t.expect(toastInfo.hasAnim && toastInfo.op0 <= 0.05 && toastInfo.opMid > 0.3 && toastInfo.op1 >= 0.99, `#toast.on fades opacity 0 -> 1 (${toastInfo.op0} -> ${toastInfo.opMid} -> ${toastInfo.op1})`);
      t.expect(toastInfo.tf0 !== 'none', `#toast.on translates from 8px (${toastInfo.tf0})`);

      await t.page.evaluate(() => document.body.classList.add('reduce'));
      const toastRed = await t.page.evaluate(() => getComputedStyle(document.querySelector('#toast')).animationName);
      t.equal(toastRed, 'none', '#toast.on animation disabled under body.reduce');
      await t.page.evaluate(() => document.body.classList.remove('reduce'));
    },
  },
];
