// Wave 3, batch W3-B22: W6-S6-01 (the results wait for an open menu, card or sheet), W6-P-N03 (par found after the game, off the
// main thread), W6-S6-03 (nothing left on the GPU, a real context loss), W6-S6-05 (board sprites by bucket, one relayout a frame).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
const scene = async (t) => (await t.state()).scene;
const until = (t, f) => t.page.waitForFunction(f, null, { timeout: 15000 });
const b3 = (t) => t.game('act', 'b3');

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }
// a game whose last tile has just been played: the results are due in 900 ms
async function lastPlay(t) {
  await t.page.clock.resume();
  await t.seed(5);
  await t.game('newGame', { seats: SEATS });
  await t.waitIdle(8000);
  const g = (await t.state()).game;
  g.board = Array(225).fill(null);
  g.board[111] = { l: 'C', blank: false }; g.board[112] = { l: 'A', blank: false }; g.board[113] = { l: 'T', blank: false };
  g.bag = []; g.move = 10; g.cur = 0;
  g.players[0].rack = ['S']; g.players[0].score = 120; g.players[1].rack = ['E', 'R']; g.players[1].score = 80;
  await t.game('setState', { game: g });
  await t.waitIdle(5000);
  await stopClock(t);
  t.expect((await t.game('act', 'stage', [{ i: 114, l: 'S' }])).ok && (await t.game('act', 'play')).ok, 'the last tile is played');
  await t.page.clock.runFor(200);
  t.expect(await t.page.evaluate(() => window.__G.scene === 'game' && !!window.__G.overTimer), 'the results are on their way');
}

