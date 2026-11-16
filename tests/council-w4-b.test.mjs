// Wave 4, batch B: S2-11, S1-12, S2-12, S3-09, S3-10, S6-13, P-N05, S4-10.
import { ctx } from './lib.mjs';
import { createGame, evaluate } from '../src/js/engine.js';
import { validSavedGame } from '../src/js/storage.js';

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

// press on the first rack tile with a pointer of the given kind, move `px` pixels sideways, report whether the tile has lifted
const liftAt = (t, type, px) => t.page.evaluate(([type, px]) => {
  const el = document.querySelector('#rack .rtile[data-pos="0"]'), r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const o = { pointerId: 41, pointerType: type, isPrimary: true, bubbles: true, cancelable: true };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...o, buttons: 1, clientX: x, clientY: y }));
  window.dispatchEvent(new PointerEvent('pointermove', { ...o, buttons: 1, clientX: x + px, clientY: y }));
  const lifted = !!window.__game.getState().drag;
  window.dispatchEvent(new PointerEvent('pointerup', { ...o, buttons: 0, clientX: x + px, clientY: y }));
  return lifted;
}, [type, px]);

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
  {
    name: 'S1-12 a mouse lifts a tile after 3 px, a finger still needs more than 6 px',
    viewports: ['desktop', 'mobile'], initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS });
      await t.waitIdle(8000);
      t.equal(await liftAt(t, 'mouse', 2), false, 'a mouse that has moved 2 px has not lifted it');
      t.equal(await liftAt(t, 'mouse', 4), true, 'a mouse that has moved 4 px has');
      t.equal(await liftAt(t, 'touch', 5), false, 'a finger that has moved 5 px has not');
      t.equal(await liftAt(t, 'touch', 7), true, 'a finger that has moved 7 px has');
    },
  },
  {
    name: 'S2-12 Challenge mode: the engine only marks a game that asks for it, can evaluate without the dictionary, and the save check knows the field (Node)', node: true,
    async run(t) {
      const c = await ctx();
      const seats = [{ kind: 'human', name: 'A' }, { kind: 'ai', persona: 'opal', level: 'easy' }];
      const off = createGame({ mode: 'play', seats, seed: 5 }, c.lex), on = createGame({ mode: 'play', seats, seed: 5, challenge: true }, c.lex);
      t.expect(!('challenge' in off), 'a game that did not ask has no challenge field');
      t.equal(on.challenge, true, 'a game that asked has it');
      const { challenge, ...rest } = on;
      t.equal(JSON.stringify(rest), JSON.stringify(off), 'and nothing else about the deal changes');
      t.expect(!('challenge' in createGame({ mode: 'daily', date: '2026-11-16', seats, challenge: true }, c.lex)), 'the Daily never has it');
      const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
      const at = (p) => p.map((l, k) => ({ i: 111 + k, l }));
      const nonword = perms(on.players[0].rack.slice(0, 5)).map((p) => p.slice(0, 3)).find((p) => evaluate(on, at(p), c).badWord);
      t.expect(!!nonword, 'the seeded rack has an arrangement that is not a word');
      t.expect(evaluate(on, at(nonword), { ...c, skipDict: true }).ok, 'with skipDict the same play is evaluated as legal');
      const plain = JSON.parse(JSON.stringify(on));
      t.expect(validSavedGame(plain), 'a game in progress with the field is a valid save');
      plain.challenge = 'yes'; t.expect(!validSavedGame(plain), 'a wrong-shaped field is not');
      delete plain.challenge; t.expect(validSavedGame(plain), 'and the save without the field still is');
    },
  },
  {
    name: 'S2-12 Setup offers Challenge mode, off by default, and it fits at both sizes',
    viewports: ['desktop', 'mobile'], initScript: instant,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      t.equal(await t.page.isChecked('[data-challenge]'), false, 'it is off');
      t.expect(/Challenge mode: invalid words cost your turn/.test(await t.page.textContent('.setup .check:has([data-challenge])')), 'it is labelled as the finding words it');
      await t.page.check('[data-challenge]');
      await t.checkLayout({ allowScrollY: true });
      await t.page.locator('[data-challenge]').scrollIntoViewIfNeeded();
      await t.shot('S2-12-setup');
      await t.page.click('[data-start]');
      await t.waitIdle(8000);
      t.equal((await t.state()).game.challenge, true, 'the game that starts carries the rule');
      t.equal((await t.state()).settings.lastSetup.challenge, true, 'and the choice is remembered for the next setup');
    },
  },
  {
    name: 'S2-12 in a Challenge game the board does not say whether a word is valid and a non-word loses the turn; in a normal game it is handed back',
    viewports: ['desktop', 'mobile'], initScript: instant,
    async run(t) {
      await ready(t);
      for (const challenge of [true, false]) {
        await t.seed(5);
        await t.game('newGame', { seats: SEATS, challenge });
        await t.waitIdle(8000);
        const rack = (await t.state()).game.players[0].rack;
        const found = await t.page.evaluate(async (rack) => {
          const perms = (a) => (a.length < 2 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
          for (const p of perms(rack.slice(0, 5))) { const w = p.slice(0, 3).join(''); if (!w.includes('?') && !(await window.__game.act('has', w))) return w; }
          return null;
        }, rack);
        t.expect(!!found, 'a non-word can be made from the rack');
        t.expect((await t.game('act', 'stage', [...found].map((l, k) => ({ i: 111 + k, l })))).ok, 'the tiles are staged');
        const st = await t.state(), strip = await t.page.textContent('#preview'), cls = await t.page.getAttribute('#preview', 'class');
        if (challenge) {
          t.expect(st.preview.ok && /checked when you play/.test(strip) && !/bad/.test(cls), 'the strip shows the words and score and says they are checked when played (' + strip.slice(0, 80) + ')');
          await t.shot('S2-12-preview-challenge');
          await t.game('act', 'play');
          await t.waitIdle(15000);
          const after = await t.state(), pass = after.game.log.find((e) => e.kind === 'pass');
          t.expect(!!pass && pass.p === 0 && pass.challenge === found, 'the log has a lost turn naming ' + found);
          t.equal(after.game.log.filter((e) => e.kind === 'play' && e.p === 0).length, 0, 'the player has no play on the board');
          t.equal(after.game.players[0].score, 0, 'nothing was scored');
          t.equal(after.game.players[0].rack.slice().sort().join(''), rack.slice().sort().join(''), 'the player keeps every tile');
          t.expect(after.game.log.length >= 2, 'and the computer has taken its turn');
          await t.game('act', 'open', 'ledger');
          t.expect(/is not a word/.test(await t.page.textContent('.ledger-dlg')), 'the steam ledger says why');
          await t.game('act', 'close');
        } else {
          t.expect(!st.preview.ok && st.preview.badWord === found && /bad/.test(cls), 'a normal game says it is not a word (' + strip.slice(0, 80) + ')');
          t.equal((await t.game('act', 'play')).ok, false, 'and refuses it');
          t.equal((await t.state()).game.move, 0, 'with the turn kept');
        }
      }
    },
  },
  {
    name: 'S2-12 a game in progress keeps its rule after a reload',
    viewports: ['desktop', 'mobile'], initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(5);
      await t.game('newGame', { seats: SEATS, challenge: true });
      await t.waitIdle(8000);
      await t.reload(); await ready(t);
      await t.page.click('[data-go="continue"]');
      await t.waitIdle(8000);
      t.equal((await t.state()).game.challenge, true, 'Continue resumes the Challenge game');
    },
  },
];
