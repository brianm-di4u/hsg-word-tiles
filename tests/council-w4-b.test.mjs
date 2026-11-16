// Wave 4, batch B: S2-11, S1-12, S2-12, S3-09, S3-10, S6-13, P-N05, S4-10.
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const normal = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'normal', sound: false })); };
const SEATS = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

async function freezeClock(t) { await t.page.clock.install(); await t.reload(); await ready(t); }
async function stopClock(t) { const now = await t.page.evaluate(() => Date.now()); await t.page.clock.pauseAt(now + 500); }

// pixels of the last-play brass (122,75,7) in a square of the overlay canvas round a cell
const brass = (t, i) => t.page.evaluate(async (cell) => {
  const cv = document.getElementById('board'), [x, y] = await window.__game.act('cell', cell), [x2] = await window.__game.act('cell', cell + 1), k = cv.width / cv.clientWidth;
  const r = Math.round(0.49 * Math.abs(x2 - x) * k), d = cv.getContext('2d').getImageData(Math.round(x * k) - r, Math.round(y * k) - r, 2 * r, 2 * r).data;
  let n = 0;
  for (let j = 0; j < d.length; j += 4) if (Math.abs(d[j] - 122) < 14 && Math.abs(d[j + 1] - 75) < 14 && Math.abs(d[j + 2] - 7) < 14 && d[j + 3] > 200) n++;
  return n;
}, i);

export const tests = [
  {
    name: 'S2-11 the last play wears a dark brass ring and a corner pip, and the glow ends; older tiles do not',
    viewports: ['desktop', 'mobile'], initScript: normal,
    async run(t) {
      await ready(t);
      await freezeClock(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      await stopClock(t);
      const [m] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m.tiles);
      t.expect((await t.game('act', 'play')).ok, 'the human move is played');
      await t.page.clock.runFor(400);
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.aiThinking && g.aiWait.reply; }, null, { timeout: 15000, polling: 50 });
      await t.page.clock.runFor(1500);
      await t.page.waitForFunction(() => window.__game.getState().game.move === 2, null, { timeout: 5000, polling: 50 });
      t.expect((await t.state()).pulse, 'the tiles have landed and the glow is running');
      await t.page.clock.runFor(2500);
      t.expect(!(await t.state()).pulse, 'the glow has ended');
      const st = await t.state(), log = st.game.log.filter((e) => e.kind === 'play');
      const lastCells = log[log.length - 1].tiles.map((x) => x.i), older = log[0].tiles.map((x) => x.i);
      for (const i of lastCells) t.expect((await brass(t, i)) > 12, 'the computer\'s tile ' + i + ' has the brass ring and pip');
      for (const i of older) t.equal(await brass(t, i), 0, 'the player\'s earlier tile ' + i + ' has none');
      await t.page.clock.resume();
      await t.shot('S2-11-last-play');
    },
  },
];
