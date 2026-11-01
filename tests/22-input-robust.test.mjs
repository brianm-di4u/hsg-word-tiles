// Input robustness: every way a tile could be left between the rack and the board (players on iPhone and iPad saw
// "stuck" tiles). Real CDP touch and mouse input; after each case the staging invariant must hold: no drag alive,
// the ghost hidden, every rack tile either on the rack or staged once, no square holding two tiles.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const N = 15, CENTER = 112;
async function start(t, rack) {
  await ready(t);
  await t.game('newGame', { seed: 3 });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}

// the staging invariant, run in the page
function invariant() {
  const G = window.__G, s = G.s, out = [];
  if (!s) return out;
  if (G.drag && G.drag.active) out.push('a drag is still active');
  if (!document.querySelector('#ghost').hidden) out.push('the ghost tile is still showing');
  const p = s.players[s.cur];
  if (!s.over && p.kind === 'human' && !G.privacy) {
    const ks = [...G.order, ...G.staged.map((x) => x.k)].sort((a, b) => a - b).join();
    const want = p.rack.map((_, k) => k).join();
    if (ks !== want) out.push(`rack ${want} but order ${G.order.join()} + staged ${G.staged.map((x) => x.k).join()}`);
    if (document.querySelectorAll('#rack .rtile:not(.lifted)').length !== G.order.length) out.push(`${document.querySelectorAll('#rack .rtile:not(.lifted)').length} rack buttons for ${G.order.length} tiles`);
  } else if (G.staged.length) out.push(`${G.staged.length} tiles staged outside a human turn`);
  const seen = new Set();
  for (const x of G.staged) { if (seen.has(x.i) || s.board[x.i]) out.push(`square ${x.i} holds two tiles`); seen.add(x.i); }
  return out;
}
async function settle(t) { await t.page.waitForTimeout(280); await t.waitFrames(2); }
async function inv(t, label) { await settle(t); const r = await t.page.evaluate(invariant); for (const x of r) t.fail(`${label}: ${x}`); return r.length === 0; }

// multi-finger CDP touch: points not listed in an event are lifted
function fingers(t) {
  let cdp = null; const pts = new Map();
  const send = (type) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' || type === 'touchCancel' ? [] : [...pts].map(([id, [x, y]]) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 })) });
  return {
    async down(id, p) { cdp = cdp || await t.page.context().newCDPSession(t.page); pts.set(id, p); await send('touchStart'); },
    async move(id, p, steps = 1) { const [x0, y0] = pts.get(id); for (let k = 1; k <= steps; k++) { pts.set(id, [x0 + (p[0] - x0) * k / steps, y0 + (p[1] - y0) * k / steps]); await send('touchMove'); } },
    async up(id) { pts.delete(id); await send(pts.size ? 'touchMove' : 'touchEnd'); },
    async cancel() { pts.clear(); await send('touchCancel'); },
    async done() { if (cdp) await cdp.detach(); cdp = null; },
  };
}
const drag = (t) => t.page.evaluate(() => (window.__G.drag && window.__G.drag.active ? { from: window.__G.drag.from, target: window.__G.drag.target, k: window.__G.drag.k } : null));
const order = async (t) => (await t.state()).order;
// lift a rack tile (by rack position) with a finger and carry it to just above cell `i` (the tile floats `lift` px up)
async function liftRack(t, f, pos, i, id = 1) {
  const lift = await t.game('act', 'dragLift');
  const tile = await t.game('act', 'rackTile', pos), c = await t.game('act', 'screen', i);
  await f.down(id, [tile[0], tile[1]]);
  await f.move(id, [c[0], c[1] + lift], 12);
  await t.waitFrames(2);
}
async function liftBoard(t, f, from, to, id = 1) {
  const lift = await t.game('act', 'dragLift');
  const a = await t.game('act', 'screen', from), b = await t.game('act', 'screen', to);
  await f.down(id, a);
  await f.move(id, [b[0], b[1] + lift], 12);
  await t.waitFrames(2);
}
async function mouseLift(t, pos, i) {
  const tile = await t.game('act', 'rackTile', pos), c = await t.game('act', 'screen', i);
  await t.page.mouse.move(tile[0], tile[1]); await t.page.mouse.down();
  await t.page.mouse.move(c[0], c[1], { steps: 10 });
  await t.waitFrames(2);
}

