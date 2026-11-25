// Wave 3, batch W3-B21: W6-S5-03 (a Shuffle slide that never moves the tiles' hit boxes).
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
];