export const tests = [
  // ---------- W6-S6-01 ----------
  {
    name: 'W6-S6-01 the menu, a card or a sheet opened after the last tile keeps the results waiting, and they come once it is closed',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      // a card: it is not slammed shut by the results
      await lastPlay(t);
      await t.game('act', 'fact', 'spa', 'SPA');
      t.equal(await t.page.evaluate(() => window.__G.dialog), 'fact', 'the card is open');
      await t.page.clock.runFor(3000);
      t.equal(await t.page.evaluate(() => window.__G.dialog), 'fact', 'the card is still open three seconds later');
      t.equal(await scene(t), 'game', 'and the board is behind it');
      await t.page.click('#modal [data-close]');
      await t.page.clock.runFor(400);
      t.equal(await scene(t), 'over', 'the results come when it is closed');
      // the menu, and a sheet opened from it: coming back does not strand the player on a finished board
      for (const sheet of ['settings', 'help']) {
        await lastPlay(t);
        await t.page.click('#b-menu');
        await t.page.click(`#modal [data-go="${sheet}"]`);
        t.equal(await scene(t), sheet, sheet + ' is open');
        await t.page.clock.runFor(3000);
        t.equal(await scene(t), sheet, 'and stays open');
        await t.page.locator('#screen [data-back]').first().click();
        await t.page.clock.runFor(400);
        t.equal(await scene(t), 'over', 'back from ' + sheet + ' the results are shown');
      }
      // leaving for the title drops them
      await lastPlay(t);
      await t.page.click('#b-menu');
      await t.page.click('#modal [data-go="title"]');
      await t.page.clock.runFor(3000);
      t.equal(await scene(t), 'title', 'the title is not taken over by the results');
      t.equal(await t.page.evaluate(() => !!window.__G.aiHeld), false, 'and nothing is held');
      await t.page.clock.resume();
    },
  },

  // ---------- W6-P-N03 ----------
  ...['normal', 'blocked', 'newer'].map((kind) => ({
    name: `W6-P-N03 par found after the last turn is worked out in the worker and written into the results in place, under an open card (${kind} storage)`,
    viewports: kind === 'normal' ? ['desktop', 'mobile'] : ['desktop'],
    url: `index.html?kind=${kind}`,
    initScript: () => {
      window.__TEST_TIPS__ = false;
      const kind = new URLSearchParams(location.search).get('kind');
      localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
      if (kind === 'newer') localStorage.setItem('hs-letters-save-v1', JSON.stringify({ v: 2, game: { anything: 1 } }));
      if (kind === 'blocked') Storage.prototype.setItem = function () { throw new Error('QuotaExceededError'); };
      // the par request is held on its way to the worker
      const Real = window.Worker;
      window.Worker = class extends Real {
        postMessage(m) {
          if (!m || m.type !== 'dailyPar') { super.postMessage(m); return; }
          window.__par = () => super.postMessage(m); window.__parAsked = (window.__parAsked || 0) + 1;
        }
      };
    },
    async run(t) {
      await ready(t);
      t.equal((await t.state()).ai, 'worker', 'the worker is running');
      await t.game('act', 'daily');
      await until(t, () => window.__G.scene === 'game' && window.__par);
      await t.page.evaluate(() => { window.__G.fast = true; });
      for (let k = 0; k < 10; k++) await t.game('act', 'pass');
      await until(t, () => window.__G.scene === 'over');
      t.equal(await t.page.locator('.daily-box [data-par-line]').count(), 0, 'no par yet');
      // scrolled down with a card open
      await t.page.evaluate(() => {
        const scr = document.querySelector('#screen'); scr.scrollTop = 60; window.__scroll = scr.scrollTop;
        document.querySelector('#screen .over').dataset.mark = '1';
        window.__game.act('fact', 'spa', 'SPA');
      });
      await t.page.evaluate(() => window.__par());
      await until(t, () => document.querySelector('.daily-box [data-par-line]'));
      const m = await t.page.evaluate(() => ({
        dialog: window.__G.dialog, shown: !document.querySelector('#modal').hidden, mark: document.querySelector('#screen .over').dataset.mark,
        scroll: document.querySelector('#screen').scrollTop, was: window.__scroll, date: window.__G.s.daily.date, par: window.__G.parCache[window.__G.s.daily.date],
        text: document.querySelector('.daily-box [data-par-line]').textContent, asked: window.__parAsked, saved: localStorage.getItem('hs-letters-daily-v1'),
      }));
      t.equal([m.dialog, m.shown], ['fact', true], 'the card is still open');
      t.equal(m.mark, '1', 'the results were not rebuilt');
      t.equal(m.scroll, m.was, 'nor scrolled');
      t.equal(m.asked, 1, 'it was asked for once, of the worker');
      t.expect(m.text.includes(`${m.par.m} and`) && m.text.includes(` ${m.par.h} on these tiles`), 'the line names both scores: ' + m.text);
      if (kind === 'normal') t.equal(JSON.parse(m.saved).days[m.date].par, m.par, 'and the day keeps it');
      else t.equal(m.saved, null, 'nothing was stored');
      // the sheet drawn afresh says the same
      await t.page.click('#modal [data-close]');
      await t.page.evaluate(() => window.__game.scene('over'));
      t.equal(await t.page.textContent('.daily-box [data-par-line]'), m.text, 'and so does the sheet drawn again');
    },
  })),

  // ---------- W6-S6-03 ----------
  {
    name: 'W6-S6-03 the 3D board leaves nothing on the GPU when it is turned off, and comes back after a real context loss (real GPU)',
    viewports: ['desktop'],
    url: 'index.html?gl=3d',
    initScript: quiet,
    async run(t) {
      await ready(t);
      if (!t.gpu) return;
      await t.game('newGame', { seed: 41, seats: SEATS });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 6);
      await t.waitIdle(10000);
      const on = await b3(t);
      t.expect(on.on && on.tiles > 0, 'the 3D board is drawn');
      t.equal(on.bellMats.slice().sort(), ['brass:MeshStandardMaterial', 'bronze:MeshStandardMaterial'], 'the bell and its base are standard materials');
      t.equal([on.topMat, on.tableMat, on.keyType], ['MeshStandardMaterial', 'MeshStandardMaterial', 'SpotLight'], 'so are board and table, under the lamp');
      t.expect(on.tileCoatRoughness != null, 'the tiles keep their glaze');
      const setting = async (k, v) => {
        await t.page.evaluate(([k, v]) => {
          window.__game.scene('settings');
          document.querySelector(`#screen [data-set="${k}"][data-val="${v}"]`).click();
          window.__game.scene('game');
        }, [k, v]);
        await t.waitFrames(3);
      };
      // off and on, three times, each after a Night and a Day
      for (let k = 0; k < 3; k++) {
        await setting('theme', 'dark');
        await setting('theme', 'light');
        await setting('board3d', 'off');
        const off = await b3(t);
        t.equal(off.on, false, 'off');
        t.equal({ geometries: off.disposed.left.geometries, textures: off.disposed.left.textures }, { geometries: 0, textures: 0 }, `nothing is left on the GPU (${JSON.stringify(off.disposed)})`);
        await setting('board3d', 'on');
        await until(t, () => window.__game.getState().view.mode3d);
      }
      // a real loss: the flat board at once, the 3D one when the context is given back
      await t.page.evaluate(() => { const c = document.querySelector('#gl'); window.__ext = (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
      await until(t, () => !window.__game.getState().view.mode3d);
      await t.waitFrames(3);
      const lost = await t.page.evaluate(() => {
        const cv = document.querySelector('#board'), d = cv.getContext('2d').getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data;
        return { alpha: d[3], hidden: document.querySelector('#gl').hidden, reason: window.__game.getState().view.reason3d };
      });
      t.equal(lost, { alpha: 255, hidden: true, reason: 'context-lost' }, 'the flat board is drawn');
      await t.page.evaluate(() => window.__ext.restoreContext());
      await until(t, () => window.__game.getState().view.mode3d);
      await t.waitFrames(3);
      const back = await b3(t);
      t.expect(back.on && back.tiles > 0 && back.drawCalls > 10, `the 3D board is back (${back.tiles} tiles, ${back.drawCalls} calls)`);
      await t.shot('w3-b22-3d-restored', { timeout: 15000 });
    },
  },

  // ---------- W6-S6-05 ----------
  {
    name: 'W6-S6-05 zooming the flat board right in paints each tile a few times, not once a step, and a tile at rest is dark ink on a bright crown',
    viewports: ['desktop', 'mobile'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: SEATS });
      await t.waitIdle(8000);
      await t.game('act', 'autoplay', 10);
      await t.waitIdle(10000);
      const glyphs = await t.page.evaluate(() => new Set(window.__G.s.board.filter(Boolean).map((x) => x.l + x.blank)).size);
      // counted as they are made: the cache empties itself when it is full, so its size says nothing
      const { steps, grown } = await t.page.evaluate(async () => {
        let n = 0, made = 0;
        const real = document.createElement;
        document.createElement = function (name, ...a) { if (name === 'canvas') made++; return real.call(document, name, ...a); };
        for (let z = 1; z <= 2.4; z += 0.02) { window.__game.act('zoom', z, 8, 8); n++; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); }
        document.createElement = real;
        return { steps: n, grown: made };
      });
      t.log(`${glyphs} letters, ${steps} zoom steps, ${grown} sprites painted`);
      t.expect(grown > 0 && grown <= glyphs * 7, `${grown} sprites for ${glyphs} letters over ${steps} zoom steps (at most 7 sizes each)`);
      await t.game('act', 'zoom', 1, 8, 8);
      await t.waitFrames(3);
      // ink and crown of every tile on the board, read off the canvas
      const ink = await t.page.evaluate(() => {
        const cv = document.querySelector('#board'), c = cv.getContext('2d'), d = cv.width / cv.clientWidth, at = window.__game.act;
        const rows = [];
        window.__G.s.board.forEach((x, i) => { if (x && !x.blank) rows.push(i); });
        return Promise.all(rows.map(async (i) => {
          const [x, y] = await at('cell', i), cell = ((await at('cell', 113))[0] - (await at('cell', 112))[0]) * d, w = Math.round(cell * 0.6);
          const q = c.getImageData(Math.round(x * d - cell * 0.4), Math.round(y * d - cell * 0.35), w, w).data;
          let lo = 255, hi = 0;
          for (let k = 0; k < q.length; k += 4) { const l = 0.2126 * q[k] + 0.7152 * q[k + 1] + 0.0722 * q[k + 2]; if (l < lo) lo = l; if (l > hi) hi = l; }
          return [Math.round(lo), Math.round(hi)];
        }));
      });
      t.log('ink/crown ' + ink.map((a) => a.join('/')).join(' '));
      t.expect(ink.length > 10 && ink.every(([lo, hi]) => lo < 60 && hi > 215), 'every letter is dark on a bright crown');
      await t.shot('w3-b22-2d-tiles');
    },
  },
  {
    name: 'W6-S6-05 a burst of resizes is one relayout in one frame that keeps the buttons and the focus, the board is never blank, and the narrow layout still swaps in',
    viewports: ['desktop'],
    url: 'index.html?gl=0',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 41, seats: SEATS });
      await t.waitIdle(8000);
      await t.page.focus('#actions [data-act="swap"]');
      const r = await t.page.evaluate(async () => {
        const frame = () => new Promise((res) => requestAnimationFrame(res));
        await frame(); await frame();
        const el = document.activeElement, plaque = document.querySelector('#springs').firstElementChild, n0 = window.__G.layoutCount;
        for (let k = 0; k < 12; k++) dispatchEvent(new Event('resize'));
        const atOnce = window.__G.layoutCount - n0;
        await frame(); await frame();
        return { atOnce, n: window.__G.layoutCount - n0, act: el.dataset.act, kept: document.activeElement === el && el.isConnected, plaque: plaque.isConnected };
      });
      t.equal(r, { atOnce: 0, n: 1, act: 'swap', kept: true, plaque: true }, 'twelve resizes');
      // watched after every frame while the window changes size
      await t.page.evaluate(() => {
        const cv = document.querySelector('#board'), ch = new MessageChannel();
        window.__blank = 0; window.__seen = 0;
        ch.port1.onmessage = () => { window.__seen++; if (cv.getContext('2d').getImageData(cv.width >> 1, cv.height >> 1, 1, 1).data[3] === 0) window.__blank++; };
        const watch = () => { ch.port2.postMessage(0); window.__w = requestAnimationFrame(watch); };
        window.__w = requestAnimationFrame(watch);
      });
      for (let w = 1280; w >= 1000; w -= 40) { await t.page.setViewportSize({ width: w, height: 800 }); await t.waitFrames(2); }
      const seen = await t.page.evaluate(() => { cancelAnimationFrame(window.__w); return [window.__blank, window.__seen]; });
      t.expect(seen[0] === 0 && seen[1] >= 8, `no blank frame (${seen[0]} of ${seen[1]})`);
      t.expect(await t.page.evaluate(() => Math.abs(document.querySelector('#board').width - document.querySelector('#boardwrap').clientWidth) <= 1), 'the board fits its place');
      // into the narrow layout and out again
      t.equal(await t.page.locator('#scores > *').count() > 0, true, 'the score list is beside the board');
      await t.page.setViewportSize({ width: 500, height: 800 });
      await until(t, () => document.querySelector('#scores').children.length === 0 && document.querySelector('#springs [data-springs-toggle]') && document.querySelectorAll('#actions .abtn').length === 5);
      await t.page.setViewportSize({ width: 1280, height: 800 });
      await until(t, () => document.querySelector('#scores').children.length > 0 && !document.querySelector('#springs [data-springs-toggle]') && document.querySelectorAll('#actions .abtn').length === 6);
    },
  },
];
