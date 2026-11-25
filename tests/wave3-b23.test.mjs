// Wave 3, follow-up batch W3-B23-hotfix: the wave 3 verifiers' required follow-ups.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
// the computer at its normal pace, and every request to its worker can be kept back (__hold) and let through later (__release)
const heldWorker = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false }));
  const post = Worker.prototype.postMessage, kept = [];
  window.__hold = false; window.__kept = kept;
  Worker.prototype.postMessage = function (...a) { if (window.__hold) kept.push(() => post.apply(this, a)); else post.apply(this, a); };
  window.__release = () => { window.__hold = false; for (const f of kept.splice(0)) f(); };
};
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, theme: 'light' })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
const until = (t, f) => t.page.waitForFunction(f, null, { timeout: 15000, polling: 50 });

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }
// a new game on a stopped clock with the computer (seat 1) thinking; with hold, its reply is not worked out until __release
async function thinking(t, hold) {
  await t.page.clock.resume();
  await t.seed(5);
  await t.game('newGame', { seats: SEATS });
  await t.waitIdle(8000);
  await stopClock(t);
  await t.page.evaluate((h) => { window.__hold = h; }, hold);
  await t.game('act', 'pass');
  await t.page.clock.runFor(200);
  if (hold) await until(t, () => window.__game.getState().aiThinking && window.__kept.length === 1);
  else await until(t, () => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; });
}

