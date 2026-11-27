// Wave 3, batch W3-B09: W5-P-N01 (keyboard: modifier guards, Escape in form fields, toolbar arrows, focus follows the board cursor)
// and W5-S5-04 (no colour-only cues: themed words under the board, picked Swap tiles).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const CENTER = 112;
async function start(t, rack) {
  await ready(t);
  await t.game('newGame', { seed: 2 });
  await t.waitIdle(6000);
  const s = await t.state();
  s.game.players[0].rack = rack.split('');
  await t.game('setState', { game: s.game });
  await t.waitIdle(6000);
}
// what a key with modifiers does, without letting the browser act on it: sent to the focused element, with whether the game took it
const chord = (t, key, mods) => t.page.evaluate(([key, mods]) => {
  const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods });
  (document.activeElement || document.body).dispatchEvent(e);
  return { taken: e.defaultPrevented, dialog: window.__G.dialog, breakdown: !!window.__G.breakdown, order: window.__G.order.join(''), hints: window.__G.s.players[0].hints, staged: window.__G.staged.map((x) => x.l + (x.blank ? '*' : '')).join() };
}, [key, mods]);
const active = (t) => t.page.evaluate(() => { const a = document.activeElement; return (a.closest('#rack') && 'rack' + a.dataset.pos) || (a.dataset && a.dataset.act) || a.id || a.tagName; });
const cursor = (t) => t.page.evaluate(() => ({ on: window.__G.cursor.on, i: window.__G.cursor.i }));

