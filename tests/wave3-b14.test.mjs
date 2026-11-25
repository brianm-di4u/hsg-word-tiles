// Wave 3, batch W3-B14: W5-S3-16 (banners and clacks keep to the landing of the computer's tiles).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const full = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false, motion: 'full' })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'hard' }];

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }
// a game against a Hard computer that holds SPRINGX, with the person's pass made: its reply is in and its tiles are in the air
async function computerPlays(t, patch) {
  await t.seed(5);
  await t.game('newGame', { seats: SEATS });
  await t.waitIdle(8000);
  const s = await t.state();
  s.game.players[1].rack = 'SPRINGX'.split('');
  if (patch) patch(s.game);
  await t.game('setState', { game: s.game });
  await t.waitIdle(5000);
  await stopClock(t);
  await t.game('act', 'pass');
  await t.page.clock.runFor(400);
  await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
  await t.page.keyboard.press('Space');
  await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
}
const look = (t) => t.page.evaluate(() => {
  const G = window.__G, el = document.querySelector('#toast');
  return { toast: el.classList.contains('on') ? el.textContent : '', queued: G.toastQ.length, pops: document.querySelectorAll('.pop').length, flying: G.anim.size };
});
const titles = (t) => t.page.evaluate(() => [window.__G.toastNow, ...window.__G.toastQ].filter(Boolean).map((x) => x.title));

export const tests = [
  // ---------- W5-S3-16 ----------
  {
    name: "W5-S3-16 the computer's banners wait, with its score pop, until its tiles are down, and show at once when the wait is skipped",
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await computerPlays(t);
      const e = (await t.state()).game.log.at(-1);
      t.expect(e.themed > 0 && e.tiles.length >= 4, 'the computer played a Hot Springs word (' + e.words.map((w) => w.w) + ')');
      // six tiles of Opal's land one by one; half a second in they are still coming down
      for (const ms of [0, 250, 250]) {
        await t.page.clock.runFor(ms);
        const v = await look(t);
        t.expect(v.flying > 0, 'the tiles are in the air');
        t.equal(v.toast, '', 'no banner over empty marble');
        t.equal(v.queued, 0, 'and none is queued in front of it');
        t.equal(v.pops, 0, 'and no score pop');
      }
      await t.page.clock.runFor(400);
      let v = await look(t);
      t.expect(/\+\d/.test(v.toast) && v.toast.includes(e.words.find((w) => w.themed).w), 'the banner is there once they are down (' + v.toast + ')');
      t.equal(v.pops, 1, 'with the score pop');

      // skipped in mid-air
      await t.page.clock.resume();
      await t.reload(); await ready(t);
      await computerPlays(t);
      v = await look(t);
      t.equal(v.toast, '', 'nothing yet');
      await t.page.keyboard.press('Space');
      v = await look(t);
      t.equal(v.flying, 0, 'a skip sets the tiles down');
      t.expect(v.toast !== '' && v.pops === 1, 'and the banner and pop come in the same moment (' + v.toast + ')');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W5-S3-16 a Full Soak and a Featured Spring banner of the computer wait for the landing too, and a play made under its falling tiles does not lose them',
    viewports: ['desktop'],
    initScript: full,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      const soak = (g) => {
        g.players[1].rack = 'SPRINGS'.split('');
        g.featured[0] = { ...g.featured[0], word: 'SPRINGS', cat: 'springs', shown: [0], by: null };
        g.players[0].rack = 'AEIOTRN'.split('');
      };
      await computerPlays(t, soak);
      const e = (await t.state()).game.log.at(-1);
      t.expect(e.full > 0 && !!e.featured, 'a Full Soak that claims a Featured Spring (' + e.words.map((w) => w.w) + ')');
      t.equal((await look(t)).toast, '', 'no banner while the tiles fall');
      // the person is quick: a word laid and played before the last tile is down
      const played = await t.page.evaluate(async () => {
        const g = window.__game, m = (await g.act('moves', 40)).find((x) => x.tiles.length >= 2);
        await g.act('stage', m.tiles);
        return { flying: window.__G.anim.size, ok: (await g.act('play')).ok, move: window.__G.s.move };
      });
      t.expect(played.ok && played.flying > 0 && played.move === 3, 'the person played while the tiles were in the air');
      const all = await titles(t);
      t.expect(all.some((x) => /Featured Spring/.test(x)) && all.some((x) => /Full Soak/.test(x)), "the computer's banners are not lost (" + all.join(' | ') + ')');
      await t.page.clock.resume();
      await t.reload(); await ready(t);
      await computerPlays(t, soak);
      t.equal((await look(t)).toast, '', 'no banner while the tiles fall');
      await t.page.clock.runFor(1200);
      const b = await titles(t);
      t.expect(b.some((x) => /Featured Spring/.test(x)) && b.some((x) => /Full Soak/.test(x)), 'both came with the landing (' + b.join(' | ') + ')');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W5-S3-16 the last clack comes before the sting even when no frame is drawn at the moment of landing',
    viewports: ['desktop'],
    initScript: full,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await computerPlays(t);
      // a stalled page: timers run, frames do not
      const at = await t.page.evaluate(() => { window.requestAnimationFrame = () => 1; return window.__game.audioState().played.length; });
      await t.page.clock.runFor(1100);
      const heard = await t.page.evaluate((k) => window.__game.audioState().played.slice(k), at);
      t.log('heard: ' + heard.join(','));
      const n = (await t.state()).game.log.at(-1).tiles.length, st = heard.indexOf('steam');
      t.expect(st >= 0, 'the sting is heard');
      t.expect(heard.lastIndexOf('place') < st && heard.filter((x) => x === 'place').length >= n - 1, 'after all the tiles');
    },
  },
];
