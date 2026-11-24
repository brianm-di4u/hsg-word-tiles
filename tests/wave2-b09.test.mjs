// Wave 2, batch W2-B09: W2-P-N05 (dismissible non-blocking toasts & keep-toast yield during staging/drag/hover).

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const CENTER = 112;
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

async function startWithRack(t, rack) {
  await ready(t);
  await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
  await t.waitIdle(8000);
  if (rack) {
    const s = await t.state();
    s.game.players[0].rack = rack.split('');
    await t.game('setState', { game: s.game });
    await t.waitIdle(5000);
  }
}

export const tests = [
  {
    name: 'W2-P-N05 every toast is click/tap-dismissible, drag & square inspect clear transient toasts, and keep-toasts never mask active #preview',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await startWithRack(t, 'SPRINGE');

      // 1) Non-fact toast (Full Soak / bark): focusable (no tabindex=-1), has close affordance, >= 44 px, and click dismisses immediately
      await t.game('act', 'toast', { kind: 'soak', title: 'Full Soak! +40', sub: 'All seven tiles played.' });
      await t.page.waitForSelector('#toast.on [data-toast-dismiss]', { timeout: 3000 });
      const nf = await t.page.evaluate(() => {
        const b = document.querySelector('#toast [data-toast-dismiss]');
        const r = b.getBoundingClientRect();
        return { tabIndex: b.tabIndex, hasClose: !!b.querySelector('.tx svg'), h: r.height };
      });
      t.equal(nf.tabIndex, 0, 'non-fact toast button is focusable (no tabindex=-1)');
      t.equal(nf.hasClose, true, 'non-fact toast shows subtle close affordance');
      t.expect(nf.h >= 44, `non-fact toast dismiss target >= 44 px (${nf.h.toFixed(1)} px)`);
      const c1 = await t.contrastReport({ selector: '#toast', min: 4.5, largeMin: 3 });
      t.equal(c1.fails.length, 0, `non-fact toast passes WCAG contrast (${JSON.stringify(c1.fails)})`);
      await t.page.click('#toast [data-toast-dismiss]');
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal(await t.page.getAttribute('#toast', 'aria-hidden'), 'true', 'dismissed non-fact toast resets aria-hidden=true');

      // 2) Fact toast also has a dedicated >= 44 px dismiss button that closes without opening the fact card
      await t.game('act', 'toast', { kind: 'themed', title: 'SPRING +10', sub: 'Thermal springs', fact: 'spring', form: 'SPRING' });
      await t.page.waitForSelector('#toast.on .toast-x', { timeout: 3000 });
      const fxH = await t.page.evaluate(() => document.querySelector('#toast .toast-x').getBoundingClientRect().height);
      t.expect(fxH >= 44, `fact toast close button >= 44 px (${fxH.toFixed(1)} px)`);
      await t.page.click('#toast .toast-x');
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal((await t.state()).dialog, null, 'clicking × on a fact toast dismisses it without opening the card');

      // 3) Activating a tile drag clears a transient toast immediately before drop
      await t.game('act', 'toast', { kind: 'bark', title: 'Opal Vance: TEA +18', sub: '“Nice warm cup.”' });
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      const tilePt = await t.game('act', 'rackTile', 0);
      const centerPt = await t.game('act', 'screen', CENTER);
      await t.page.mouse.move(tilePt[0], tilePt[1]);
      await t.page.mouse.down();
      await t.page.mouse.move(centerPt[0], centerPt[1], { steps: 6 });
      await t.page.waitForFunction(() => window.__game.getState().drag && !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal(await t.page.locator('#app.toasting').count(), 0, 'activating drag clears transient toast and restores #preview');
      await t.page.mouse.up();
      await t.game('act', 'recall');
      await t.waitIdle(3000);

      // 4) Inspecting a board square clears a transient toast so #preview shows the square rule
      await t.game('act', 'toast', { kind: 'bark', title: 'Opal Vance: TEA +18', sub: '“Warm as a fresh towel.”' });
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      const [sqX, sqY] = await t.game('act', 'screen', 8); // Superior Bathhouse Row square
      if (t.viewport === 'mobile') await t.tap([sqX, sqY]);
      else await t.page.mouse.move(sqX, sqY);
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on') && /Superior Bathhouse/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
      t.equal(await t.page.locator('#app.toasting').count(), 0, 'square inspection clears transient toast');

      // 5) keep: true Register-completion toast NEVER masks active G.staged live word/score preview:
      // lifts into a slim non-blocking chip above #preview while #preview stays opaque and unobstructed, and stays dismissible
      await t.game('act', 'toast', { kind: 'themed', title: 'The springs: complete', sub: 'All its words are in your Register.', keep: true });
      await t.page.waitForSelector('#toast.on', { timeout: 3000 });
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: CENTER - 2 + k, l })));
      await t.waitFrames(2);
      const keepState = await t.page.evaluate(() => {
        const toast = document.querySelector('#toast');
        const prev = document.querySelector('#preview');
        const pts = prev.querySelector('.pts');
        const tr = toast.getBoundingClientRect();
        const pr = prev.getBoundingClientRect();
        return {
          toastOn: toast.classList.contains('on'),
          keepChip: toast.classList.contains('keep-chip'),
          toasting: document.querySelector('#app').classList.contains('toasting'),
          toastText: toast.textContent,
          prevText: prev.textContent,
          ptsColor: pts ? getComputedStyle(pts).color : null,
          toastBottom: tr.bottom,
          prevTop: pr.top,
          toastInside: tr.top >= 0 && tr.left >= 0 && tr.right <= innerWidth + 1,
        };
      });
      t.equal(keepState.toastOn, true, 'keep: true toast remains visible while staging');
      t.equal(keepState.keepChip, true, 'keep: true toast switches to non-blocking .keep-chip during staging');
      t.equal(keepState.toasting, false, '#app.toasting is NOT set during staging so #preview stays opaque');
      t.expect(/The springs: complete/.test(keepState.toastText), 'keep-toast retains full completion message');
      t.expect(/SPRING/.test(keepState.prevText) && /pts/.test(keepState.prevText), 'live #preview shows staged word and points');
      t.expect(keepState.ptsColor && keepState.ptsColor !== 'rgba(0, 0, 0, 0)', `staged #preview .pts is fully opaque (${keepState.ptsColor})`);
      t.expect(keepState.toastBottom <= keepState.prevTop + 1, `keep-chip (${keepState.toastBottom.toFixed(1)}) sits cleanly above #preview (${keepState.prevTop.toFixed(1)}) with zero overlap`);
      t.equal(keepState.toastInside, true, 'keep-chip stays inside viewport bounds');
      await t.shot('w2-b09-keep-toast-staging', { wait: false });

      // Clicking the keep-chip dismisses it cleanly while staged tiles remain
      await t.page.click('#toast [data-toast-dismiss]');
      await t.page.waitForFunction(() => !document.querySelector('#toast').classList.contains('on'), null, { timeout: 3000 });
      t.equal((await t.state()).staged.length, 6, 'dismissing keep-chip leaves staged tiles intact');
    },
  },
  {
    name: 'W2-S4-01 newcomer Setup defaults to Easy Opal, tucks Difficulty/Unlimited/Challenge inside collapsed House rules, and keeps Start above fold',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      // 1) First-time player (stats.games === 0, no lastSetup) defaults to Easy Opal Vance with collapsed House rules
      await t.page.click('#screen [data-go="setup"]');
      await t.waitFrames(2);
      const setupInfo = await t.page.evaluate(() => {
        const checked = document.querySelector('[data-persona="1"][aria-checked="true"]');
        const hr = document.querySelector('.house-rules');
        const level = document.querySelector('[data-level="1"]');
        const unl = document.querySelector('[data-hints-unl]');
        const chal = document.querySelector('[data-challenge]');
        const start = document.querySelector('.setup [data-start]');
        const foot = document.querySelector('.setup .sheet-foot');
        const scr = document.querySelector('#screen');
        const sr = start ? start.getBoundingClientRect() : null;
        return {
          W: innerWidth, H: innerHeight,
          persona: checked ? checked.dataset.val : null,
          houseOpen: !!(hr && hr.open),
          levelInHouse: !!(hr && level && hr.contains(level)),
          unlInHouse: !!(hr && unl && hr.contains(unl)),
          chalInHouse: !!(hr && chal && hr.contains(chal)),
          startTop: sr ? sr.top : -1,
          startBottom: sr ? sr.bottom : 9999,
          startH: sr ? sr.height : 0,
          footPos: foot ? getComputedStyle(foot).position : '',
          scrollH: scr.scrollHeight,
          clientH: scr.clientHeight,
          overflowX: scr.scrollWidth - scr.clientWidth,
        };
      });
      t.equal(setupInfo.persona, 'opal', 'first-time player defaults to Easy Opal Vance');
      t.equal(setupInfo.houseOpen, false, 'House rules & more options starts collapsed');
      t.equal(setupInfo.levelInHouse, true, 'Difficulty override is inside collapsed House rules disclosure');
      t.equal(setupInfo.unlInHouse, true, 'Unlimited hints select is inside collapsed House rules disclosure');
      t.equal(setupInfo.chalInHouse, true, 'Challenge toggle is inside collapsed House rules disclosure');
      t.expect(setupInfo.startTop >= 0 && setupInfo.startBottom <= setupInfo.H + 0.5, `Start CTA sits cleanly above fold (${setupInfo.startTop.toFixed(1)}..${setupInfo.startBottom.toFixed(1)} <= ${setupInfo.H})`);
      t.expect(setupInfo.startH >= 44, `Start CTA >= 44 px (${setupInfo.startH.toFixed(1)} px)`);
      t.equal(setupInfo.footPos, 'sticky', 'Setup footer is sticky on mobile and desktop');
      if (t.viewport === 'desktop') {
        t.expect(setupInfo.scrollH <= setupInfo.clientH + 8, `1280x800 compact Setup fits cleanly above fold without scrolling (${setupInfo.scrollH} <= ${setupInfo.clientH})`);
      }
      t.expect(setupInfo.overflowX <= 0, `zero horizontal overflow (${setupInfo.overflowX})`);
      await t.shot('w2-b09-setup-newcomer');

      // Starting directly launches a welcoming Easy Opal Vance match
      await t.page.click('#screen [data-start]');
      await t.waitIdle(8000);
      const st = (await t.state()).game;
      t.equal(st.players[1].persona, 'opal', 'started match plays against Opal Vance');
      t.equal(st.players[1].level, 'easy', 'started match plays at Easy difficulty');

      // 2) Returning player (stats.games > 0, no lastSetup) still defaults to Hollis Crane (medium)
      await t.page.evaluate(() => {
        localStorage.removeItem('hs-letters-save-v1');
        const set = JSON.parse(localStorage.getItem('hs-letters-settings-v1') || '{}');
        delete set.lastSetup;
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify(set));
        localStorage.setItem('hs-letters-stats-v1', JSON.stringify({ v: 1, games: 2, wins: 1 }));
      });
      await t.reload();
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      const retPersona = await t.page.getAttribute('[data-persona="1"][aria-checked="true"]', 'data-val');
      t.equal(retPersona, 'hollis', 'returning player with stats.games > 0 and no lastSetup defaults to Hollis Crane');
    },
  },
  {
    name: 'W2-S4-02 trigger-gated 4-beat newcomer coach persists through Turn-2 staging, never auto-expires, teaches Hot Springs & Row on Turn 3, and anchors below board on mobile',
    viewports: ['desktop', 'mobile'],
    initScript: () => {
      window.__TEST_TIPS__ = true;
      if (!localStorage.getItem('hs-letters-settings-v1')) {
        localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, tipsSeen: false }));
      }
    },
    async run(t) {
      await t.page.clock.install();
      await t.reload();
      await ready(t);
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.page.clock.runFor(400);
      await t.waitIdle(8000);

      // On portrait mobile, #coach sits directly beneath #boardwrap and above #preview/#actions, keeping #ledger visible
      if (t.viewport === 'mobile') {
        const pos = await t.page.evaluate(() => {
          const r = (sel) => document.querySelector(sel).getBoundingClientRect();
          const b = r('#boardwrap'), c = r('#coach .coach-card'), p = r('#preview'), a = r('#actions'), l = r('#ledger');
          const btns = [...document.querySelectorAll('#coach button')].map((x) => x.getBoundingClientRect().height);
          return { bBot: b.bottom, cTop: c.top, cBot: c.bottom, pTop: p.top, aTop: a.top, lH: l.height, minBtnH: Math.min(...btns) };
        });
        t.expect(pos.cTop >= pos.bBot - 1, `mobile #coach sits beneath #boardwrap (${pos.cTop.toFixed(1)} >= ${pos.bBot.toFixed(1)})`);
        t.expect(pos.cBot <= pos.pTop + 1, `mobile #coach sits directly above #preview (${pos.cBot.toFixed(1)} <= ${pos.pTop.toFixed(1)})`);
        t.expect(pos.cBot < pos.aTop, `mobile #coach is anchored above #actions (${pos.cBot.toFixed(1)} < ${pos.aTop.toFixed(1)})`);
        t.expect(pos.lH > 0, 'mobile #ledger stays visible instead of hidden while coaching');
        t.expect(pos.minBtnH >= 44, `mobile #coach buttons >= 44 px (${pos.minBtnH.toFixed(1)} px)`);
        const cr = await t.contrastReport({ selector: '#coach', min: 4.5, largeMin: 3 });
        t.equal(cr.fails.length, 0, `mobile #coach passes WCAG contrast (${JSON.stringify(cr.fails)})`);
        await t.shot('w2-b09-coach-mobile-turn1');
      }

      // Beat 1 (Turn 1): start -> stage -> play (advances to Turn 2 discs)
      t.expect(/centre/i.test(await t.page.textContent('#coach p')), 'Turn 1 starts with center Display Spring beat');
      const [m1] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m1.tiles);
      t.expect(/Play|Enter/.test(await t.page.textContent('#coach p')), 'Turn 1 staging shows Play beat');
      await t.game('act', 'play');
      await t.page.clock.runFor(600);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking; }, null, { timeout: 15000 });

      // Beat 2 (Turn 2): multiplier discs — must NOT skip when staging tiles AND must NOT auto-expire after 20s
      const discText = await t.page.textContent('#coach p');
      t.expect(/2L\/3L/.test(discText) && /2W\/3W/.test(discText) && /discs/i.test(discText), `Turn 2 shows multiplier discs beat (${discText})`);
      const [m2] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m2.tiles);
      t.expect(/discs/i.test(await t.page.textContent('#coach p')), 'Turn-2 staging does NOT silently skip the discs beat');
      await t.page.clock.fastForward(20000);
      t.expect(/discs/i.test(await t.page.textContent('#coach p')), 'discs beat never auto-expires after 20s');
      await t.game('act', 'play');
      await t.page.clock.fastForward(600);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking; }, null, { timeout: 15000 });

      // Beat 3 (Turn 3): Hot Springs words & Bathhouse Row hook — persists through staging and never auto-expires
      const townText = await t.page.textContent('#coach p');
      t.expect(/Hot Springs words/.test(townText) && /SPA/.test(townText) && /STEAM/.test(townText) && /TUB/.test(townText) && /Row \+20/.test(townText), `Turn 3 teaches Hot Springs words & Bathhouse Row (${townText})`);
      await t.shot('w2-b09-coach-turn3-town');
      const [m3] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m3.tiles);
      t.expect(/Hot Springs words/.test(await t.page.textContent('#coach p')), 'Turn-3 staging keeps the town/Row beat visible');
      await t.page.clock.fastForward(20000);
      t.expect(/Hot Springs words/.test(await t.page.textContent('#coach p')), 'town/Row beat never auto-expires after 20s');
      await t.game('act', 'play');
      await t.page.clock.fastForward(600);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking; }, null, { timeout: 15000 });

      // Beat 4 (Turn 4): Featured Springs plaques — never auto-expires after 20s, completes on Got it
      const plaqueText = await t.page.textContent('#coach p');
      t.expect(/Plaques/.test(plaqueText) && /\+30/.test(plaqueText), `Turn 4 shows Featured Springs plaque beat (${plaqueText})`);
      t.equal(await t.page.locator('#springs.coach-target').count(), 1, '#springs marked as coach target');
      await t.page.clock.fastForward(20000);
      t.expect(/Plaques/.test(await t.page.textContent('#coach p')), 'plaques beat never auto-expires after 20s (tipsSeen stays false)');
      t.equal((await t.state()).settings.tipsSeen, false, 'tipsSeen stays false until player confirms or completes Turn 4');
      await t.page.click('#coach [data-coach="got"]');
      t.equal(await t.page.locator('#coach .coach-card').count(), 0, 'Got it finishes beat 4');
      t.equal((await t.state()).settings.tipsSeen, true, 'tipsSeen saved after finishing beat 4');
    },
  },
];
