// Wave 1, batch A: S3-11 (replace-save confirm), S5-18 (hidden tab), S6-01 (bad storage values), S4-23 (title in landscape).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const rawSave = (t) => t.page.evaluate(() => { const r = localStorage.getItem('hs-letters-save-v1'); if (!r) return null; const g = JSON.parse(r); return g.mode + ':' + g.seed + ':' + g.move; });

async function gameInProgress(t) {
  await ready(t);
  await t.game('newGame', { seed: 6 });
  await t.waitIdle(5000);
  await t.game('act', 'pass');
  await t.waitIdle(10000);
  await t.game('scene', 'title');
  const raw = await rawSave(t);
  t.expect(raw && +raw.split(':')[2] >= 1, 'a game is saved before the test starts');
  return raw;
}

export const tests = [
  {
    name: 'S3-11 Daily Soak asks before replacing a game in progress',
    viewports: ['desktop'],
    async run(t) {
      const raw = await gameInProgress(t);
      await t.page.click('#screen [data-go="daily"]');
      t.equal((await t.state()).dialog, 'confirm', 'a confirm dialog opens');
      t.equal(await rawSave(t), raw, 'the saved game is untouched while the dialog is open');
      await t.page.click('#modal [data-close]');
      t.equal((await t.state()).scene, 'title', 'Cancel stays on the title');
      t.equal(await rawSave(t), raw, 'Cancel keeps the saved game');
      await t.page.click('#screen [data-go="daily"]');
      await t.page.click('#modal [data-ok]');
      await t.waitIdle(5000);
      const s = await t.state();
      t.equal(s.scene, 'game', 'confirming starts the Daily');
      t.equal(s.game.mode, 'daily', 'it is the Daily');
    },
  },
  {
    name: 'S3-11 New game Start asks before replacing a game in progress',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      const raw = await gameInProgress(t);
      await t.page.click('#screen [data-go="setup"]');
      t.equal((await t.state()).dialog, null, 'opening setup asks nothing');
      await t.page.click('#screen [data-start]');
      t.equal((await t.state()).dialog, 'confirm', 'Start opens a confirm dialog');
      t.equal(await rawSave(t), raw, 'the saved game is untouched while the dialog is open');
      await t.page.click('#modal [data-close]');
      t.equal((await t.state()).scene, 'setup', 'Cancel stays on setup');
      t.equal(await rawSave(t), raw, 'Cancel keeps the saved game');
      await t.page.click('#screen [data-start]');
      await t.page.click('#modal [data-ok]');
      await t.waitIdle(5000);
      t.equal((await t.state()).scene, 'game', 'confirming starts the game');
      t.expect((await rawSave(t)) !== raw, 'the slot now holds the new game');
    },
  },
  {
    name: 'S3-11 with no saved game nothing is asked',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="daily"]');
      await t.waitIdle(5000);
      t.equal((await t.state()).scene, 'game', 'Daily starts straight away');
    },
  },
  {
    name: 'S5-18 a hidden tab silences audio and holds the computer reply',
    viewports: ['desktop'],
    initScript: () => {
      window.__ctxs = [];
      const AC = window.AudioContext;
      window.AudioContext = class extends AC { constructor(...a) { super(...a); window.__ctxs.push(this); } };
    },
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      const ctxState = () => t.page.evaluate(() => (window.__ctxs[0] ? window.__ctxs[0].state : 'none'));
      t.equal(await ctxState(), 'running', 'the audio context is running while visible');
      const hide = (hidden) => t.page.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
      await t.page.evaluate(() => window.__game.act('pass'));
      await hide(true);
      await t.page.waitForTimeout(1800);
      let s = await t.state();
      t.equal(s.game.move, 1, 'the computer has not replied while hidden');
      t.equal(s.aiThinking, true, 'its reply is held, not dropped');
      t.equal(await ctxState(), 'suspended', 'audio is suspended while hidden');
      await hide(false);
      await t.waitIdle(10000);
      s = await t.state();
      t.expect(s.game.move >= 2, 'the computer replies once the tab is visible again');
      t.equal(await ctxState(), 'running', 'audio resumes when visible');
    },
  },
];
