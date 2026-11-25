// Wave 3, batch W3-B14: W5-S3-16 (banners and clacks keep to the landing of the computer's tiles), W5-S4-02 (score roll and
// plaque reveals that outlive the hand-over redraw, breakdown unfold, results arriving card by card).
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

  // ---------- W5-S4-02 ----------
  {
    name: "W5-S4-02 a person's score goes on counting, and a claimed plaque goes on shimmering, through the redraw that hands the turn over",
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.players[0].rack = 'SPRINGA'.split('');
      s.game.featured[0] = { ...s.game.featured[0], word: 'SPRING', cat: 'springs', shown: [0], by: null };
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);
      await t.page.addStyleTag({ content: '.score.bump, .just-claimed { animation-play-state: paused !important; }' });   // real-time CSS held still: the game's clock is the only one running
      await stopClock(t);
      await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: 110 + k, l })));
      t.expect((await t.game('act', 'play')).ok, 'SPRING played');
      const at = () => t.page.evaluate(() => {
        const el = document.querySelector('[data-score="0"]'), pl = document.querySelector('.plaque.just-claimed, .springs-bar.just-claimed');
        const d = (x) => (x ? parseFloat(x.style.animationDelay) || 0 : null);
        return { n: Number(el.textContent), to: window.__G.s.players[0].score, node: window.__el === el, bump: el.classList.contains('bump'), delay: d(el), claim: !!pl, claimDelay: d(pl), other: document.querySelector('[data-score="1"]').classList.contains('bump') };
      });
      await t.page.evaluate(() => { window.__el = document.querySelector('[data-score="0"]'); });
      let v = await at();
      t.equal(v.n, 0, 'it starts from the old score');
      t.expect(v.bump && v.claim && !v.other, 'with the bump, and the claimed plaque shimmering');
      await t.page.clock.runFor(120);
      v = await at();
      t.expect(v.node && v.n > 0 && v.n < v.to, 'counting before the hand-over (' + v.n + ' of ' + v.to + ')');
      const n1 = v.n;
      await t.page.clock.runFor(60);
      v = await at();
      t.equal(v.node, false, 'the cards were redrawn when the turn passed to the computer');
      t.expect(v.n >= n1 && v.n < v.to, 'and the count goes on, not cut short (' + n1 + ', then ' + v.n + ' of ' + v.to + ')');
      t.expect(v.bump && v.delay < -100, 'the bump goes on from where it was (' + v.delay + ' ms)');
      t.expect(v.claim && v.claimDelay < -100, 'and so does the plaque, instead of starting over (' + v.claimDelay + ' ms)');
      t.equal(v.other, false, "the computer's score does not move");
      await t.page.clock.runFor(140);
      v = await at();
      t.equal(v.n, v.to, 'the count ends on the score');
      t.equal(v.claim, false, 'and the shimmer is over');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W5-S4-02 a score caught in mid-count lands on the real number when motion is turned off, and then nothing counts',
    viewports: ['desktop'],
    initScript: () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false, motion: 'system' })); },
    async run(t) {
      await t.page.emulateMedia({ reducedMotion: 'no-preference' });
      await ready(t);
      await freezeClock(t);
      const start = async () => {
        await t.seed(5);
        await t.game('newGame', { seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }] });
        await t.waitIdle(8000);
        const s = await t.state();
        s.game.players[0].rack = 'SPRINGA'.split('');
        await t.game('setState', { game: s.game });
        await stopClock(t);
      };
      const play = async () => { await t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: 110 + k, l }))); return (await t.game('act', 'play')).ok; };
      const read = () => t.page.evaluate(() => ({ n: Number(document.querySelector('[data-score="0"]').textContent), to: window.__G.s.players[0].score }));
      await start();
      t.expect(await play(), 'played');
      await t.page.clock.runFor(60);
      let v = await read();
      t.expect(v.n < v.to, 'mid-count (' + v.n + ' of ' + v.to + ')');
      await t.page.emulateMedia({ reducedMotion: 'reduce' });
      await t.page.waitForFunction(() => document.body.classList.contains('reduce'));
      v = await read();
      t.equal(v.n, v.to, 'the number is the real one at once');
      await t.page.clock.resume();
      await start();
      t.expect(await play(), 'played with reduced motion');
      v = await read();
      t.equal(v.n, v.to, 'the score is simply there');
      t.equal(await t.page.locator('.score.bump').count(), 0, 'with no bump');
      await t.page.clock.resume();
    },
  },
  {
    name: 'W5-S4-02 the score breakdown unfolds in 160 ms when it is opened, once, and not at all with reduced motion',
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: SEATS });
      await t.waitIdle(8000);
      const s = await t.state();
      s.game.players[0].rack = 'SPRINGA'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(5000);
      const stage = () => t.game('act', 'stage', [...'SPRING'].map((l, k) => ({ i: 110 + k, l })));
      const bd = () => t.page.evaluate(() => { const el = document.querySelector('#preview .bd'); if (!el) return null; const c = getComputedStyle(el); return { name: c.animationName, dur: c.animationDuration, h: el.getBoundingClientRect().height }; });
      await stage();
      await t.page.click('#preview .bdbtn');
      let v = await bd();
      t.equal(v.name, 'unfold', 'it unfolds');
      t.equal(v.dur, '0.16s', 'in 160 ms');
      // the strip is redrawn while it is open (a hovered square's rule): it must not unfold again
      if (t.viewport === 'desktop') {
        const [x, y] = await t.game('act', 'screen', 8);   // an empty Bathhouse Row square
        await t.page.mouse.move(x, y); await t.page.mouse.move(x + 2, y + 1);
        await t.page.waitForFunction(() => document.querySelector('#preview .sq-tip'));
        v = await bd();
        t.equal(v && v.name, 'none', 'a redraw of the open breakdown does not play it again');
      }
      await t.page.evaluate(() => document.getAnimations().forEach((a) => { try { a.finish(); } catch (e) { /* endless */ } }));
      await t.shot('w3-b14-breakdown', { wait: false });
      await t.game('act', 'recall');
      await t.page.evaluate(() => { const st = JSON.parse(localStorage.getItem('hs-letters-settings-v1')); st.motion = 'reduce'; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(st)); });
      await t.reload(); await ready(t);
      await t.game('newGame', { seed: 3, seats: SEATS });
      await t.waitIdle(8000);
      const s2 = await t.state();
      s2.game.players[0].rack = 'SPRINGA'.split('');
      await t.game('setState', { game: s2.game });
      await t.waitIdle(5000);
      await stage();
      await t.page.click('#preview .bdbtn');
      t.equal((await bd()).name, 'none', 'reduced motion: it is simply open');
    },
  },
  {
    name: 'W5-S4-02 the results arrive card by card after the last play, with the buttons and the focus there at once, and not again on coming back',
    viewports: ['desktop', 'mobile'],
    initScript: full,
    async run(t) {
      await ready(t);
      const end = async () => {
        await t.seed(5);
        await t.game('newGame', { seats: SEATS });
        await t.waitIdle(8000);
        const st = await t.state(), g = st.game;
        g.board = g.board.map(() => null);
        [...'CAT'].forEach((l, k) => { g.board[111 + k] = { l, blank: false }; });
        g.bag = []; g.move = 10; g.cur = 0;
        g.players[0].rack = ['S']; g.players[0].score = 120; g.players[1].rack = ['E', 'R']; g.players[1].score = 80;
        await t.game('setState', { game: g });
        await t.waitIdle(5000);
        await t.game('act', 'stage', [{ i: 114, l: 'S' }]);
        await t.page.evaluate(() => { const o = new MutationObserver(() => { const el = document.querySelector('#screen .over'); if (!el) return; o.disconnect(); window.__over = read(el); });
          const read = (box) => [...box.children].map((c) => { const cs = getComputedStyle(c); return { c: c.className || c.tagName, name: cs.animationName, ms: parseFloat(cs.animationDelay) * 1000, dur: parseFloat(cs.animationDuration) * 1000 }; }).concat([{ c: 'focus', name: box.contains(document.activeElement) ? document.activeElement.tagName : 'elsewhere' }]);
          window.__over = null; o.observe(document.querySelector('#screen'), { childList: true }); });
        t.expect((await t.game('act', 'play')).ok, 'the last play');
        await t.page.waitForFunction(() => window.__over, null, { timeout: 8000 });
        return t.page.evaluate(() => window.__over);
      };
      let v = await end();
      const by = (c) => v.find((x) => x.c.split(' ')[0] === c);
      t.log(v.map((x) => `${x.c}: ${x.name} ${x.ms ?? ''}`).join(' | '));
      const cards = ['winner', 'final', 'over-cols'].map(by);
      t.expect(cards.every((x) => x && x.name === 'arrive'), 'the winner, the others and the word lists each arrive');
      t.expect(by('masthead').ms === 0 && cards[0].ms > 0 && cards[1].ms > cards[0].ms && cards[2].ms > cards[1].ms, 'one after another (' + cards.map((x) => x.ms) + ' ms)');
      t.expect(cards[2].ms + cards[2].dur <= 500, 'and all are there within half a second');
      t.equal(by('dlg-btns').name, 'none', 'the buttons do not wait');
      t.equal(v.at(-1).name, 'H1', 'and the keyboard is on the heading already, as before');
      await t.page.waitForFunction(() => document.querySelector('#screen .over').getAnimations({ subtree: true }).length === 0, null, { timeout: 5000 });
      await t.shot('w3-b14-results');
      t.expect(await t.page.evaluate(() => [...document.querySelectorAll('#screen .over > *')].every((c) => getComputedStyle(c).opacity === '1')), 'everything is fully there at the end');
      await t.page.click('.over [data-go="register"]');
      await t.page.click('#screen [data-back]');
      await t.page.waitForFunction(() => document.querySelector('#screen .over'));
      t.equal(await t.page.locator('.over.arrive').count(), 0, 'back from the Register the results are simply there');
      await t.page.evaluate(() => { const st = JSON.parse(localStorage.getItem('hs-letters-settings-v1')); st.motion = 'reduce'; localStorage.setItem('hs-letters-settings-v1', JSON.stringify(st)); });
      await t.reload(); await ready(t);
      v = await end();
      t.expect(v.every((x) => x.c === 'focus' || x.name === 'none'), 'reduced motion: nothing moves');
    },
  },
];