export const tests = [
  // ---------- W4-P-N01 ----------
  {
    name: 'W4-P-N01 a game replaced while the computer thinks leaves nobody thinking, before or after its reply is in',
    viewports: ['desktop'],
    initScript: heldWorker,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      for (const hold of [true, false]) {
        const what = hold ? 'before the reply' : 'with the reply waiting';
        await thinking(t, hold);
        const g = (await t.state()).game;
        g.cur = 0; g.move += 1;
        await t.game('setState', { game: g });
        t.equal((await t.state()).aiThinking, true, `${what}: the old reply is still on its way`);
        if (hold) {
          await t.page.evaluate(() => window.__release());
          await until(t, () => !window.__game.getState().aiThinking);
        } else await t.page.clock.runFor(1500);
        const s = await t.state();
        t.equal(`${s.aiThinking} ${s.aiWait.reply} ${s.game.move} ${s.game.cur}`, `false false ${g.move} 0`, `${what}: nobody is thinking and the new game has not moved`);
        const [m] = await t.game('act', 'moves', 1);
        await t.game('act', 'stage', m.tiles);
        t.expect((await t.game('act', 'play')).ok, `${what}: the person can play at once`);
      }
      await t.page.clock.resume();
    },
  },
  {
    name: 'W4-P-N01 a reply that lands while Help, Settings, the menu or the ledger is open is held and played on the way back',
    viewports: ['desktop'],
    initScript: heldWorker,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      for (const where of ['help', 'settings', 'pause', 'ledger']) {
        await thinking(t, true);
        if (where === 'help') await t.page.keyboard.press('?');
        else if (where === 'ledger') await t.page.click('#b-ledger');
        else {
          await t.page.click('#b-menu');
          if (where === 'settings') await t.page.click('#modal [data-go="settings"]');
        }
        const at = async () => { const s = await t.state(); return s.scene === 'game' ? s.dialog : s.scene; };
        t.equal(await at(), where, `${where} is open before the reply is in`);
        const move = (await t.state()).game.move;
        await t.page.evaluate(() => window.__release());
        await until(t, () => window.__game.getState().aiWait.reply);
        await t.page.clock.runFor(3000);   // past the computer's pause: its reply lands here
        let s = await t.state();
        t.equal(`${s.aiHeld} ${s.aiThinking} ${s.game.move}`, `true true ${move}`, `${where}: the reply is held, still the computer's turn, nothing played`);
        if (where === 'pause' || where === 'ledger') await t.page.click('#modal [data-close]');
        else await t.page.click('#screen [data-back]');
        await t.page.clock.runFor(4000);
        s = await t.state();
        t.equal(`${s.game.move} ${s.game.cur} ${s.aiHeld} ${s.aiThinking}`, `${move + 1} 0 false false`, `${where}: back in the game the computer plays and the turn comes back`);
      }
      await t.page.clock.resume();
    },
  },
  // ---------- W6-S2-04, W5-S1-02 ----------
  {
    name: 'W6-S2-04 W5-S1-02 the bag on the turn line takes taps over at least 44 px on phones, and nothing moves or loses its own taps for it',
    viewports: ['mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const ai = (persona, level) => ({ kind: 'ai', persona, level }), you = { kind: 'human', name: 'You' };
      const GAMES = {
        'two players': { seed: 5, seats: [you, ai('opal', 'easy')] },
        'four players': { seed: 5, seats: [you, ai('opal', 'easy'), ai('hollis', 'medium'), ai('julian', 'hard')] },
        'the final stretch': { seed: 5, seats: [you, ai('opal', 'easy')], bag: ['A', 'B', 'C'] },
        'an empty bag': { seed: 5, seats: [you, ai('opal', 'easy')], bag: [] },
        'the Daily Soak': { mode: 'daily', date: '2026-11-20' },
      };
      for (const text of [1, 1.3]) {
        await t.page.evaluate((v) => { const k = 'hs-letters-settings-v1', s = JSON.parse(localStorage.getItem(k)); s.text = v; localStorage.setItem(k, JSON.stringify(s)); }, text);
        await t.reload();
        await ready(t);
        for (const [w, h] of [[390, 844], [360, 640], [320, 568], [844, 390], [568, 320]]) {
          await t.page.setViewportSize({ width: w, height: h });
          await t.waitFrames(3);
          for (const [what, { bag, ...game }] of Object.entries(GAMES)) {
            const where = `${w}x${h} ${text * 100}% ${what}`;
            await t.game('newGame', game);
            await t.waitIdle(8000);
            if (game.mode === 'daily') await t.page.waitForFunction(() => document.querySelectorAll('#turnline .par-pip').length === 2, null, { timeout: 15000 });
            if (bag) { const g = (await t.state()).game; g.bag = bag; await t.game('setState', { game: g }); await t.waitFrames(2); }
            const m = await t.page.evaluate(() => {
              const btn = document.querySelector('#turnline [data-open-tracker]'), r = btn.getBoundingClientRect(), cx = r.left + r.width / 2;
              // the run of points on a line, through the button, that press it
              const span = (at, from, n) => { let lo = from, hi = from; while (lo > 0 && btn.contains(at(lo - 0.5))) lo -= 0.5; while (hi < n && btn.contains(at(hi + 0.5))) hi += 0.5; return [lo, hi]; };
              const [top, low] = span((y) => document.elementFromPoint(cx, y), r.top + 4, innerHeight), [left, right] = span((x) => document.elementFromPoint(x, r.top + 4), cx, innerWidth);
              const rects = () => JSON.stringify(['#topbar', '#turnline', '#turnline .chips', '#turnline [data-open-tracker]', '#b-menu', '#springs', '#boardwrap', '#rackbar', '#actions'].map((q) => { const b = document.querySelector(q).getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; }));
              const others = () => { const o = {}; for (let y = 1; y < innerHeight; y += 4) for (let x = 1; x < innerWidth; x += 4) { const e = document.elementFromPoint(x, y)?.closest('button, a, input, canvas, [tabindex]'); if (e && e !== btn) o[x + ',' + y] = e; } return o; };
              const withIt = rects(), taps = others();
              const st = document.createElement('style'); st.textContent = '#turnline .bag-btn::after, #turnline .bag-link::after { display: none !important; }'; document.head.append(st);
              const without = rects(), base = others();
              st.remove();
              return { h: low - top, w: right - left, top, cx, moved: withIt !== without, lost: Object.keys(base).filter((k) => taps[k] !== base[k]).map((k) => `${base[k].id || base[k].className} at ${k}`), name: btn.getAttribute('aria-label') };
            });
            t.expect(m.h >= 44 && m.w >= 44, `${where}: the bag takes taps over ${m.w} x ${m.h} px`);
            t.equal(`${m.moved} ${m.lost}`, 'false ', `${where}: nothing has moved, and no other control lost a tap`);
            t.expect(/open Unseen tiles$/.test(m.name), `${where}: ${m.name}`);
            if (text === 1 && w === 390) {   // a real tap near the top of it, above the button's own box
              await t.tap([m.cx, m.top + 2]);
              await t.page.waitForFunction(() => window.__game.getState().dialog === 'tracker', null, { timeout: 5000 });
              await t.game('act', 'close');
              await t.waitFrames(2);
              await t.shot('w3-b23-bag-' + what.split(' ').pop());
            }
          }
        }
      }
    },
  },
];
