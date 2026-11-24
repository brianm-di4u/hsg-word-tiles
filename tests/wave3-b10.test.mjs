// Wave 3, batch W3-B10: W5-S5-01 (focus). 9c7d5cf built the modal and privacy trap, inert, returnFocus and the sheet headings (wave1-b05-a11y);
// 7c4489e and 711369a keep the focus on same-scene edits (wave3-b05). Here: arrow keys in tab lists and radio groups, every dialog end to end,
// and no screen change or rebuilt button that leaves a keyboard player on the page body.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const key = (t, k) => t.page.keyboard.press(k);
// where the focus is: the control's data attributes, its id, or its tag
const at = (t) => t.page.evaluate(() => {
  const a = document.activeElement, d = Object.entries(a.dataset || {}).map(([k, v]) => `${k}=${v}`).join(' ');
  return a === document.body ? 'BODY' : d || a.id || a.tagName;
});
const scene = (t) => t.page.evaluate(() => document.body.dataset.scene);
const enter = async (t, sel) => { await t.page.focus(sel); await key(t, 'Enter'); };
async function game(t, rack) {
  await t.game('newGame', { seed: 2 });
  await t.waitIdle(6000);
  if (rack) {
    const s = await t.state();
    s.game.players[0].rack = rack.split('');
    await t.game('setState', { game: s.game });
    await t.waitIdle(6000);
  }
}
// every tab list and radio group on the page: each has a name, exactly one Tab stop (the chosen one), and its references resolve
const groups = (t) => t.page.evaluate(() => [...document.querySelectorAll('#screen [role="tablist"], #screen [role="radiogroup"]')].map((g) => {
  const items = [...g.querySelectorAll('[role="tab"], [role="radio"]')], stops = items.filter((b) => b.tabIndex === 0);
  const on = items.filter((b) => b.getAttribute('aria-checked') === 'true' || b.getAttribute('aria-selected') === 'true');
  const by = g.getAttribute('aria-labelledby');
  return { name: g.getAttribute('aria-label') || (by && document.getElementById(by)?.textContent.trim()) || '', n: items.length, stops: stops.length, same: on.length === 1 && stops[0] === on[0] };
}));
// open with the focus inside, the page behind inert; Tab and Shift+Tab wrap at both ends
async function trapped(t, what) {
  const look = () => t.page.evaluate(() => {
    const m = document.querySelector('#modal'), list = [...m.querySelectorAll('button:not([disabled]), a[href]')].filter((b) => b.getClientRects().length);
    return { n: list.length, ix: list.indexOf(document.activeElement), inert: document.querySelector('#app').inert && document.querySelector('#screen').inert, role: !!m.querySelector('[role="dialog"][aria-modal="true"]') };
  });
  const l = await look();
  t.expect(l.ix >= 0 && l.inert && l.role, `${what}: focus inside, the page behind inert, a modal dialog (${JSON.stringify(l)})`);
  for (let k = l.ix; k < l.n; k++) await key(t, 'Tab');
  t.equal((await look()).ix, 0, `${what}: Tab wraps from the last control (of ${l.n}) to the first`);
  await key(t, 'Shift+Tab');
  t.equal((await look()).ix, l.n - 1, `${what}: Shift+Tab wraps from the first to the last`);
}
async function escapes(t, what, want) {
  await key(t, 'Escape');
  const r = await t.page.evaluate(() => ({ hidden: document.querySelector('#modal').hidden, inert: document.querySelector('#app').inert || document.querySelector('#screen').inert }));
  t.equal(JSON.stringify(r), JSON.stringify({ hidden: true, inert: false }), `${what}: closed, nothing inert`);
  t.equal(await at(t), want, `${what}: focus back on what opened it`);
}

