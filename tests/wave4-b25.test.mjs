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

  // ---------- W5-S4-01 ----------
  {
    name: 'W5-S4-01 secondary UI controls carry tokenized 60ms hover/active tactile feedback (reduced-motion safe) and Settings [data-tips] disables when !tipsSeen',
    viewports: ['desktop', 'mobile'],
    initScript: fullMotion,
    async run(t) {
      await ready(t);

      // Helper: press pointer on selector (then slide off so click doesn't trigger action) and verify active transform + reduced-motion disable
      const probeActive = async (sel, childSel = null, offSel = null) => {
        const loc = t.page.locator(sel).first();
        await loc.scrollIntoViewIfNeeded();
        const box = await loc.boundingBox();
        t.expect(!!box && box.width >= 20 && box.height >= 20, `${sel} visible (${JSON.stringify(box)})`);
        let off = [2, 2];
        if (offSel) {
          const ob = await t.page.locator(offSel).first().boundingBox();
          if (ob) off = [ob.x + ob.width / 2, ob.y + ob.height / 2];
        }
        const read = () => loc.evaluate((el, cSel) => {
          const target = cSel ? el.querySelector(cSel) : el;
          const cs = getComputedStyle(el), tcs = getComputedStyle(target);
          return {
            top: el.getBoundingClientRect().top,
            dur: cs.transitionDuration,
            tx: tcs.transform,
            filter: cs.filter,
            shadow: cs.boxShadow,
          };
        }, childSel);
        const before = await read();
        await t.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await t.page.mouse.down();
        const during = await read();
        await t.page.mouse.move(off[0], off[1]);
        await t.page.mouse.up();
        t.expect(during.tx !== 'none' && during.tx !== before.tx, `${sel}${childSel ? ' ' + childSel : ''} responds with tactile transform on :active (${during.tx})`);
        if (childSel) t.expect(Math.abs(during.top - before.top) < 0.5, `${sel} button hit box stays stationary on :active (Ruling 30)`);
        // Under body.reduce: transition disabled and :active transform suppressed while non-vestibular filter/shadow stays
        await t.page.evaluate(() => document.body.classList.add('reduce'));
        await t.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await t.page.mouse.down();
        const red = await read();
        await t.page.mouse.move(off[0], off[1]);
        await t.page.mouse.up();
        await t.page.evaluate(() => document.body.classList.remove('reduce'));
        t.equal(red.tx, 'none', `${sel} :active transform suppressed under body.reduce`);
        t.equal(red.dur, '0s', `${sel} transition disabled under body.reduce`);
        return before;
      };

      // 1) Settings: [data-tips] disabled when !st.tipsSeen, plus .seg button active/hover
      await t.game('scene', 'settings');
      await t.waitIdle(4000);
      const tipsBefore = await t.page.evaluate(() => {
        const b = document.querySelector('[data-tips]');
        return { disabled: b.disabled, text: b.textContent.trim(), seen: window.__G.settings.tipsSeen };
      });
      t.equal(tipsBefore.seen, true, 'existing settings profile starts with tipsSeen=true');
      t.equal(tipsBefore.disabled, false, '[data-tips] is enabled when tipsSeen=true');
      await t.page.click('[data-tips]');
      const tipsAfterClick = await t.page.evaluate(() => {
        const b = document.querySelector('[data-tips]');
        return { disabled: b.disabled, text: b.textContent.trim(), seen: window.__G.settings.tipsSeen };
      });
      t.equal(tipsAfterClick.seen, false, 'clicking [data-tips] clears tipsSeen');
      t.equal(tipsAfterClick.disabled, true, '[data-tips] immediately disables once !tipsSeen');
      t.equal(tipsAfterClick.text, 'Tips will show in a game', '[data-tips] updates label');
      // Re-rendering Settings with !tipsSeen keeps [data-tips] rendered disabled from ui.js
      await t.game('scene', 'title');
      await t.game('scene', 'settings');
      t.equal(await t.page.$eval('[data-tips]', (b) => b.disabled), true, 'ui.js renders [data-tips] disabled when !st.tipsSeen');
      await t.page.evaluate(() => { window.__G.settings.tipsSeen = true; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(window.__G.settings)); });

      const segInfo = await probeActive('.seg button:not([aria-checked="true"])');
      t.expect(/0\.06s/.test(segInfo.dur), `.seg button uses --dur-press 60ms (${segInfo.dur})`);

      // 2) Help tabs (.tabs button) & Setup opponent card (.opps .opp)
      await t.game('scene', 'help');
      const tabInfo = await probeActive('.tabs button:not([aria-selected="true"])');
      t.expect(/0\.06s/.test(tabInfo.dur), `.tabs button uses --dur-press 60ms (${tabInfo.dur})`);

      await t.game('scene', 'setup');
      await probeActive('.opps .opp', 'b');

      // 3) Register item (.reg-item button)
      await t.game('scene', 'register');
      await probeActive('.reg-item button', 'b');

      // 4) In-game secondary controls: .iconbtn, .plaque / .springs-bar, #preview .bdbtn, #toast button, Swap .stile
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMRN'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(4000);

      const iconInfo = await probeActive('#b-menu', 'svg');
      t.expect(/0\.06s/.test(iconInfo.dur), `.iconbtn uses --dur-press 60ms (${iconInfo.dur})`);
      if (t.viewport === 'desktop') await probeActive('#springs .plaque', '.pcat');
      else await probeActive('#springs .springs-bar', '.sbar-meta');

      await t.game('act', 'stage', [{ i: 110, l: 'S' }, { i: 111, l: 'T' }, { i: 112, l: 'E' }, { i: 113, l: 'A' }, { i: 114, l: 'M' }]);
      await t.waitFrames(2);
      await probeActive('#preview .bdbtn');
      await t.game('act', 'recall');

      await t.game('act', 'toast', { kind: 'themed', title: 'STEAM +18', sub: 'Valley of Vapors' });
      await t.page.evaluate(() => document.querySelector('#toast')?.getAnimations().forEach((a) => a.finish()));
      await probeActive('#toast button', '.tt');
      await t.page.keyboard.press('Escape'); // dismiss toast (if it opens Pause, close it)
      if ((await t.state()).dialog) await t.game('act', 'close');

      await t.game('act', 'open', 'swap');
      await t.page.evaluate(() => document.querySelector('#modal .dialog')?.getAnimations().forEach((a) => a.finish()));
      await probeActive('#modal .stile', null, '#modal h2');
      await t.game('act', 'close');

      // 5) Final Soak .wchip
      await t.game('act', 'stage', [{ i: 110, l: 'S' }, { i: 111, l: 'T' }, { i: 112, l: 'E' }, { i: 113, l: 'A' }, { i: 114, l: 'M' }]);
      await t.game('act', 'play');
      await t.waitIdle(6000);
      const sEnd = await t.state();
      sEnd.game.scoreless = 3;
      await t.game('setState', { game: sEnd.game });
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 6000 });
      await t.waitIdle(4000);
      await probeActive('.wchip');

      // 6) Verify desktop @media (hover: hover) hover state changes appearance on hover without contrast regression
      if (t.viewport === 'desktop') {
        const wc = t.page.locator('.wchip').first();
        const box = await wc.boundingBox();
        const f0 = await wc.evaluate((el) => getComputedStyle(el).filter);
        await t.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        const f1 = await wc.evaluate((el) => getComputedStyle(el).filter);
        t.expect(f1 !== f0 && /brightness/.test(f1), `desktop hover brightens .wchip (${f0} -> ${f1})`);
        t.equal((await t.contrastReport({ selector: '.over', min: 4.5, largeMin: 3 })).fails.length, 0, 'Final Soak passes contrast on hover');
      }
    },
  },

  // ---------- W5-S4-06 ----------
  {
    name: 'W5-S4-06 damped 260ms walnut-knock #preview.shake decay (-5/+4/-2.5/+1/0), skippable finishGame overTimer (138cd53), and zero-border #boardwrap.coach-target',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = true;
      localStorage.clear();
      localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full', tipsSeen: false }));
    },
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);

      // 1) Coarse #boardwrap.coach-target border/pulse stays removed (W2-S5-01)
      const coach = await t.page.evaluate(() => {
        const bw = document.querySelector('#boardwrap');
        const cs = getComputedStyle(bw);
        return {
          hasClass: bw.classList.contains('coach-target'),
          outlineW: parseFloat(cs.outlineWidth) || 0,
          anim: cs.animationName,
        };
      });
      t.equal(coach.hasClass, true, 'coach still marks #boardwrap for S2-01 semantics');
      t.equal(coach.outlineW, 0, '#boardwrap.coach-target has zero coarse outer outline');
      t.equal(coach.anim, 'none', '#boardwrap.coach-target has zero whole-board pulse');

      // 2) Invalid play triggers 260ms damped walnut-knock shake (-5px / +4px / -2.5px / +1px / 0)
      const s = await t.state();
      s.game.players[0].rack = 'QXZBCDE'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(4000);
      await t.game('act', 'stage', [{ i: 111, l: 'Q' }, { i: 112, l: 'X' }, { i: 113, l: 'Z' }]);
      await t.game('act', 'play');

      const shakeSamples = await t.page.evaluate(() => {
        const el = document.querySelector('#preview');
        const cs = getComputedStyle(el);
        const anim = el.getAnimations().find((a) => a.animationName === 'shake');
        if (!anim) return { hasShake: el.classList.contains('shake'), dur: cs.animationDuration, found: false };
        anim.pause();
        const ms = parseFloat(cs.animationDuration) * 1000;
        const txAt = (frac) => {
          anim.currentTime = ms * frac;
          const m = getComputedStyle(el).transform;
          if (!m || m === 'none') return 0;
          const parts = m.match(/matrix\(([^)]+)\)/);
          return parts ? +parseFloat(parts[1].split(',')[4]).toFixed(2) : 0;
        };
        const out = {
          hasShake: el.classList.contains('shake'),
          dur: cs.animationDuration,
          found: true,
          p0: txAt(0),
          p18: txAt(0.18),
          p40: txAt(0.40),
          p62: txAt(0.62),
          p82: txAt(0.82),
          p100: txAt(1),
        };
        anim.finish();
        return out;
      });
      t.equal(shakeSamples.hasShake, true, '#preview received .shake on invalid play');
      t.equal(shakeSamples.dur, '0.26s', '#preview.shake duration is 260ms (0.26s)');
      t.expect(shakeSamples.found, 'Web Animations captured shake keyframes');
      t.expect(Math.abs(shakeSamples.p0) < 0.1 && Math.abs(shakeSamples.p100) < 0.1, `shake starts and settles at 0px (${shakeSamples.p0}, ${shakeSamples.p100})`);
      t.expect(shakeSamples.p18 <= -4.5 && shakeSamples.p18 >= -5.5, `18% peak is ~-5px (got ${shakeSamples.p18})`);
      t.expect(shakeSamples.p40 >= 3.5 && shakeSamples.p40 <= 4.5, `40% peak is ~+4px (got ${shakeSamples.p40})`);
      t.expect(shakeSamples.p62 <= -2.0 && shakeSamples.p62 >= -3.0, `62% peak is ~-2.5px (got ${shakeSamples.p62})`);
      t.expect(shakeSamples.p82 >= 0.5 && shakeSamples.p82 <= 1.5, `82% peak is ~+1px (got ${shakeSamples.p82})`);
      t.expect(Math.abs(shakeSamples.p18) > Math.abs(shakeSamples.p40) && Math.abs(shakeSamples.p40) > Math.abs(shakeSamples.p62) && Math.abs(shakeSamples.p62) > Math.abs(shakeSamples.p82),
        `strictly damped decay (|${shakeSamples.p18}| > |${shakeSamples.p40}| > |${shakeSamples.p62}| > |${shakeSamples.p82}|)`);

      // Under reduced motion, shake animation is disabled
      await t.page.evaluate(() => document.body.classList.add('reduce'));
      t.equal(await t.page.$eval('#preview', (el) => getComputedStyle(el).animationName), 'none', '#preview.shake disabled under body.reduce');
      await t.page.evaluate(() => document.body.classList.remove('reduce'));

      // 3) finishGame() 900ms overTimer stays cancellable & skippable via Space (138cd53 still holds)
      await t.game('act', 'recall');
      await t.page.clock.install();
      await t.reload();
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      const st2 = await t.state();
      const g = st2.game;
      g.board = g.board.map(() => null);
      g.board[111] = { l: 'C', blank: false }; g.board[112] = { l: 'A', blank: false }; g.board[113] = { l: 'T', blank: false };
      g.bag = []; g.move = 10; g.cur = 0;
      g.players[0].rack = ['S']; g.players[0].score = 100;
      g.players[1].rack = ['E']; g.players[1].score = 80;
      await t.game('setState', { game: g });
      await t.waitIdle(4000);
      const now0 = await t.page.evaluate(() => Date.now());
      await t.page.clock.pauseAt(now0 + 500);
      await t.game('act', 'stage', [{ i: 114, l: 'S' }]);
      await t.game('act', 'play');
      await t.page.clock.runFor(200);
      t.equal(await t.page.evaluate(() => window.__G.scene === 'game' && !!window.__G.overTimer), true, 'finishGame scheduled cancellable 900ms overTimer');
      await t.page.keyboard.press('Space');
      t.equal((await t.state()).scene, 'over', 'Space skipped 900ms overTimer straight to Game Over');
      t.equal(await t.page.evaluate(() => window.__G.overTimer), 0, 'overTimer cleared cleanly');
      await t.page.clock.resume();
    },
  },
];
