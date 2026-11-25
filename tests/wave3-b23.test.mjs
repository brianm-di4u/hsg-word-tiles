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
];