export const tests = [
  {
    name: 'W5-P-N01 browser shortcuts with Ctrl, Cmd or Alt never shuffle, hint, toggle the breakdown or stamp a blank',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await start(t, 'SPRING?');
      await t.page.focus('#board');
      const base = await chord(t, 'Shift', { shiftKey: true });
      for (const mod of ['ctrlKey', 'metaKey', 'altKey']) {
        for (const k of 'RSPHBU') {
          const r = await chord(t, k, { shiftKey: true, [mod]: true });
          t.equal(JSON.stringify(r), JSON.stringify({ ...base, taken: false }), `${mod}+Shift+${k} is left to the browser`);
        }
      }
      t.equal((await chord(t, 'U', { shiftKey: true })).dialog, 'tracker', 'plain Shift+U still opens Unseen Tiles');
      await t.page.keyboard.press('Escape');

      // the blank dialog: only a plain letter picks
      await t.page.keyboard.press('z'); await t.page.keyboard.press('z');
      t.equal((await t.state()).staged.map((x) => x.l + (x.blank ? '*' : '')).join(), 'Z*', 'a letter pressed twice still uses the blank');
      await t.page.keyboard.press('Backspace');
      await t.page.evaluate(() => { window.__G.selected = window.__G.s.players[0].rack.indexOf('?'); });
      await t.page.keyboard.press('Enter');
      t.equal((await t.state()).dialog, 'blank', 'placing the blank asks for its letter');
      for (const [k, mods] of [['c', { ctrlKey: true }], ['r', { metaKey: true }], ['f', { altKey: true }], ['r', { ctrlKey: true, shiftKey: true }]]) {
        const r = await chord(t, k, mods);
        t.equal(r.dialog, 'blank', `${JSON.stringify(mods)}+${k} leaves the blank dialog open`);
        t.equal(r.taken, false, `${JSON.stringify(mods)}+${k} is left to the browser`);
        t.equal(r.staged, '', `${JSON.stringify(mods)}+${k} stamps nothing`);
      }
      await t.page.keyboard.press('q');
      const s = await t.state();
      t.equal(s.dialog, null, 'a plain letter closes it');
      t.equal(s.staged.map((x) => x.l + (x.blank ? '*' : '')).join(), 'Q*', 'and stamps that letter');
    },
  },
  {
    name: 'W5-P-N01 Escape in a Setup or Help text box or drop-down leaves the control first, then the sheet; checkboxes leave at once',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      const scene = () => t.page.evaluate(() => document.body.dataset.scene);
      const tag = () => t.page.evaluate(() => document.activeElement.tagName);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.evaluate(() => { document.querySelector('.house-rules').open = true; });
      for (const sel of ['[data-name="0"]', '[data-level]', '[data-hints-unl]']) {
        await t.page.focus(sel);
        await t.page.keyboard.press('Escape');
        t.equal(await scene(), 'setup', `Escape in ${sel} keeps the New game sheet`);
        t.equal(await tag(), 'BODY', `Escape in ${sel} leaves the control`);
      }
      await t.page.focus('[data-name="0"]');
      await t.page.keyboard.type('Ruth');
      await t.page.keyboard.press('Escape');
      t.equal(await t.page.inputValue('[data-name="0"]'), 'Ruth', 'the typed name stays');
      t.equal(await t.page.evaluate(() => window.__G.setup.seats[0].name), 'Ruth', 'and is kept for the game');
      await t.page.keyboard.press('Escape');
      t.equal(await scene(), 'title', 'the next Escape closes the sheet');

      await t.page.click('#screen [data-go="setup"]');
      await t.page.focus('[data-hints]');
      await t.page.keyboard.press('Escape');
      t.equal(await scene(), 'title', 'from a checkbox one Escape still closes the sheet');

      await t.game('scene', 'help');
      await t.page.focus('#wc-in');
      await t.page.keyboard.press('Escape');
      t.equal(await scene(), 'help', 'Escape in Check a word keeps Help open');
      await t.page.keyboard.press('Escape');
      t.equal(await scene(), 'title', 'and the next one closes it');
    },
  },
  {
    name: 'W5-P-N01 arrows step inside the rack and action toolbars; on the board they move the cursor and take the focus with it',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await start(t, 'SPRINGE');
      // rack: Left/Right/Home/End step and wrap; the board cursor stays out of it
      await t.page.focus('#rack .rtile[data-pos="0"]');
      for (const [k, want] of [['ArrowRight', 'rack1'], ['ArrowRight', 'rack2'], ['ArrowLeft', 'rack1'], ['End', 'rack6'], ['ArrowRight', 'rack0'], ['ArrowLeft', 'rack6'], ['Home', 'rack0']]) {
        await t.page.keyboard.press(k);
        t.equal(await active(t), want, `${k} in the rack goes to ${want}`);
        t.equal((await cursor(t)).on, false, `${k} in the rack leaves the board cursor off`);
      }
      // Alt+arrows still reorder
      await t.page.keyboard.press('Alt+ArrowRight');
      t.equal(await active(t), 'rack1', 'Alt+Right still moves the tile itself');
      t.equal(await t.page.evaluate(() => window.__G.order.slice(0, 2).join()), '1,0', 'and the rack order changed');
      await t.page.keyboard.press('Alt+ArrowLeft');

      // actions
      const acts = await t.page.$$eval('#actions button:not([disabled])', (els) => els.map((e) => e.dataset.act));
      t.expect(acts.length >= 4, `action buttons (${acts.join()})`);
      await t.page.focus(`#actions [data-act="${acts[0]}"]`);
      for (const [k, want] of [['ArrowRight', acts[1]], ['ArrowLeft', acts[0]], ['ArrowLeft', acts[acts.length - 1]], ['Home', acts[0]], ['End', acts[acts.length - 1]]]) {
        await t.page.keyboard.press(k);
        t.equal(await active(t), want, `${k} in the action bar goes to ${want}`);
      }
      t.equal((await cursor(t)).on, false, 'the board cursor is still off');
      t.equal((await cursor(t)).i, CENTER, 'and has not moved');

      // Up and Down leave a toolbar for the board, and any other arrow press takes the focus along
      await t.page.keyboard.press('ArrowDown');
      t.equal(await active(t), 'board', 'Down from the action bar focuses the board');
      t.equal(JSON.stringify(await cursor(t)), JSON.stringify({ on: true, i: CENTER + 15 }), 'and moves the cursor');
      await t.page.focus('#b-menu');
      await t.page.keyboard.press('ArrowUp');
      t.equal(await active(t), 'board', 'an arrow from the Menu button focuses the board, so Enter cannot open the menu');
      await t.page.keyboard.press('ArrowLeft'); await t.page.keyboard.press('ArrowLeft');
      await t.page.keyboard.type('SPRING');
      await t.page.keyboard.press('Enter');
      await t.waitIdle(6000);
      const s = await t.state();
      t.equal(s.dialog, null, 'Enter opened no menu');
      t.expect(s.game.log.some((e) => e.p === 0 && e.kind === 'play' && e.words.some((w) => w.w === 'SPRING')), 'Enter played SPRING');
    },
  },
  {
    name: 'W5-S5-04 a Hot Springs word under the board carries a steam mark and an outline, an everyday word neither',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await start(t, 'SPRINGE');
      const look = async (word) => {
        await t.game('act', 'recall');
        await t.game('act', 'stage', [...word].map((l, k) => ({ i: CENTER + k, l })));
        return t.page.evaluate(() => [...document.querySelectorAll('#preview .words b')].map((b) => {
          const cs = getComputedStyle(b), svg = b.querySelector('svg'), r = svg && svg.getBoundingClientRect();
          return { w: b.textContent, icon: !!r && r.width >= 10 && r.height >= 10, border: parseFloat(cs.borderTopWidth), style: cs.borderTopStyle };
        }));
      };
      for (const theme of ['light', 'dark']) {
        await t.page.evaluate((th) => { window.__G.settings.theme = th; document.body.classList.toggle('theme-dark', th === 'dark'); }, theme);
        const [spring] = await look('SPRING');
        t.equal(spring.w, 'SPRING', 'the word itself is unchanged');
        t.expect(spring.icon, `${theme}: SPRING shows the steam mark`);
        t.expect(spring.border >= 1 && spring.style === 'solid', `${theme}: SPRING is outlined (${spring.border}px ${spring.style})`);
        await t.checkLayout({ allowScrollY: true });
        await t.shot(`w3-b09-preview-themed-${theme}`);
        const [ring] = await look('RING');
        t.equal(JSON.stringify(ring), JSON.stringify({ w: 'RING', icon: false, border: 0, style: 'none' }), `${theme}: RING is plain`);
      }
    },
  },
  {
    name: 'W5-S5-04 a tile picked in Swap has a check mark and a heavier border, by day, by night and with motion reduced',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await start(t, 'SPRINGE');
      const look = (k) => t.page.evaluate((k) => {
        const el = document.querySelector(`#modal .stile[data-sw="${k}"]`);
        const part = (p) => { const c = getComputedStyle(el, p); return { on: c.content !== 'none', w: parseFloat(c.width) || 0, h: parseFloat(c.height) || 0, line: parseFloat(c.borderRightWidth) || 0, color: c.borderRightColor, bg: c.backgroundColor }; };
        return { border: parseFloat(getComputedStyle(el).borderTopWidth), w: el.offsetWidth, pip: part('::before'), tick: part('::after') };
      }, k);
      const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
      const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
      for (const mode of ['light', 'dark', 'reduce']) {
        await t.page.evaluate((m) => { window.__G.settings.theme = m === 'dark' ? 'dark' : 'light'; document.body.classList.toggle('theme-dark', m === 'dark'); document.body.classList.toggle('reduce', m === 'reduce'); }, mode);
        await t.game('act', 'open', 'swap');
        await t.page.click('#modal .stile[data-sw="1"]');
        await t.page.click('#modal .stile[data-sw="3"]');
        const off = await look(0), on = await look(1);
        t.equal(off.pip.on || off.tick.on, false, `${mode}: a tile not picked has no mark`);
        t.expect(off.border < 2, `${mode}: and a thin border (${off.border})`);
        t.expect(on.border >= 2 * off.border && on.border >= 2.5, `${mode}: the picked tile's border is heavier (${off.border} -> ${on.border})`);
        t.equal(on.w, off.w, `${mode}: the tile keeps its size`);
        t.expect(on.pip.on && on.pip.w >= 16 && on.pip.h >= 16, `${mode}: the pip shows (${on.pip.w} x ${on.pip.h})`);
        t.expect(on.tick.on && on.tick.line >= 2 && on.tick.h >= 8, `${mode}: with a check drawn in it`);
        t.expect(ratio(on.tick.color, on.pip.bg) >= 4.5, `${mode}: check on pip contrast ${ratio(on.tick.color, on.pip.bg).toFixed(2)}`);
        await t.shot(`w3-b09-swap-${mode}`);
        await t.page.click('#modal .stile[data-sw="1"]');
        t.equal((await look(1)).pip.on, false, `${mode}: unpicking takes the mark away`);
        await t.game('act', 'close');
      }
    },
  },
];
