// Wave 3, batch W3-B21: W6-S5-03 (a Shuffle slide that never moves the tiles' hit boxes), W6-S5-05 (the view keeps gliding
// while a tile is held at the edge of a zoomed board, Shuffle only on a live rack, browser shortcuts left alone).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const full = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, motion: 'full' })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
const PASS_PLAY = [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }];

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }
async function newGame(t, rack, seats = SEATS) {
  await t.seed(5);
  await t.game('newGame', { seats });
  await t.waitIdle(8000);
  if (!rack) return;
  const s = await t.state();
  s.game.players[0].rack = rack.split('');
  await t.game('setState', { game: s.game });
  await t.waitIdle(5000);
}
// each tile's button and drawn face, by rack letter, as centres in page pixels
const rackBoxes = (t) => t.page.evaluate(() => [...document.querySelectorAll('#rack .rtile')].map((b) => {
  const mid = (el) => { const r = el.getBoundingClientRect(); return r.left + r.width / 2; };
  const r = b.getBoundingClientRect();
  return { l: b.getAttribute('aria-label')[0], x: mid(b), y: r.top + r.height / 2, face: mid(b.querySelector('canvas')) };
}));
const word = (boxes) => boxes.map((b) => b.l).join('');
// a shuffle with fixed dice: every tile moves one place left and the first goes to the end
const shuffle = (t) => t.page.evaluate(() => {
  const rand = Math.random;
  Math.random = () => 0;
  try { document.querySelector('[data-act="shuffle"]').click(); } finally { Math.random = rand; }
});