export const tests = [
  {
    name: 'W5-S5-01 Help tabs: one Tab stop, Left/Right/Home/End move and choose, tab and panel name each other',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('scene', 'help');
      const tabs = await t.page.$$eval('[role="tab"]', (els) => els.map((e) => e.dataset.tab));
      const sel = async (want, why) => {
        t.equal(await at(t), `tab=${want}`, `${why}: focus on ${want}`);
        const r = await t.page.evaluate(() => {
          const on = document.querySelector('[role="tab"][aria-selected="true"]'), p = document.querySelector('[role="tabpanel"]');
          return { tab: on.dataset.tab, panel: !!p.id && on.getAttribute('aria-controls') === p.id, label: document.getElementById(p.getAttribute('aria-labelledby')) === on };
        });
        t.equal(JSON.stringify(r), JSON.stringify({ tab: want, panel: true, label: true }), `${why}: ${want} is chosen and tied to its panel`);
        t.equal(JSON.stringify(await groups(t)), JSON.stringify([{ name: 'How to play', n: tabs.length, stops: 1, same: true }]), `${why}: one Tab stop`);
      };
      await t.page.focus(`[data-tab="${tabs[0]}"]`);
      await sel(tabs[0], 'start');
      const last = tabs.length - 1;
      for (const [k, want] of [['ArrowRight', 1], ['ArrowRight', 2], ['ArrowLeft', 1], ['End', last], ['ArrowRight', 0], ['ArrowLeft', last], ['Home', 0]]) {
        await key(t, k);
        await sel(tabs[want], k);
      }
      for (const k of ['ArrowDown', 'ArrowUp', 'Control+ArrowRight', 'Control+End']) { await key(t, k); await sel(tabs[0], `${k} (left to the browser)`); }
      // the tab it moves to is on screen and clear of the sticky heading, wherever the sheet was scrolled
      await t.page.evaluate(() => { document.querySelector('#screen').scrollTop = 1e6; });
      await key(t, 'ArrowRight');
      t.equal(await t.page.evaluate(() => { const r = document.activeElement.getBoundingClientRect(); return [r.top + 1, r.bottom - 1].map((y) => document.elementFromPoint(r.left + r.width / 2, y)?.dataset.tab).join(); }), `${tabs[1]},${tabs[1]}`, 'the tab is in view');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('w3-b10-help-tabs');
    },
  },
  {
    name: 'W5-S5-01 Settings: every choice is one named Tab stop; arrows, Home and End choose, keep the focus and the scroll, and are saved',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('scene', 'settings');
      const gs = await groups(t);
      t.expect(gs.length >= 9, `${gs.length} groups`);
      for (const g of gs) t.expect(g.name && g.stops === 1 && g.same, `one Tab stop, the chosen one, with a name: ${JSON.stringify(g)}`);
      const set = (k) => t.page.evaluate((k) => String(window.__G.settings[k]), k);
      await t.page.focus('[data-set="text"][data-val="1"]');
      for (const [k, want] of [['ArrowRight', '1.15'], ['ArrowDown', '1.3'], ['ArrowRight', '1'], ['ArrowUp', '1.3'], ['ArrowLeft', '1.15'], ['End', '1.3'], ['Home', '1'], ['Control+End', '1']]) {
        await key(t, k);
        t.equal(await set('text'), want, `${k} sets Text size ${want}`);
        t.equal(await at(t), `set=text val=${want}`, `${k} keeps the focus on it`);
      }
      await t.page.focus('[data-set="townCue"][tabindex="0"]');
      const top = await t.page.evaluate(() => document.querySelector('#screen').scrollTop);
      await key(t, 'End');
      t.equal(await at(t), 'set=townCue val=false', 'the last group too');
      t.equal(await t.page.evaluate(() => document.querySelector('#screen').scrollTop), top, 'without scrolling the sheet');
      t.equal(await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-settings-v1')).townCue), false, 'and it is saved');
      t.equal(await t.page.evaluate(() => { const a = document.activeElement, g = a.parentElement; return `${getComputedStyle(a).outlineStyle} ${getComputedStyle(a).outlineWidth} ${getComputedStyle(g).overflow}`; }), 'solid 3px visible', 'its focus ring shows and the group does not clip it');
      await t.shot('w3-b10-settings');
      // a saved value that is no longer offered still leaves the group reachable
      await t.page.evaluate(() => { window.__G.settings.text = 1.2; });
      await t.game('scene', 'settings');
      t.equal(await t.page.$$eval('[data-set="text"][tabindex="0"]', (els) => els.map((e) => e.dataset.val).join()), '1', 'a value no longer offered: the first choice is the Tab stop');
    },
  },
  {
    name: 'W5-S5-01 Setup: Person or Computer, and the four portraits, move and choose with arrows, Home and End',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('scene', 'setup');
      for (const g of await groups(t)) t.expect(g.name && g.stops === 1 && g.same, `one Tab stop, the chosen one, with a name: ${JSON.stringify(g)}`);
      const seat = () => t.page.evaluate(() => window.__G.setup.seats[1]);
      await t.page.focus('[data-kind="ai"][data-k="1"]');
      for (const [k, want] of [['ArrowLeft', 'human'], ['ArrowLeft', 'ai'], ['Home', 'human'], ['End', 'ai'], ['ArrowUp', 'human'], ['ArrowDown', 'ai'], ['Control+Home', 'ai']]) {
        await key(t, k);
        t.equal((await seat()).kind, want, `${k} makes seat 2 ${want}`);
        t.equal(await at(t), `kind=${want} k=1`, `${k} keeps the focus on it`);
      }
      const ps = await t.page.$$eval('[data-persona="1"]', (els) => els.map((e) => e.dataset.val)), last = ps.length - 1;
      await t.page.focus('[data-persona="1"][tabindex="0"]');
      for (const [k, want] of [['End', last], ['ArrowRight', 0], ['ArrowLeft', last], ['Home', 0]]) {
        await key(t, k);
        t.equal((await seat()).persona, ps[want], `${k} picks ${ps[want]}`);
        t.equal(await at(t), `persona=1 val=${ps[want]}`, `${k} keeps the focus on it`);
      }
      // in the name box those keys belong to the text
      await t.page.focus('[data-name="0"]');
      await t.page.keyboard.type('AB'); await key(t, 'Home'); await t.page.keyboard.type('C');
      t.equal(await t.page.inputValue('[data-name="0"]'), 'CAB', 'Home in the name box moves the caret');
    },
  },
  {
    name: 'W5-S5-01 every dialog in a game traps Tab, makes the page behind inert and hands the focus back',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await game(t, 'SPRING?');
      for (const sub of ['', 'ledger', 'boardtext', 'tracker']) {
        await enter(t, '#b-menu');
        if (sub) await enter(t, `#modal [data-open="${sub}"]`);
        await trapped(t, sub || 'pause');
        await escapes(t, sub || 'pause', 'b-menu');
      }
      for (const act of ['swap', 'pass']) {
        await enter(t, `#actions [data-act="${act}"]`);
        await trapped(t, act);
        await escapes(t, act, `act=${act}`);
      }
      await t.page.focus('#board');
      await t.page.evaluate(() => { window.__G.selected = window.__G.s.players[0].rack.indexOf('?'); });
      await key(t, 'Enter');
      await trapped(t, 'blank');
      await escapes(t, 'blank', 'board');
      await t.page.focus('#board');
      await key(t, 'Shift+U');
      await trapped(t, 'unseen tiles');
      await escapes(t, 'unseen tiles', 'board');
    },
  },
  {
    name: 'W5-S5-01 fact cards on the Register and the Final Soak, and the review give the focus back to their button',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.evaluate(() => localStorage.setItem('hs-letters-register-v1', JSON.stringify({ SPRING: { id: 'spring', first: '2026-11-20', count: 1, best: 24 } })));
      await t.game('scene', 'register');
      await enter(t, '[data-reg="spring"]');
      await trapped(t, 'register fact');
      await escapes(t, 'register fact', 'reg=spring');

      await game(t, 'SPRINGE');
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: 112 + k, l })));
      t.equal((await t.game('act', 'play')).ok, true, 'SPRING played');
      await t.waitIdle(6000);
      // the bag is emptied, so the game ends in a few best plays
      const st = await t.state();
      st.game.bag = [];
      await t.game('setState', { game: st.game });
      for (let n = 0; n < 60; n++) {
        await t.page.waitForFunction(() => { const x = window.__game.getState(); return x.game.over || (x.game.players[x.game.cur].kind === 'human' && !x.aiThinking); }, null, { timeout: 20000 });
        const g = (await t.state()).game;
        if (g.over) break;
        const [mv] = await t.game('act', 'moves', 1);
        const r = mv && (await t.game('act', 'stage', mv.tiles)).ok ? await t.game('act', 'play') : { ok: false };
        if (!r.ok) { await t.game('act', 'recall'); await t.game('act', 'pass'); }
        await t.page.waitForFunction((m) => window.__game.getState().game.move > m, g.move, { timeout: 10000 });
      }
      await t.page.waitForFunction(() => document.body.dataset.scene === 'over', null, { timeout: 15000 });
      t.equal(await t.page.evaluate(() => document.activeElement.tagName), 'H1', 'the Final Soak takes the focus on its heading');
      await t.page.focus('#screen [data-fact]');
      const fact = await at(t);
      await key(t, 'Enter');
      await trapped(t, 'final fact');
      await escapes(t, 'final fact', fact);
      await enter(t, '#screen [data-review]');
      await t.page.waitForSelector('#modal .rv-rate', { timeout: 20000 });
      await trapped(t, 'review');
      await escapes(t, 'review', 'review=');
    },
  },
  {
    name: 'W5-S5-01 no screen change leaves a keyboard player on the page body',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      t.equal(await at(t), 'BODY', 'the title takes no focus when the game starts up');
      for (const s of ['setup', 'help', 'settings', 'register', 'records', 'about']) {
        await enter(t, `#screen [data-go="${s}"]`);
        t.equal(`${await scene(t)} ${await t.page.evaluate(() => document.activeElement.tagName)}`, `${s} H1`, `${s}: focus on its heading`);
        await key(t, 'Escape');
        t.equal(`${await scene(t)} ${await at(t)}`, `title go=${s}`, `${s}: closing it goes back to its button on the title`);
      }
      await t.game('scene', 'title');
      t.equal(await at(t), 'go=about', 'the title drawn again (art or dictionary loaded) keeps the focus');
      await enter(t, '#screen [data-go="setup"]');
      await enter(t, '[data-start]');
      await t.waitIdle(6000);
      t.equal(`${await scene(t)} ${await at(t)}`, 'game board', 'starting a game goes to the board');
      for (const s of ['help', 'settings']) {
        await enter(t, '#b-menu');
        await enter(t, `#modal [data-go="${s}"]`);
        t.equal(`${await scene(t)} ${await t.page.evaluate(() => document.activeElement.tagName)}`, `${s} H1`, `${s} from Pause`);
        await key(t, 'Escape');
        t.equal(`${await scene(t)} ${await at(t)}`, 'game board', `${s} closed: the board`);
      }
      await t.shot('w3-b10-board-focus');
      await enter(t, '#b-menu');
      await enter(t, '#modal [data-go="title"]');
      t.equal(`${await scene(t)} ${await at(t)}`, 'title go=continue', 'quitting goes to Continue');
      await key(t, 'Enter');
      await t.waitIdle(6000);
      t.equal(`${await scene(t)} ${await at(t)}`, 'game board', 'and Continue to the board');
      // Pass-and-Play: the privacy screen still wins
      await enter(t, '#b-menu');
      await enter(t, '#modal [data-go="title"]');
      await enter(t, '#screen [data-go="setup"]');
      await t.page.focus('[data-kind="ai"][data-k="1"]');
      await key(t, 'Home');
      await enter(t, '[data-start]');
      if ((await t.state()).dialog === 'confirm') await enter(t, '#modal [data-ok]');
      await t.waitIdle(6000);
      t.equal(await t.page.evaluate(() => (document.querySelector('#privacy').hidden ? 'open rack' : document.activeElement.hasAttribute('data-reveal') ? 'reveal' : document.activeElement.tagName)), 'reveal', 'the privacy screen has the focus, not the board behind it');
    },
  },
  {
    name: 'W5-S5-01 Swap and Pass confirmed by keyboard leave the focus on the board; with a mouse nothing new is focused and no cursor appears',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await game(t, 'SPRINGE');
      const where = () => t.page.evaluate(() => `${document.activeElement.id || document.activeElement.tagName} cursor=${!!window.__G.cursor.on}`);
      await enter(t, '#actions [data-act="swap"]');
      await key(t, 'Enter');
      await enter(t, '[data-swap-go]');
      await t.waitIdle(6000);
      t.equal(await at(t), 'board', 'Swap');
      await enter(t, '#actions [data-act="pass"]');
      await enter(t, '#modal [data-ok]');
      await t.waitIdle(6000);
      t.equal(await at(t), 'board', 'Pass');
      // a letter typed with an action button focused: the board, so Enter plays rather than pressing that button
      await t.page.focus('#actions [data-act="hint"]');
      await key(t, await t.page.evaluate(() => window.__G.s.players[0].rack.find((l) => l !== '?').toLowerCase()));
      t.equal(await at(t), 'board', 'typing a letter');

      await game(t, 'SPRINGE');
      await t.page.mouse.click(5, 5);
      await t.page.evaluate(() => { document.activeElement.blur(); window.__G.cursor.on = false; });
      await t.page.click('#actions [data-act="swap"]');
      await t.page.click('#modal [data-sw="0"]');
      await t.page.click('[data-swap-go]');
      await t.waitIdle(6000);
      t.equal(await where(), 'BODY cursor=false', 'mouse Swap');
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="help"]');
      await t.page.click('#screen [data-back]');
      await t.waitIdle(6000);
      t.expect(/cursor=false$/.test(await where()), `mouse, back from Help: no keyboard cursor (${await where()})`);
    },
  },
  {
    name: 'W5-S5-01 Leave without saving? cancelled goes back to the Menu button',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await game(t);
      await t.page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('full'); }; });
      await enter(t, '#b-menu');
      await enter(t, '#modal [data-go="title"]');
      t.equal((await t.state()).dialog, 'confirm', 'it asks');
      await trapped(t, 'leave?');
      await escapes(t, 'leave?', 'b-menu');
    },
  },
];
