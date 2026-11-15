// Wave 3, batch E: S4-08 (a hedge on the Capone card), S1-09 (a blank is not spent by a typo), S3-19 (score-sized
// rewards), S5-05 (your turn), S5-06 (effects and music levels), S5-08 (stings wait for the tiles) and S2-17 (soft cues).
import fs from 'node:fs';
import path from 'node:path';
import { root } from './lib.mjs';
import { stingFor } from '../src/js/ui.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const CENTER = 112;
async function start(t, rack, extra = {}) {
  await ready(t);
  await t.game('newGame', { seed: 3, ...extra });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));

export const tests = [
  // ---------- S4-08 ----------
  {
    name: 'S4-08 the Capone card hedges the floor it says he rented', node: true,
    async run(t) {
      const lex = JSON.parse(fs.readFileSync(path.join(root, 'data/lexicon.game.json'), 'utf8'));
      const cards = lex.words.map((w) => w.fact.text).filter((x) => /Capone/.test(x) && /entire floor/.test(x));
      t.equal(cards.length, 1, 'one card says Capone rented a floor');
      t.expect(/reportedly/.test(cards[0]), 'and it says "reportedly" (' + cards[0] + ')');
    },
  },
  // ---------- S1-09 ----------
  {
    name: 'S1-09 a letter you do not hold asks before it spends your blank',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, '?ABCDEF');
      await t.page.keyboard.press('q');
      let s = await t.state();
      t.equal(s.staged.length, 0, 'one press of Q does not use the blank');
      t.expect(/Press Q again to use your blank/.test(await t.page.textContent('#preview')), 'the strip says how (' + (await t.page.textContent('#preview')).trim() + ')');
      await t.shot('S1-09-blank-ask');
      await t.page.keyboard.press('z');
      s = await t.state();
      t.equal(s.staged.length, 0, 'a different letter does not use it either');
      await t.page.keyboard.press('q');
      await t.page.keyboard.press('q');
      s = await t.state();
      t.equal(s.staged.length, 1, 'the same letter twice stages the blank');
      t.expect(s.staged[0].l === 'Q' && s.staged[0].blank, 'as a blank standing for Q (' + JSON.stringify(s.staged[0]) + ')');
      await t.page.keyboard.press('a');
      s = await t.state();
      t.equal(s.staged.length, 2, 'a letter you hold goes straight down');
      await t.game('act', 'recall');
      await t.page.keyboard.press('?');
      await t.page.click('[data-tab="keys"]');
      t.expect(/press it twice to use your blank/.test(await t.page.textContent('#screen')), 'the Controls tab says how');
    },
  },
  // ---------- S3-19 ----------
  {
    name: 'S3-19 the sting a play earns: by score, with its own for a new Register word, a Featured Spring and a Full Soak', node: true,
    async run(t) {
      const sf = (score, o = {}, nw = false) => stingFor({ score, ...o }, nw);
      t.equal(sf(24), null, '24 points earns none'); t.equal(sf(25), 'good', '25 earns the rising pair'); t.equal(sf(44), 'good', '44 the same');
      t.equal(sf(45), 'big', '45 earns the run and thump'); t.equal(sf(120), 'big', 'and so does 120');
      t.equal(sf(60, {}, true), 'discover', 'a word new to the Register beats the size');
      t.equal(sf(60, { featured: 'SPRING' }), null, 'a Featured Spring keeps its own bell'); t.equal(sf(60, { full: 50 }, true), null, 'a Full Soak keeps its own chime');
    },
  },
  {
    name: 'S3-19 in the game: a small play is quiet, a Hot Springs word new to the Register has its own sting, the same word later gets the one for its size',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      // stage and play in one turn of the event loop and read the cues it made before any reply can add its own
      const playNow = (tiles) => t.page.evaluate(async (tl) => {
        await window.__game.act('stage', tl);
        const r = await window.__game.act('play');
        const g = window.__game.getState();
        return { ok: r.ok, sfx: g.sfx, entry: g.game.log.filter((x) => x.kind === 'play').pop() };
      }, tiles);
      const stings = (r) => r.sfx.slice(r.sfx.lastIndexOf('play')).filter((n) => ['good', 'big', 'discover'].includes(n));
      await start(t, 'SPRINGE');
      let r = await playNow([{ i: CENTER, l: 'I' }, { i: CENTER + 1, l: 'N' }]);
      t.expect(r.ok && r.entry.score < 25 && !stings(r).length, 'IN for ' + r.entry.score + ' makes no sting');
      // SPRING is a Hot Springs word: new to a fresh Register it has the discovery sting
      await start(t, 'SPRINGE');
      r = await playNow(across('SPRING'));
      t.expect(r.ok, 'SPRING was played');
      t.equal(stings(r).join(','), r.entry.featured ? '' : 'discover', 'a word new to the Register makes the discovery sting (' + r.entry.score + ' points)');
      // the second time it is no longer new, so what is heard is the size of the score
      await start(t, 'SPRINGE');
      r = await playNow(across('SPRING'));
      const size = r.entry.score >= 45 ? 'big' : r.entry.score >= 25 ? 'good' : '';
      t.equal(stings(r).join(','), r.entry.featured ? '' : size, 'the same word again (' + r.entry.score + ' points) makes the sting for its size');
      t.expect(r.entry.score >= 25, 'and that is a size that has one');
    },
  },
  {
    name: 'S3-19 the new cues sit in the mix and nothing they are played with clips at full volume',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const med = (p) => [...p].sort((x, y) => x - y)[p.length >> 1], SPREAD = 10 ** (1.5 / 20);
      const render = async (n, vol) => { const p = []; for (let k = 0; k < 20; k++) p.push((await t.game('act', 'renderSfx', n, vol)).peak); return p; };
      for (const n of ['good', 'big', 'discover', 'yourturn']) {
        const p = await render(n, 0.35);
        t.log(n + ' median ' + med(p));
        t.expect(med(p) >= 0.2 && med(p) <= 0.45, n + ' is typically between 0.2 and 0.45 (median ' + med(p) + ')');
        t.expect(Math.min(...p) >= 0.2 / SPREAD && Math.max(...p) <= 0.45 * SPREAD, n + ' never strays more than 1.5 dB outside it');
      }
      // what each is heard with: the tiles, and the steam of a Hot Springs word
      for (const n of ['play+good@0.28', 'play+big@0.28+steam', 'play+steam+discover@0.28']) {
        const p = await render(n, 1);
        t.log(n + ' full-volume most ' + Math.max(...p));
        t.expect(Math.max(...p) < 0.95, n + ' stays under 0.95 with the volume at full (' + Math.max(...p) + ')');
      }
    },
  },
  // ---------- S5-05 ----------
  {
    name: 'S5-05 a soft cue tells you it is your turn when the computer has played, and not when you have',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      t.expect(!(await t.state()).sfx.includes('yourturn'), 'no cue at the start of a game');
      await t.page.evaluate(async (tl) => { await window.__game.act('stage', tl); await window.__game.act('play'); }, across('SPRING'));
      const own = (await t.state()).sfx;
      t.expect(own.includes('play') && !own.includes('yourturn'), 'your own play does not make it (' + own.join(',') + ')');
      await t.waitIdle(8000);
      await t.page.waitForFunction(() => window.__game.getState().sfx.includes('yourturn'), null, { timeout: 8000 });
      const g = (await t.state()).game;
      t.equal(g.players[g.cur].kind, 'human', 'it is your turn when the cue has sounded');
      const sfx = (await t.state()).sfx;
      t.expect(sfx.lastIndexOf('yourturn') > Math.max(sfx.lastIndexOf('place'), sfx.lastIndexOf('play'), sfx.lastIndexOf('turn')), 'and it is the last thing heard (' + sfx.join(',') + ')');
    },
  },
  {
    name: 'S5-05 the cue is its own sound, not the plain turn cue',
    viewports: ['desktop'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const a = [], b = [];
      for (let k = 0; k < 8; k++) { a.push((await t.game('act', 'renderSfx', 'yourturn', 0.35)).zc); b.push((await t.game('act', 'renderSfx', 'turn', 0.35)).zc); }
      const mean = (x) => x.reduce((p, q) => p + q, 0) / x.length;
      t.expect(Math.abs(mean(a) - mean(b)) > 0.15 * mean(b), 'it does not sound like the plain turn cue (' + mean(a).toFixed(0) + ' against ' + mean(b).toFixed(0) + ' zero crossings)');
    },
  },
];