export const tests = [
  // ---------- W6-S5-03 ----------
  {
    name: "W6-S5-03 a Shuffle slides the tiles' faces only: every button is in its new place at once, and a second Shuffle goes on from where the faces are",
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await newGame(t, 'SPRINGA');
      await stopClock(t);
      const before = await rackBoxes(t), places = before.map((b) => b.x);
      await t.page.evaluate(() => { window.requestAnimationFrame = () => 1; });
      // what is drawn, held still: each slide is stopped at its first frame
      const hold = () => t.page.evaluate(() => { for (const a of document.querySelector('#rack').getAnimations({ subtree: true })) { a.pause(); a.currentTime = 0; } });
      await shuffle(t); await hold();
      const one = await rackBoxes(t);
      t.equal(word(one), word(before).slice(1) + word(before)[0], 'the order is the shuffled one');
      one.forEach((b, k) => t.expect(Math.abs(b.x - places[k]) < 0.6, `the button of ${b.l} is in place ${k + 1} (${b.x.toFixed(1)} for ${places[k].toFixed(1)})`));
      const was = new Map(before.map((b) => [b.l, b.face]));
      one.forEach((b) => t.expect(Math.abs(b.face - was.get(b.l)) < 1.5, `the face of ${b.l} starts where it was (${b.face.toFixed(1)} for ${was.get(b.l).toFixed(1)})`));
      // again, in mid-slide
      const mid = new Map(one.map((b) => [b.l, b.face]));
      await shuffle(t); await hold();
      const two = await rackBoxes(t);
      t.equal(word(two), word(one).slice(1) + word(one)[0], 'the second Shuffle moved them on');
      two.forEach((b, k) => t.expect(Math.abs(b.x - places[k]) < 0.6, `the button of ${b.l} is in place ${k + 1}`));
      two.forEach((b) => t.expect(Math.abs(b.face - mid.get(b.l)) < 1.5, `the face of ${b.l} goes on from where it was drawn (${b.face.toFixed(1)} for ${mid.get(b.l).toFixed(1)})`));
      // a press ends the slide
      await t.page.mouse.move(two[0].x, two[0].y); await t.page.mouse.down();
      const held = await rackBoxes(t);
      held.forEach((b) => t.expect(Math.abs(b.face - b.x) < 0.6, `the face of ${b.l} is on its button`));
      await t.page.mouse.up();
    },
  },

  // ---------- W6-S5-05 ----------
  ...['index.html?gl=0', 'index.html?gl=3d'].map((url) => ({
    name: `W6-S5-05 a tile held still near the edge of a zoomed board glides the view on, at a steady speed, and lands on the square shown (${url.endsWith('3d') ? '3D' : '2D'})`,
    viewports: ['desktop', 'mobile'],
    url,
    initScript: full,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await newGame(t, 'SPRINGA');
      if (url.endsWith('3d')) t.expect((await t.state()).view.mode3d, 'the board is the 3D one');
      await t.game('act', 'zoom', 2, 7.5, 7.5);
      await stopClock(t);
      const look = () => t.page.evaluate(() => {
        const G = window.__G, d = G.drag, st = window.__game.getState(), r = document.querySelector('#board').getBoundingClientRect();
        return { cx: st.view.cx, cy: st.view.cy, W: st.view.W, H: st.view.H, left: r.left, top: r.top, target: d ? d.target : null, bx: d ? d.bx : 0, by: d ? d.by : 0, held: !!(d && d.active) };
      });
      const v0 = await look(), tile = await t.game('act', 'rackTile', 0);
      const mid = [v0.left + v0.W * 0.5, v0.top + v0.H * 0.5], edge = [v0.left + v0.W - 14, v0.top + v0.H * 0.5];
      await t.page.mouse.move(tile[0], tile[1]); await t.page.mouse.down();
      await t.page.mouse.move(mid[0], mid[1], { steps: 6 });
      await t.page.clock.runFor(100);
      const m0 = await look();
      t.expect(m0.held, 'a tile is in hand');
      // carried through the edge and back: the board does not move
      await t.page.mouse.move(edge[0], edge[1]); await t.page.clock.runFor(90);
      await t.page.mouse.move(mid[0], mid[1]); await t.page.clock.runFor(400);
      const m1 = await look();
      t.expect(m1.cx === m0.cx && m1.cy === m0.cy, 'passing through the edge, and holding in the middle, leaves the view alone');
      // held at the right edge without another pointer event
      const px = await t.page.evaluate(async () => { const a = await window.__game.act('screen', 112), b = await window.__game.act('screen', 113); return b[0] - a[0]; });
      await t.page.mouse.move(edge[0], edge[1]);
      await t.page.clock.runFor(300);
      const a = await look();
      t.expect(a.cx > m0.cx + 0.1, `the view has begun to glide (${m0.cx.toFixed(2)} to ${a.cx.toFixed(2)})`);
      await t.page.clock.runFor(200);
      const b = await look();
      const speed = (b.cx - a.cx) * px / 0.2;
      t.log(`glide ${speed.toFixed(0)} px a second, squares ${px.toFixed(1)} px`);
      t.expect(speed > 260 && speed < 470, `and goes on with the pointer still, at about 360 px a second (${speed.toFixed(0)})`);
      t.equal(b.cy, a.cy, 'sideways only');
      t.expect(b.held && Math.abs(b.bx - (edge[0] - v0.left)) < 1, 'the tile is still under the pointer');
      // to the board's own edge, where it rests
      await t.page.clock.runFor(4000);
      const end = await look();
      await t.page.clock.runFor(300);
      const rest = await look();
      t.equal(rest.cx, end.cx, 'it rests where the board ends');
      const at = await t.game('act', 'cellAt', rest.bx, rest.by);
      t.equal(at, rest.target, 'the square shown is the one under the tile');
      t.equal(rest.target == null ? null : rest.target % 15, 14, `the last column, off screen before (${rest.target})`);
      await t.page.mouse.up();
      const s = await t.state();
      t.equal(s.staged.map((x) => x.i).join(), String(rest.target), 'and the tile lands there');
      await t.page.clock.runFor(1000);
      t.equal((await look()).cx, rest.cx, 'nothing moves after the drop');
    },
  })),
  {
    name: 'W6-S5-05 Shift+R shuffles a live rack only: not behind the pass-and-play curtain, on a finished game or while only computers play; Ctrl or Cmd with ? or Shift and a letter is left to the browser',
    viewports: ['desktop'],
    initScript: full,
    async run(t) {
      await ready(t);
      const total = () => t.page.evaluate(() => window.__game.audioState().total);
      const order = async () => (await t.state()).order.join();
      const dice = (on) => t.page.evaluate((x) => { if (x) { window.__rand = Math.random; Math.random = () => 0; } else Math.random = window.__rand; }, on);
      const tries = async (what, live) => {
        const was = await order(), n0 = await total();
        await dice(true);
        await t.page.keyboard.press('Shift+R');
        await dice(false);
        const n = (await total()) - n0, moved = (await order()) !== was;
        if (live) t.expect(n === 1 && moved, `${what}: the rack is shuffled (${n} sounds)`);
        else t.expect(n === 0 && !moved, `${what}: nothing is heard and nothing moves (${n} sounds)`);
      };
      await newGame(t, null, PASS_PLAY);
      if (await t.page.evaluate(() => window.__G.privacy)) await t.game('act', 'reveal');
      await tries('your turn', true);
      const key = (init) => t.page.evaluate((x) => { const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...x }); document.body.dispatchEvent(e); return e.defaultPrevented; }, init);
      const was = await order();
      for (const mod of ['ctrlKey', 'metaKey']) {
        for (const k of ['R', 'S', 'P', 'H', 'B', 'U', '?']) t.expect(!(await key({ key: k, shiftKey: true, [mod]: true })), `${mod}+Shift+${k} is left to the browser`);
      }
      const s = await t.state();
      t.expect(s.scene === 'game' && !s.dialog && (await order()) === was, 'and did nothing here');
      await t.game('act', 'pass');
      await t.page.waitForFunction(() => window.__G.privacy, null, { timeout: 8000 });
      await t.waitIdle(5000);
      await tries('behind the curtain', false);
      await t.page.click('#privacy [data-reveal]');
      await t.waitIdle(5000);
      await tries('after the curtain', true);
      // a finished game still on screen
      await t.page.evaluate(() => { window.__G.s.over = true; });
      await tries('a finished game', false);
      await t.page.evaluate(() => { window.__G.s.over = false; });
      // only computers at the table
      await t.page.evaluate(() => { for (const p of window.__G.s.players) { p.kind = 'ai'; p.level = 'easy'; } });
      await tries('only computers', false);
    },
  },
];