export const tests = [
  {
    // iOS WebKit drops pointer events aimed at a node removed from the page, so the lifted tile's button must
    // stay attached and the drag must be captured by an element that lasts
    name: 'robust: the pressed rack button stays attached and the drag is captured',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.evaluate(() => { window.__probe = {}; addEventListener('pointerdown', (e) => { window.__probe.target = e.target.closest('.rtile') || e.target; window.__probe.id = e.pointerId; }, true); });
      const f = t.viewport === 'mobile' && t.browser === 'chromium' ? fingers(t) : null;
      if (f) await liftRack(t, f, 0, CENTER); else await mouseLift(t, 0, CENTER);
      const p = await t.page.evaluate(() => ({ connected: window.__probe.target.isConnected, captured: document.querySelector('#app').hasPointerCapture(window.__probe.id) }));
      t.expect(p.connected, 'the pressed rack button is still in the page while its tile is lifted');
      t.expect(p.captured, '#app holds the pointer capture during a rack drag');
      // a re-render mid-drag (resize, rotation) must not detach it either
      await t.page.evaluate(() => dispatchEvent(new Event('resize')));
      t.expect(await t.page.evaluate(() => window.__probe.target.isConnected), 'still attached after a re-render');
      if (f) { await f.up(1); await f.done(); } else await t.page.mouse.up();
      const s = await t.state();
      t.equal(s.staged.map((x) => x.i), [CENTER], 'the tile landed');
      await inv(t, 'after the drop');
    },
  },
  {
    name: 'robust: a cancelled touch puts the tile back where it was',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      const before = await order(t);
      const f = fingers(t);
      await liftRack(t, f, 2, CENTER);
      t.expect(await drag(t), 'drag active');
      await f.cancel();
      await inv(t, 'rack drag cancelled');
      t.equal(await order(t), before, 'the tile is back in its own rack slot');
      // a staged tile goes back to its square
      await t.game('act', 'stage', [{ l: 'S', i: CENTER }]);
      await liftBoard(t, f, CENTER, CENTER + 3);
      await f.cancel();
      await inv(t, 'board drag cancelled');
      t.equal((await t.state()).staged.map((x) => x.i), [CENTER], 'the staged tile is back on its square');
      await f.done();
    },
  },
  {
    name: 'robust: leaving the page mid-drag (blur, hidden tab, lost capture) returns the tile',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 'SPRINGE');
      const touch = t.viewport === 'mobile' && t.browser === 'chromium';
      const f = fingers(t);
      const lift = async () => { if (touch) await liftRack(t, f, 0, CENTER); else await mouseLift(t, 0, CENTER); };
      const end = async () => { if (touch) await f.up(1); else await t.page.mouse.up(); };
      const before = await order(t);
      for (const [label, fire] of [
        ['window blur', () => dispatchEvent(new Event('blur'))],
        ['tab hidden', () => { Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true }); Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); delete document.visibilityState; delete document.hidden; }],
        ['capture lost', () => document.querySelector('#app').releasePointerCapture(window.__G.drag.id)],
      ]) {
        await lift();
        t.expect(await drag(t), `${label}: drag active`);
        await t.page.evaluate(fire);
        // a lost capture is reported with the next pointer event, so move on a little
        const c = await t.game('act', 'screen', CENTER + 1);
        if (touch) await f.move(1, [c[0], c[1] + 70], 2); else await t.page.mouse.move(c[0], c[1], { steps: 2 });
        await t.waitFrames(2);
        t.equal(await drag(t), null, `${label}: the drag ended`);
        await end();
        await inv(t, label);
        t.equal(await order(t), before, `${label}: the tile is back in its slot`);
        t.equal((await t.state()).staged.length, 0, `${label}: nothing staged by the stray release`);
      }
      await f.done();
    },
  },
  {
    name: 'robust: a mouse released outside the window does not leave the tile following the cursor',
    viewports: ['desktop'],
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 'SPRINGE');
      const before = await order(t);
      await mouseLift(t, 1, CENTER);
      // the button came up somewhere we never heard about: the next move arrives with no button held
      const c = await t.game('act', 'screen', CENTER + 2);
      await t.page.evaluate(([x, y]) => dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 0, clientX: x, clientY: y, bubbles: true })), c);
      t.equal(await drag(t), null, 'the drag ended on a buttonless move');
      await inv(t, 'released outside');
      t.equal(await order(t), before, 'the tile went home');
      await t.page.mouse.up();
      // a normal drag still works afterwards
      await mouseLift(t, 0, CENTER);
      await t.page.mouse.up();
      t.equal((await t.state()).staged.map((x) => x.i), [CENTER], 'next drag lands');
      await inv(t, 'after');
    },
  },
  {
    name: 'robust: a second finger mid-drag never loses the lifted tile',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      const f = fingers(t);
      const elsewhere = await t.game('act', 'screen', CENTER - 30);
      // 1. rack drag + a finger on the board
      await liftRack(t, f, 0, CENTER);
      await f.down(2, elsewhere); await f.move(2, [elsewhere[0] + 40, elsewhere[1] + 30], 4); await f.up(2);
      t.expect(await drag(t), 'the rack drag survived a second finger on the board');
      await f.up(1);
      await inv(t, 'rack drag + board finger');
      t.equal((await t.state()).staged.map((x) => x.i), [CENTER], 'it landed where the ghost was');
      // 2. rack drag + a finger on another rack tile
      const other = await t.game('act', 'rackTile', 3);
      await liftRack(t, f, 0, CENTER + 1);
      await f.down(2, [other[0], other[1]]); await f.move(2, [other[0], other[1] - 120], 6); await f.up(2);
      await f.up(1);
      await inv(t, 'rack drag + rack finger');
      t.equal((await t.state()).staged.map((x) => x.i).sort(), [CENTER, CENTER + 1], 'the first tile landed, the second stayed home');
      // 3. a staged tile lifted + a second finger (this used to start a pinch and drop the tile)
      await liftBoard(t, f, CENTER + 1, CENTER + 2);
      await f.down(2, elsewhere); await f.move(2, [elsewhere[0] + 60, elsewhere[1] - 60], 4);
      await f.up(2); await f.up(1);
      await inv(t, 'board drag + second finger');
      t.equal((await t.state()).staged.length, 2, 'both staged tiles still exist');
      await f.done();
    },
  },
  {
    name: 'robust: a touch that never ended does not turn later touches into pinches',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'stage', [{ l: 'S', i: CENTER }]);
      const c = await t.game('act', 'screen', CENTER - 20);
      // a pointerdown whose pointerup never arrives (WebKit, lost capture): a synthetic one with no live pointer
      await t.page.evaluate(([x, y]) => { const b = document.querySelector('#board'); try { b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 77, pointerType: 'touch', isPrimary: true, clientX: x, clientY: y, bubbles: true })); } catch (e) { /* the handler may throw */ } }, c);
      const f = fingers(t);
      await liftBoard(t, f, CENTER, CENTER + 2);
      t.expect(await drag(t), 'a one-finger drag of the staged tile works');
      await f.up(1);
      await inv(t, 'after the stale pointer');
      t.equal((await t.state()).staged.map((x) => x.i), [CENTER + 2], 'the staged tile moved');
      t.equal((await t.state()).view.zoom, 1, 'no pinch zoom happened');
      await f.done();
    },
  },
  {
    name: 'robust: a blank dragged to the board and the letter dialog cancelled stays on the rack',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, '?PRINGS');
      const touch = t.viewport === 'mobile' && t.browser === 'chromium', f = fingers(t);
      const put = async (i) => { if (touch) { await liftRack(t, f, 0, i); await f.up(1); } else { await mouseLift(t, 0, i); await t.page.mouse.up(); } await t.waitFrames(2); };
      await put(CENTER);
      t.equal((await t.state()).dialog, 'blank', 'the letter dialog opened');
      await t.page.click('#modal [data-close]');
      await inv(t, 'blank dialog cancelled');
      t.equal((await t.state()).order.length, 7, 'the blank is back on the rack');
      await put(CENTER);
      await t.page.keyboard.press('Escape');
      await inv(t, 'blank dialog escaped');
      t.equal((await t.state()).order.length, 7, 'still on the rack after Esc');
      await put(CENTER);
      await t.page.click('#modal [data-letter="S"]');
      await inv(t, 'blank letter picked');
      const s = await t.state();
      t.equal(s.staged.map((x) => [x.i, x.l, x.blank]), [[CENTER, 'S', true]], 'the blank is staged as S');
      await f.done();
    },
  },
  {
    name: 'robust: tiles cannot be staged under a pending hint',
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: ['desktop'],
    async run(t) {
      await start(t, 'SPRINGE');
      await t.page.focus('#board');
      // press Hint and type a letter in the same task: the letter used to land while the hint was computing
      await t.page.evaluate(() => { document.querySelector('[data-act="hint"]').click(); document.dispatchEvent(new KeyboardEvent('keydown', { key: 'E', bubbles: true })); });
      await t.waitIdle(8000);
      await inv(t, 'after the hint');
      const s = await t.state();
      t.expect(s.staged.length > 0 && s.preview && s.preview.ok, `the hint is a clean legal play (${s.staged.map((x) => x.l + x.i).join(' ')}: ${s.preview && s.preview.error})`);
    },
  },
  {
    name: 'robust: a drag that outlives the turn, a dialog or the screen is cancelled',
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: ['desktop'],
    async run(t) {
      await start(t, 'SPRINGE');
      // SPRING staged, E lifted; Enter plays SPRING while the E is in the air
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      await mouseLift(t, 0, CENTER + 20);
      await t.page.keyboard.press('Enter');
      await t.waitFrames(2);
      t.equal(await drag(t), null, 'playing ended the drag');
      await t.page.mouse.up();
      let s = await t.state();
      t.equal(s.staged.length, 0, 'the lifted tile was not staged into the next turn');
      await t.waitIdle(15000);
      await inv(t, 'after the AI reply');
      // a dialog opening mid-drag
      s = await t.state();
      t.expect(s.game.players[s.game.cur].kind === 'human', 'human to play again');
      await mouseLift(t, 0, CENTER - 30);
      await t.page.keyboard.press('Escape');   // nothing staged: opens the menu
      await t.waitFrames(2);
      t.equal((await t.state()).dialog, 'pause', 'the menu opened');
      t.equal(await drag(t), null, 'the menu ended the drag');
      await t.page.mouse.up();
      t.equal((await t.state()).staged.length, 0, 'nothing staged behind the menu');
      await t.game('act', 'close');
      await inv(t, 'after the menu');
      // a scene change mid-drag
      await mouseLift(t, 0, CENTER - 30);
      await t.game('scene', 'title');
      t.equal(await drag(t), null, 'leaving the game screen ended the drag');
      await t.page.mouse.up();
      t.equal(await t.page.evaluate(() => document.querySelector('#ghost').hidden), true, 'no ghost on the title screen');
    },
  },
  {
    name: 'robust: a Worker that dies silently does not freeze the AI or the hint',
    browsers: ['chromium', 'firefox', 'webkit'],
    viewports: ['desktop'],
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'killWorker');
      const t0 = Date.now();
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => { const s = window.__game.getState(); return s.game.cur === 0 && !s.aiThinking; }, null, { timeout: 20000 }).catch(() => t.fail('the AI never moved after the Worker died'));
      t.log(`AI answered ${Date.now() - t0} ms after the Worker died`);
      const n = await t.game('act', 'hint');
      t.expect(n > 0, 'the hint still works');
      await inv(t, 'after the dead worker');
    },
  },
  {
    name: 'robust: tiles placed while the computer\'s tiles are still landing stay put',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ l, i: CENTER - 2 + k })));
      await t.game('act', 'play');
      // the moment the computer's move is applied (its tiles are still flying in), place a tile
      await t.page.waitForFunction(() => window.__G.s.cur === 0 && !window.__G.aiBusy && window.__G.s.move === 2, null, { timeout: 15000 });
      const s = await t.state();
      const free = s.game.board.findIndex((x, i) => !x && i > 30);
      const f = fingers(t);
      await liftRack(t, f, 0, free);
      await f.up(1);
      await t.waitIdle(8000);
      await inv(t, 'after the turn settled');
      t.equal((await t.state()).staged.map((x) => x.i), [free], 'the tile is still on the board');
      await f.done();
    },
  },
  {
    name: 'robust: a tile lifted while another flies home, and a held tile typed onto the board',
    viewports: ['desktop'],
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 'SPRINGE');
      // drop one off the board (it flies back for 200 ms) and lift the next at once
      await mouseLift(t, 0, CENTER);
      await t.page.mouse.move(5, 5, { steps: 3 }); await t.page.mouse.up();
      await mouseLift(t, 1, CENTER);
      const dup = await t.page.evaluate(() => { const ks = [...document.querySelectorAll('#rack .rtile')].map((b) => b.dataset.k); return ks.length - new Set(ks).size; });
      t.equal(dup, 0, 'no duplicate rack buttons');
      await t.page.mouse.up();
      await inv(t, 'lift during a fly-back');
      await t.game('act', 'recall');
      await inv(t, 'recalled');
      // press a tile, type its letter before moving, then drag
      const s = await t.state(), rack = s.game.players[0].rack, k0 = s.order[0];
      const tile = await t.game('act', 'rackTile', 0);
      await t.page.focus('#board');
      await t.page.mouse.move(tile[0], tile[1]); await t.page.mouse.down();
      await t.page.keyboard.press(rack[k0]);
      const rk = await t.page.$eval('#rack', (e) => { const b = e.getBoundingClientRect(); return [b.left + 10, b.top + b.height / 2]; });
      await t.page.mouse.move(rk[0], rk[1], { steps: 8 }); await t.page.mouse.up();
      await inv(t, 'typed while held');
    },
  },
  {
    name: 'robust: rack tiles keep their size and fit from 320 px to tablets',
    browsers: ['chromium', 'firefox', 'webkit'],
    async run(t) {
      await start(t, 'SPRINGE');
      const sizes = [];
      for (const vp of t.viewport === 'mobile' ? [[390, 844], [320, 568], [375, 667], [844, 390], [932, 430], [768, 1024], [390, 844]] : [[1280, 800], [1024, 768], [1920, 1080], [1280, 800]]) {
        await t.page.setViewportSize({ width: vp[0], height: vp[1] });
        for (let k = 0; k < 4; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }
        const r = await t.page.evaluate(() => {
          const b = [...document.querySelectorAll('#rack .rtile')].map((e) => e.getBoundingClientRect());
          return { tile: getComputedStyle(document.querySelector('#rack')).getPropertyValue('--tile'), n: b.length, left: Math.min(...b.map((x) => x.left)), right: Math.max(...b.map((x) => x.right)), W: innerWidth, H: innerHeight, bottom: Math.max(...b.map((x) => x.bottom)) };
        });
        sizes.push(`${vp.join('x')}:${r.tile}`);
        t.expect(r.n === 7 && r.left >= 0 && r.right <= r.W, `${vp.join('x')}: all 7 rack tiles on screen (${Math.round(r.left)}–${Math.round(r.right)} of ${r.W})`);
        t.expect(r.bottom <= r.H, `${vp.join('x')}: rack above the bottom edge`);
        // the board gets a playable size in every orientation (sideways phones used to squeeze it to 60 px)
        const bw = await t.page.evaluate(() => { const b = document.querySelector('#boardwrap').getBoundingClientRect(); return Math.min(b.width, b.height); });
        t.expect(bw >= Math.min(vp[0], vp[1]) * 0.6, `${vp.join('x')}: board ${Math.round(bw)} px across`);
        await t.checkLayout();
        t.expect(parseFloat(r.tile) >= 36, `${vp.join('x')}: rack tiles at least 36 px (${r.tile})`);
        // with room to spare the tiles use it (they used to creep down to the minimum on phones)
        if (vp[0] >= 390) t.expect(parseFloat(r.tile) >= Math.min(52, Math.floor((Math.min(vp[0], 1100) - 80) / 7) - 2), `${vp.join('x')}: rack tiles use the room (${r.tile})`);
      }
      t.log(sizes.join(' '));
      t.equal(sizes[0].split(':')[1], sizes[sizes.length - 1].split(':')[1], 'the tile size comes back the same after resizes');
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
      await inv(t, 'after resizing');
    },
  },
  {
    name: 'robust: edges and corners, from just outside the grid and zoomed in',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      const f = fingers(t);
      const lift = await t.game('act', 'dragLift');
      for (const i of [0, N - 1, N * N - N, N * N - 1]) {
        const c = await t.game('act', 'screen', i), cell = (await t.game('act', 'screen', 1))[0] - (await t.game('act', 'screen', 0))[0];
        const dx = i % N === 0 ? -cell * 0.4 : cell * 0.4;    // a little outside the grid
        const tile = await t.game('act', 'rackTile', 0);
        await f.down(1, [tile[0], tile[1]]); await f.move(1, [c[0] + dx, c[1] + lift], 12);
        await t.waitFrames(2);
        const d = await drag(t);
        t.equal(d && d.target, i, `square ${i}: the ghost snaps to the edge square`);
        await f.up(1);
        await inv(t, `square ${i}`);
        t.expect((await t.state()).staged.some((x) => x.i === i), `square ${i}: landed`);
      }
      await t.game('act', 'recall');
      // a short phone: the bottom row sits right above the rack, so the finger is over the rack while the tile is not
      for (const [w, h] of [[375, 667], [320, 568]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.waitFrames(3);
        const l2 = await t.game('act', 'dragLift');
        for (const i of [N * N - 1, N * N - 8, N * N - N]) {
          const c = await t.game('act', 'screen', i), tile = await t.game('act', 'rackTile', 0);
          await f.down(1, [tile[0], tile[1]]); await f.move(1, [c[0], c[1] + l2], 12);
          await f.up(1);
          await inv(t, `${w}x${h} square ${i}`);
          t.expect((await t.state()).staged.some((x) => x.i === i), `${w}x${h}: bottom-row square ${i} reachable`);
          await t.game('act', 'recall');
        }
        // dragging along the middle of the rack still reorders it
        const a = await t.game('act', 'rackTile', 0), b = await t.game('act', 'rackTile', 4);
        await f.down(1, [a[0], a[1]]); await f.move(1, [b[0] + 4, b[1]], 10); await f.up(1);
        await inv(t, `${w}x${h} rack reorder`);
        t.equal((await t.state()).staged.length, 0, `${w}x${h}: along the rack reorders, nothing staged`);
      }
      await t.page.setViewportSize({ width: t.vp.width, height: t.vp.height });
      await t.waitFrames(3);
      // zoomed in: the drop lands on exactly the square the ghost showed
      await t.game('act', 'zoom', 2.4, 9, 9);
      await settle(t);
      for (const i of [CENTER - 16, CENTER + 17]) {
        await liftRack(t, f, 0, i);
        const d = await drag(t);
        await f.up(1);
        await inv(t, `zoomed square ${i}`);
        const s = await t.state();
        t.expect(d && d.target != null && s.staged.some((x) => x.i === d.target), `zoomed: landed on the ghost's square ${d && d.target}`);
      }
      await f.done();
    },
  },
  {
    name: 'robust: the 3D board takes drops and cancels the same way',
    url: 'index.html?gl=3d',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      const s0 = await t.state();
      t.log('3D on:', s0.view.mode3d, s0.view.reason3d || '');
      const f = fingers(t);
      await liftRack(t, f, 0, CENTER);
      const d = await drag(t);
      t.equal(d && d.target, CENTER, 'the ghost is on the centre square');
      await f.up(1);
      await inv(t, '3D drop');
      t.equal((await t.state()).staged.map((x) => x.i), [CENTER], 'landed in 3D');
      await liftBoard(t, f, CENTER, CENTER + 1);
      await f.cancel();
      await inv(t, '3D cancel');
      t.equal((await t.state()).staged.map((x) => x.i), [CENTER], 'cancel put it back on its square');
      await f.done();
    },
  },
  {
    name: 'robust: fast taps (select, place, recall) and rotation mid-drag',
    viewports: ['mobile'],
    async run(t) {
      await start(t, 'SPRINGE');
      for (let k = 0; k < 4; k++) {
        const r = await t.game('act', 'rackTile', 0);
        await t.tap([r[0], r[1]]);
        await t.tap(await t.game('act', 'screen', CENTER - 1 + k));
      }
      let s = await t.state();
      t.equal(s.staged.length, 4, 'four tiles placed by taps');
      await t.tap(await t.game('act', 'screen', CENTER));
      await t.tap(await t.game('act', 'screen', CENTER + 1));
      await inv(t, 'fast taps');
      t.equal((await t.state()).staged.length, 2, 'two recalled by tapping');
      // rotate the phone while a tile is lifted
      const f = fingers(t);
      await liftRack(t, f, 0, CENTER + 20);
      await t.page.setViewportSize({ width: 844, height: 390 });
      await t.page.evaluate(() => dispatchEvent(new Event('resize')));
      await t.waitFrames(2);
      await f.up(1);
      await inv(t, 'rotation mid-drag');
      await t.page.setViewportSize({ width: 390, height: 844 });
      await inv(t, 'rotated back');
      await f.done();
    },
  },
];
