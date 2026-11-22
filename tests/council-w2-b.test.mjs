// Wave 2, batch B: S3-02 (difficulty chosen apart from the character, a smoother ladder, Lucky's habit)
// and P-N01 (the dictionary supplement).
import { ctx } from './lib.mjs';
import { playMatch } from '../tools/balance.mjs';
import { LEVELS, STYLES, premiumPoints, chooseAction } from '../src/js/ai.js';
import { createGame, apply } from '../src/js/engine.js';
import { SUPPLEMENT } from '../src/js/supplement.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const settingsKey = 'hs-letters-settings-v1';
// the opponent is a row of portrait cards (S4-06); the chosen one is the card with aria-checked
const opponent = (t) => t.page.getAttribute('[data-persona="1"][aria-checked="true"]', 'data-val');
const stored = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k) || '{}'), settingsKey);
const fresh = () => ({ ms: {}, plays: 0, points: 0, themed: 0, full: 0, featured: 0, themedPlays: 0, swap: 0, pass: 0, moves: 0 });

// a pairing over `n` games with the seeds balance.mjs uses; the first side starts every other game
async function pairing(a, b, n) {
  let wins = 0, ties = 0;
  const st = fresh();
  for (let g = 0; g < n; g++) {
    const flip = g % 2 === 1;
    const s = await playMatch(flip ? [b, a] : [a, b], 1000 + g, st);
    const sa = s.players[flip ? 1 : 0].score, sb = s.players[flip ? 0 : 1].score;
    if (sa > sb) wins++; else if (sa === sb) ties++;
  }
  return { rate: wins / n, ties, st };
}

