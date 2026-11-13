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
  {
    name: 'S6-01 wrong-typed daily, register and settings values do not break the title or New game',
    viewports: ['desktop'],
    async run(t) {
      const cases = [
        ['daily days null', 'hs-letters-daily-v1', '{"days":null,"streak":1}'],
        ['daily is an array', 'hs-letters-daily-v1', '[]'],
        ['daily day entry', 'hs-letters-daily-v1', '{"days":{"2026-01-01":5},"streak":1,"last":null}'],
        ['register is a number', 'hs-letters-register-v1', '5'],
        ['register is a string', 'hs-letters-register-v1', '"abc"'],
        ['register entry', 'hs-letters-register-v1', '{"SPRING":{"best":"x"}}'],
        ['settings text string', 'hs-letters-settings-v1', '{"text":"abc","vol":"loud","theme":5,"motion":7}'],
        ['settings vol 40', 'hs-letters-settings-v1', '{"vol":40,"sound":true}'],
        ['settings is an array', 'hs-letters-settings-v1', '[1]'],
        ['lastSetup empty seats', 'hs-letters-settings-v1', '{"lastSetup":{"seats":[]}}'],
        ['lastSetup unknown persona', 'hs-letters-settings-v1', '{"lastSetup":{"seats":[{"kind":"human","name":""},{"kind":"ai","persona":"zzz"}],"hints":true}}'],
        ['lastSetup not an object', 'hs-letters-settings-v1', '{"lastSetup":"x"}'],
      ];
      await ready(t);
      for (const [label, key, val] of cases) {
        await t.page.evaluate(() => localStorage.clear());
        await t.page.evaluate(([k, v]) => localStorage.setItem(k, v), [key, val]);
        await t.reload();
        await ready(t);
        t.expect(await t.page.$('#screen [data-go="setup"]'), label + ': the title shows New game');
        const st = (await t.state()).settings;
        t.expect(st.vol >= 0 && st.vol <= 1 && [1, 1.15, 1.3].includes(st.text) && ['auto', 'light', 'dark'].includes(st.theme), label + ': settings are sane');
        await t.page.click('#screen [data-go="setup"]');
        t.expect(await t.page.$('#screen [data-start]'), label + ': the setup screen renders');
        await t.page.click('#screen [data-start]');
        await t.waitIdle(5000);
        t.equal((await t.state()).scene, 'game', label + ': New game starts');
      }
    },
  },
  {
    name: 'S6-01 a wrong-typed register does not freeze the first Hot Springs play',
    viewports: ['desktop'],
    async run(t) {
      const SPRING = [{ l: 'S', i: 109 }, { l: 'P', i: 110 }, { l: 'R', i: 111 }, { l: 'I', i: 112 }, { l: 'N', i: 113 }, { l: 'G', i: 114 }];
      for (const val of ['5', '"abc"']) {
        await ready(t);
        await t.page.evaluate(() => localStorage.clear());
        await t.page.evaluate((v) => localStorage.setItem('hs-letters-register-v1', v), val);
        await t.reload();
        await ready(t);
        await t.game('newGame', { seed: 11 });
        await t.waitIdle(5000);
        const s = await t.state();
        s.game.players[0].rack = 'SPRINGE'.split(''); s.game.cur = 0;
        await t.game('setState', { game: s.game });
        await t.game('act', 'stage', SPRING);
        const r = await t.game('act', 'play');
        t.expect(r.ok, 'the play is accepted with register ' + val);
        await t.waitIdle(10000);
        const after = await t.state();
        t.expect(after.game.move >= 2, 'the computer replies (move ' + after.game.move + ') with register ' + val);
        const saved = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-save-v1')).move);
        t.equal(saved, after.game.move, 'the save matches the game with register ' + val);
      }
    },
  },
  {
    name: 'S6-01 an uncaught error offers a way back to the title',
    viewports: ['desktop'],
    allowConsoleErrors: true,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 6 });
      await t.waitIdle(5000);
      await t.page.evaluate(() => { setTimeout(() => { throw new Error('council test error'); }, 0); });
      await t.page.waitForSelector('#crash [data-crash]', { timeout: 3000 });
      await t.page.click('#crash [data-crash]');
      t.equal((await t.state()).scene, 'title', 'Back to title leaves the game');
      t.equal(await t.page.$('#crash'), null, 'the notice goes away');
    },
  },
  {
    name: 'S4-23 on a landscape phone New game is on the first screen',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      for (const [w, h] of [[844, 390], [667, 375], [568, 320]]) {
        await t.page.setViewportSize({ width: w, height: h });
        await t.waitForStable();
        const r = await t.page.evaluate(() => { const b = document.querySelector('#screen [data-go="setup"]').getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: innerWidth, h: innerHeight, sw: document.documentElement.scrollWidth }; });
        t.expect(r.top >= 0 && r.bottom <= r.h, w + 'x' + h + ': New game is inside the viewport (' + Math.round(r.top) + '-' + Math.round(r.bottom) + ')');
        t.expect(r.left >= 0 && r.right <= r.w && r.sw <= r.w, w + 'x' + h + ': nothing overflows sideways');
        await t.shot('title-landscape-' + w + 'x' + h);
      }
    },
  },
];
