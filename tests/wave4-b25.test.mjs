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
      // ruling 30 (W4-B33-hotfix): the picked tile no longer moves its own hit box; it stands up on a deeper shadow that eases in over 120 ms.
      // Old assertion: '.stile transitions transform in 120ms'
      t.expect(stileFull.props.includes('box-shadow') && !stileFull.props.includes('transform') && /0\.12s/.test(stileFull.durs), `.stile eases its shadow in 120ms and never transitions transform (${stileFull.props} / ${stileFull.durs})`);
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

      // ruling 30 (W4-B33-hotfix): these presses move the label's span, so the button's hit box is checked to stay put (old: the button itself)
      const segInfo = await probeActive('.seg button:not([aria-checked="true"])', 'span');
      t.expect(/0\.06s/.test(segInfo.dur), `.seg button uses --dur-press 60ms (${segInfo.dur})`);

      // 2) Help tabs (.tabs button) & Setup opponent card (.opps .opp)
      await t.game('scene', 'help');
      const tabInfo = await probeActive('.tabs button:not([aria-selected="true"])', 'span');
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
      await probeActive('#preview .bdbtn', 'span');
      await t.game('act', 'recall');

      await t.game('act', 'toast', { kind: 'themed', title: 'STEAM +18', sub: 'Valley of Vapors' });
      await t.page.evaluate(() => document.querySelector('#toast')?.getAnimations().forEach((a) => a.finish()));
      await probeActive('#toast button', '.tt');
      await t.page.keyboard.press('Escape'); // dismiss toast (if it opens Pause, close it)
      if ((await t.state()).dialog) await t.game('act', 'close');

      await t.game('act', 'open', 'swap');
      await t.page.evaluate(() => document.querySelector('#modal .dialog')?.getAnimations().forEach((a) => a.finish()));
      // ruling 30 (W4-B33-hotfix): a swap tile's press darkens it and sinks its shadow; nothing moves (old: a transform on the tile itself)
      {
        const st = t.page.locator('#modal .stile').first();
        const box = await st.boundingBox(), hb = await t.page.locator('#modal h2').first().boundingBox();
        const read = () => st.evaluate((el) => { const cs = getComputedStyle(el), r = el.getBoundingClientRect(); return { top: r.top, left: r.left, w: r.width, h: r.height, tx: cs.transform, filter: cs.filter, shadow: cs.boxShadow }; });
        const before = await read();
        await t.page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
        await t.page.mouse.down();
        const during = await read();
        await t.page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
        await t.page.mouse.up();
        t.expect(during.filter !== before.filter && during.shadow !== before.shadow, `#modal .stile responds on :active (${during.filter}; ${during.shadow})`);
        t.expect(during.tx === 'none' && Math.abs(during.top - before.top) < 0.5 && Math.abs(during.left - before.left) < 0.5 && Math.abs(during.w - before.w) < 0.5, `#modal .stile hit box stays stationary on :active (Ruling 30)`);
      }
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
      await probeActive('.wchip', 'span');

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

  // ---------- W5-S4-03 ----------
  {
    name: 'W5-S4-03 Pause sub-dialog switches reuse persistent #modal scrim & card without replaying sheet entrance, synchronous 0ms closeDialog (CD-WF5-02), and shared <=140ms flyGhost',
    viewports: ['desktop', 'mobile'],
    initScript: fullMotion,
    async run(t) {
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      const s = await t.state();
      s.game.players[0].rack = 'STEAMRN'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(4000);

      // Play STEAM so Steam ledger also has a clickable Hot Springs fact chip
      await t.game('act', 'stage', [{ i: 110, l: 'S' }, { i: 111, l: 'T' }, { i: 112, l: 'E' }, { i: 113, l: 'A' }, { i: 114, l: 'M' }]);
      t.expect((await t.game('act', 'play')).ok, 'played STEAM');
      await t.waitIdle(6000);

      // 1) Fresh Pause open: plays outer sheet entrance, !switched
      await t.page.click('#b-menu');
      const pauseOpen = await t.page.evaluate(() => {
        const m = document.querySelector('#modal');
        const card = m.querySelector('.card.dialog');
        window.__w5ModalCard = card;
        return {
          dialog: window.__G.dialog,
          switched: m.classList.contains('switched'),
          anim: card ? getComputedStyle(card).animationName : null,
          labelledby: card ? card.getAttribute('aria-labelledby') : null,
        };
      });
      t.equal(pauseOpen.dialog, 'pause', 'Pause opened');
      t.equal(pauseOpen.switched, false, 'fresh Pause open is not marked switched');
      t.equal(pauseOpen.anim, 'sheet', 'fresh Pause open plays outer sheet entrance');
      t.equal(pauseOpen.labelledby, 'pause-h', 'Pause sets aria-labelledby="pause-h"');

      // 2) Switch Pause -> Steam ledger -> Back -> Unseen tiles -> Back -> Read the board -> Back
      for (const [target, lblId] of [['ledger', 'ledger-h'], ['tracker', 'tk-h'], ['boardtext', 'bt-h']]) {
        await t.page.click(`#modal [data-open="${target}"]`);
        const sub = await t.page.evaluate(() => {
          const m = document.querySelector('#modal');
          const card = m.querySelector('.card.dialog');
          return {
            dialog: window.__G.dialog,
            sameNode: card === window.__w5ModalCard,
            switched: m.classList.contains('switched'),
            anim: card ? getComputedStyle(card).animationName : null,
            labelledby: card ? card.getAttribute('aria-labelledby') : null,
            holds: window.__game.audioState().holds,
          };
        });
        t.equal(sub.dialog, target, `switched to ${target}`);
        t.equal(sub.sameNode, true, `${target} reused the persistent .card.dialog DOM node`);
        t.equal(sub.switched, true, `#modal keeps .switched on ${target}`);
        t.equal(sub.anim, 'none', `${target} does not replay outer sheet entrance`);
        t.equal(sub.labelledby, lblId, `${target} updates aria-labelledby to ${lblId}`);
        t.equal(sub.holds.includes('pause'), false, `${target} released pause audio hold`);

        await t.page.click('#modal [data-open="pause"]');
        const back = await t.page.evaluate(() => {
          const m = document.querySelector('#modal');
          const card = m.querySelector('.card.dialog');
          return {
            dialog: window.__G.dialog,
            sameNode: card === window.__w5ModalCard,
            switched: m.classList.contains('switched'),
            anim: card ? getComputedStyle(card).animationName : null,
            labelledby: card ? card.getAttribute('aria-labelledby') : null,
          };
        });
        t.equal(back.dialog, 'pause', `Back from ${target} returned to Pause`);
        t.equal(back.sameNode, true, `Back from ${target} reused persistent .card.dialog node`);
        t.equal(back.switched, true, `Back from ${target} keeps #modal.switched`);
        t.equal(back.anim, 'none', `Back from ${target} does not replay outer sheet entrance`);
        t.equal(back.labelledby, 'pause-h', 'Back restored aria-labelledby="pause-h"');
      }

      // 3) Switch Pause -> Steam ledger -> Fact card: keeps #modal.switched so .fact does not replay outer sheet entrance
      await t.page.click('#modal [data-open="ledger"]');
      await t.page.click('#modal [data-fact="steam"]');
      const factSw = await t.page.evaluate(() => {
        const m = document.querySelector('#modal');
        const fact = m.querySelector('.fact');
        return {
          dialog: window.__G.dialog,
          switched: m.classList.contains('switched'),
          anim: fact ? getComputedStyle(fact).animationName : null,
        };
      });
      t.equal(factSw.dialog, 'fact', 'opened fact card from Steam ledger');
      t.equal(factSw.switched, true, 'Ledger -> Fact keeps #modal.switched');
      t.equal(factSw.anim, 'none', 'Ledger -> Fact does not replay outer sheet entrance');

      // 4) Synchronous 0 ms closeDialog() teardown (CD-WF5-02)
      const syncClose = await t.page.evaluate(() => {
        const btn = document.querySelector('#modal [data-close]');
        btn.click();
        const m = document.querySelector('#modal');
        return {
          dialog: window.__G.dialog,
          hidden: m.hidden,
          switched: m.classList.contains('switched'),
          inert: document.querySelector('#app').inert,
          html: m.innerHTML,
        };
      });
      t.equal(syncClose.dialog, null, 'CD-WF5-02 closeDialog clears G.dialog synchronously in 0 ms');
      t.equal(syncClose.hidden, true, 'CD-WF5-02 closeDialog hides #modal synchronously in 0 ms');
      t.equal(syncClose.switched, false, 'closeDialog clears #modal.switched');
      t.equal(syncClose.inert, false, 'CD-WF5-02 closeDialog removes #app.inert synchronously in 0 ms');
      t.equal(syncClose.html, '', 'closeDialog empties #modal synchronously');

      // 5) Fresh re-open after close replays outer sheet entrance cleanly
      await t.page.click('#b-menu');
      const reopen = await t.page.evaluate(() => ({
        switched: document.querySelector('#modal').classList.contains('switched'),
        anim: getComputedStyle(document.querySelector('#modal .card.dialog')).animationName,
      }));
      t.equal(reopen.switched, false, 'fresh re-open after close clears .switched');
      t.equal(reopen.anim, 'sheet', 'fresh re-open after close plays outer sheet entrance');
      await t.game('act', 'close');

      // 6) Shared <=140ms Frame-1-interruptible flyGhost: tap-to-place, single unstage(), and blocked board return
      const emptyCell = await t.page.evaluate(() => window.__G.s.board.findIndex((x, i) => !x && i >= 60 && i < 160));
      const r0 = await t.game('act', 'rackTile', 0);
      const cellPt = await t.game('act', 'screen', emptyCell);
      await t.page.mouse.click(r0[0], r0[1]); // select tile
      await t.page.mouse.click(cellPt[0], cellPt[1]); // tap-to-place -> 120ms flyGhost
      const tapFly = await t.page.evaluate(() => {
        const gh = document.querySelector('#ghost');
        return { visible: !gh.hidden, tr: gh.style.transition };
      });
      t.equal(tapFly.visible, true, 'tap-to-place runs #ghost flight');
      t.expect(/120ms/.test(tapFly.tr), `tap-to-place uses <=140ms flyGhost (${tapFly.tr})`);

      // Single unstage() via tap on staged tile -> 130ms flyGhost, interruptible on Frame 1
      await t.page.mouse.click(cellPt[0], cellPt[1]);
      const unFly = await t.page.evaluate(() => {
        const gh = document.querySelector('#ghost');
        return { visible: !gh.hidden, tr: gh.style.transition, returning: window.__G.returning };
      });
      t.equal(unFly.visible, true, 'single unstage runs #ghost flight');
      t.expect(/130ms/.test(unFly.tr), `single unstage uses <=140ms flyGhost (${unFly.tr})`);
      t.expect(unFly.returning != null, 'single unstage hides destination rack tile during flight');

      // Blocked board drop -> 140ms shared flyGhost back to origin cell
      await t.game('act', 'stage', [{ i: emptyCell, l: (await t.state()).game.players[0].rack[0] }]);
      const occPt = await t.game('act', 'screen', 112); // occupied by STEAM
      await t.page.mouse.move(cellPt[0], cellPt[1]);
      await t.page.mouse.down();
      await t.page.mouse.move(occPt[0], occPt[1], { steps: 6 });
      await t.page.mouse.up();
      const blkFly = await t.page.evaluate((ci) => {
        const gh = document.querySelector('#ghost');
        return { visible: !gh.hidden, tr: gh.style.transition, retCell: window.__G.returningCell, want: ci };
      }, emptyCell);
      t.equal(blkFly.visible, true, 'blocked board drop runs shared flyGhost');
      t.equal(blkFly.retCell, emptyCell, 'blocked board drop tracks G.returningCell');
      t.expect(/140ms/.test(blkFly.tr), `blocked board return uses <=140ms flyGhost (${blkFly.tr})`);
      // Frame-1 interrupt on boardDown clears ghost immediately
      await t.page.mouse.move(cellPt[0], cellPt[1]);
      await t.page.mouse.down();
      t.equal(await t.page.evaluate(() => document.querySelector('#ghost').hidden && window.__G.returningCell === null), true, 'blocked board flyGhost interrupted cleanly on Frame 1');
      await t.page.mouse.up();
    },
  },
];