export const tests = [
  {
    name: 'S3-02 Medium beats Easy between 70 and 90 percent of 100 games, not every game', node: true,
    async run(t) {
      const r = await pairing('medium', 'easy', 100);
      t.log(`medium over easy ${r.rate}`);
      t.expect(r.rate >= 0.7 && r.rate <= 0.9, `Medium beats Easy ${r.rate} of 100 games (target 0.70 to 0.90)`);
    },
  },
  {
    name: 'S3-02 Hard beats Medium between 60 and 75 percent of 100 games, inside the move-time budget', node: true,
    async run(t) {
      const r = await pairing('hard', 'medium', 100);
      t.log(`hard over medium ${r.rate}`);
      t.expect(r.rate >= 0.6 && r.rate <= 0.75, `Hard beats Medium ${r.rate} of 100 games (target 0.60 to 0.75)`);
      const ms = r.st.ms.hard.slice().sort((a, b) => a - b);
      const p95 = ms[Math.floor(0.95 * ms.length)];
      t.expect(p95 < 250, `Hard's 95th percentile move time stays under 250 ms (${p95.toFixed(1)})`);
    },
  },
  {
    name: 'S3-02 Lucky favours premium squares and stays about as strong as Hollis', node: true,
    async run(t) {
      const r = await pairing('medium:lucky', 'medium:hollis', 100);
      const share = (who) => r.st.prem[who] / r.st.pts[who];
      t.log(`lucky over hollis ${r.rate}; premium share lucky ${share('lucky').toFixed(3)}, hollis ${share('hollis').toFixed(3)}`);
      t.expect(share('lucky') > share('hollis') + 0.02, 'Lucky takes a clearly larger share of his points from premium squares');
      t.expect(r.rate >= 0.35 && r.rate <= 0.65, `Lucky and Hollis stay evenly matched (${r.rate})`);
    },
  },
  {
    name: 'S3-02 the style is read from the persona, applies at every level and keeps moves legal', node: true,
    async run(t) {
      const c = await ctx();
      t.expect(STYLES.lucky && !STYLES.hollis, 'only Lucky has a style of his own');
      for (const level of ['easy', 'medium', 'hard']) {
        const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level, persona: 'lucky' }, { kind: 'ai', level: 'medium', persona: 'hollis' }], seed: 77 }, c.lex);
        let n = 0;
        while (!s.over && n++ < 400) {
          const { action } = chooseAction(c.dict, c.lex, s, { level: s.players[s.cur].level, persona: s.players[s.cur].persona });
          const r = apply(s, action, c);
          if (!r.ok) { t.fail(`${level} Lucky made an illegal ${action.type}: ${r.error}`); break; }
        }
        t.expect(s.over, `a Lucky game at ${level} finishes`);
      }
      t.expect(premiumPoints({ tiles: [{ i: 0, l: 'A' }], score: 1 }) >= 0, 'premium points are never negative');
      t.expect(LEVELS.easy.slip > 0 && LEVELS.easy.slip < 1, 'Easy slips only some of the time');
    },
  },
  {
    name: 'S3-02 each computer seat has a Difficulty choice, starting at the character and settable apart from it',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      t.equal(await opponent(t), 'hollis', 'the default opponent is Hollis');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'medium', 'his usual level is Medium');
      t.expect(/common words and all the short ones/.test(await t.page.textContent('[data-level-note="1"]')), 'a sentence says what Medium means');
      await t.page.click('[data-persona="1"][data-val="opal"]');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'easy', 'Opal starts at Easy');
      await t.page.selectOption('[data-level="1"]', 'hard');
      t.expect(/every word in the book/.test(await t.page.textContent('[data-level-note="1"]')), 'the sentence follows the level');
      await t.page.click('[data-persona="1"][data-val="lucky"]');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'hard', 'changing the character keeps the level the player chose');
      const cards = await t.page.$$eval('[data-persona="1"]', (o) => o.map((x) => x.textContent));
      t.expect(cards.every((x) => /Usually (Easy|Medium|Hard)/.test(x)), 'each character card names only the level it usually plays at');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('S3-02-setup');
      await t.page.click('#screen [data-start]');
      await t.waitIdle(5000);
      const s = (await t.state()).game;
      t.equal(s.players[1].persona, 'lucky', 'the opponent is Lucky');
      t.equal(s.players[1].level, 'hard', 'and plays at the level chosen');
      if (t.viewport === 'desktop') t.expect(/Hard · fictional/.test(await t.page.textContent('body')), 'the score card names the level in play');
      t.equal((await stored(t)).lastSetup.seats[1].level, 'hard', 'the choice is remembered for the next game');
      await t.reload();
      await t.page.click('#screen [data-go="setup"]');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'hard', 'and survives a reload');
    },
  },
  {
    name: 'S3-02 a damaged level in the saved setup falls back to the default setup without an error',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ lastSetup: { hints: true, seats: [{ kind: 'human', name: '' }, { kind: 'ai', persona: 'opal', level: 'godlike' }] } })), settingsKey);
      await t.reload();
      await t.page.click('#screen [data-go="setup"]');
      t.equal(await opponent(t), 'hollis', 'the damaged setup is dropped');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'medium', 'with the default level');
    },
  },
  {
    name: 'S3-02 an old saved setup with no level still opens at the usual level of its character',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ lastSetup: { hints: true, seats: [{ kind: 'human', name: 'Ann' }, { kind: 'ai', persona: 'julian' }] } })), settingsKey);
      await t.reload();
      await t.page.click('#screen [data-go="setup"]');
      t.equal(await t.page.inputValue('[data-level="1"]'), 'hard', 'Julian is still Hard');
      await t.page.click('#screen [data-start]');
      await t.waitIdle(5000);
      t.equal((await t.state()).game.players[1].level, 'hard', 'and plays Hard');
    },
  },
  {
    name: 'S3-02 a Lucky game plays on through the worker',
    viewports: ['desktop'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 12, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky' }] });
      await t.waitIdle(5000);
      const before = (await t.state()).game.move;
      await t.game('act', 'pass');
      await t.page.waitForFunction((m) => window.__game.getState().game.move >= m + 2, before, { timeout: 20000 });
      const s = (await t.state()).game;
      t.equal(s.log[s.log.length - 1].p, 1, 'Lucky took his turn');
      t.equal((await t.state()).ai, 'worker', 'the worker answered');
    },
  },
  {
    name: 'P-N01 the computer opponents use the supplement',
    node: true,
    async run(t) {
      const c = await ctx();
      const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard', persona: 'julian' }, { kind: 'ai', level: 'hard', persona: 'julian' }], seed: 5 }, c.lex);
      s.players[0].rack = ['Q', 'I', 'J', 'J', 'V', 'V', 'W'];
      const { action } = chooseAction(c.dict, c.lex, s, { level: 'hard' });
      t.equal(action.type, 'play', 'with only QI to play, Hard plays');
      t.equal(action.tiles.map((x) => x.l).sort().join(''), 'IQ', 'and the word is QI');
      s.players[0].rack = ['E', 'M', 'A', 'I', 'L', 'L', 'T'];
      const e = chooseAction(c.dict, c.lex, s, { level: 'easy' });
      t.equal(e.action.type, 'play', 'Easy plays too');
    },
  },
  {
    name: 'P-N01 QI is accepted and scored in play, and a made-up word is still refused',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 21 });
      await t.waitIdle(5000);
      const g = (await t.state()).game;
      g.players[0].rack = ['Q', 'I', 'Z', 'A', 'O', 'K', 'E'];
      t.expect(await t.game('setState', { game: g }), 'a rack with Q and I is set up');
      for (const w of [['Q', 'I'], ['Z', 'A'], ['O', 'K']]) {
        const r = await t.game('act', 'eval', [{ i: 112, l: w[0] }, { i: 113, l: w[1] }]);
        t.expect(r.ok, `${w.join('')} is accepted (${r.error || r.score + ' points'})`);
      }
      const bad = await t.game('act', 'eval', [{ i: 112, l: 'Z' }, { i: 113, l: 'K' }]);
      t.expect(!bad.ok && /not in the dictionary/.test(bad.error), 'ZK is still refused');
      await t.game('act', 'stage', [{ i: 112, l: 'Q' }, { i: 113, l: 'I' }]);
      const p = await t.game('act', 'play');
      t.expect(p.ok, 'QI can be played');
      const s = (await t.state()).game;
      t.equal(s.log[0].words[0].w, 'QI', 'it is logged as QI');
      t.expect(s.players[0].score > 0, `and scores (${s.players[0].score})`);
    },
  },
  {
    name: 'P-N01 Help lists the two-letter words, and About names the additions',
    viewports: ['desktop', 'mobile'],
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="help"]');
      const text = await t.page.textContent('#screen .twos');
      const list = text.trim().split(/\s+/);
      t.equal(list.length, 104, 'the list holds 104 words');
      for (const w of ['QI', 'ZA', 'OK', 'EW', 'KI', 'FE', 'GI', 'OI', 'AA', 'XI']) t.expect(list.includes(w), `${w} is listed`);
      t.expect(!list.includes('QO') && !list.includes('ZZ'), 'and no made-up pair is');
      t.expect(/EMAIL, APP and BLOG/.test(await t.page.textContent('#screen .help-body')), 'the rules mention the everyday words');
      await t.page.locator('#screen .twos').scrollIntoViewIfNeeded();
      await t.checkLayout({ allowScrollY: true });
      await t.shot('P-N01-help');
      await t.page.click('#screen [data-back]');
      await t.page.click('#screen [data-go="about"]');
      const about = await t.page.textContent('#screen .about');
      t.expect(/168,271 words/.test(about) && /plus 28 added by the game/.test(about), 'About gives the packed count and the 28 additions');
      await t.shot('P-N01-about');
    },
  },
];
