// Wave 3, batch W3-B20 (WF-6 vision and cohesion): what the earlier waves left of W6-S1-01 to W6-S1-04.
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { findWords, explainWord } from '../src/js/score.js';
import { hintChoices, bestHint, isTeachableWord, chooseAction, premiumPoints, styleBonus, STYLES } from '../src/js/ai.js';
import { BARKS, SHORT, barkFor, greeting } from '../src/js/voices.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const OPAL = [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }];

export const tests = [
  {
    name: 'W6-S1-01 the Spring Guide opens every casual game with an everyday or Hot Springs word and keeps a far better rare one in its last choice',
    node: true,
    async run(t) {
      const c = await ctx();
      const teach = (m) => m.words.every((w) => isTeachableWord(c.dict, c.lex, w));
      let rareFirst = 0, rareLast = 0, n = 0;
      for (const seats of [OPAL, [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }]]) {
        for (let seed = 1; seed <= 200; seed++) {
          const s = createGame({ mode: 'play', seed, seats }, c.lex);
          const h = hintChoices(c.dict, c.lex, s, 3);
          if (!h.length) continue;
          n++;
          if (!teach(h[0])) rareFirst++;
          if (h.some((m, k) => k < 2 && !teach(m)) && h.filter(teach).length >= 2) t.fail(`seed ${seed}: a rare word came before a second everyday one`);
          if (h[2] && !teach(h[2])) rareLast++;
          t.equal(new Set(h.map((m) => m.words.join())).size, h.length, `seed ${seed}: three different plays`);
          t.equal(JSON.stringify(bestHint(c.dict, c.lex, s)), JSON.stringify(h[0]), `seed ${seed}: one hint is the first of three`);
        }
      }
      t.equal(rareFirst, 0, `no rare word is the first choice of an opening play (${n} openings)`);
      t.expect(rareLast >= 40, `and the far better rare ones are still offered, last (${rareLast})`);
      const hard = createGame({ mode: 'play', seed: 3, seats: [OPAL[0], { kind: 'ai', persona: 'julian', level: 'hard' }] }, c.lex);
      t.equal(hintChoices(c.dict, c.lex, hard, 3)[0].words[0], 'CONGEE', 'a game against Hard keeps the whole dictionary');
    },
  },
  {
    name: 'W6-S1-01 in the game: the first Hint of a casual match sets an everyday word and Other plays still reaches CONGEE',
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: OPAL });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      await t.page.waitForFunction(() => window.__game.getState().staged.length > 0 && !window.__G.hintBusy, null, { timeout: 10000 });
      const words = async () => (await t.page.textContent('#preview .words')).trim();
      const seen = [await words()];
      for (let k = 0; k < 2; k++) { await t.page.click('#preview [data-hintnext]'); seen.push(await words()); }
      t.equal(seen[0], 'GENE', 'the first play set on the board');
      t.equal(seen[2], 'CONGEE', 'the rare one is the third');
      t.equal((await t.state()).game.players[0].hints, 2, 'all three for one hint');
    },
  },
  {
    name: "W6-S1-02 a Hot Springs word of a plaque's own category says before and after the play that it clears a letter, for no extra points",
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const set = async (cat, word, id) => {
        await t.game('newGame', { seed: 6, seats: OPAL });
        await t.waitIdle(8000);
        const g = (await t.state()).game;
        g.players[0].rack = 'STEAMXX'.split('');
        g.featured = [{ id, word, cat, shown: [0], by: null, at: null }, { id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }, { id: 'horse', word: 'HORSES', cat: 'track', shown: [0], by: null, at: null }];
        await t.game('setState', { game: g });
        await t.waitIdle(5000);
        await t.game('act', 'stage', [...'STEAM'].map((l, k) => ({ i: 110 + k, l })));
        await t.page.waitForFunction(() => /STEAM/.test(document.querySelector('#preview .words')?.textContent || ''));
      };
      const note = () => t.page.evaluate(() => document.querySelector('#preview .row-reveal')?.textContent || '');

      await set('baths', 'TOWELS', 'towel');
      t.equal(await note(), '', "no note when no plaque is of the word's category");
      const plain = (await t.state()).preview.score;

      await set('springs', 'THERMAL', 'thermal');
      t.equal(await note(), 'Springs · clears 1 plaque letter', 'the strip says so before the play');
      t.equal((await t.state()).preview.score, plain, 'and it is worth no points');
      const fit = await t.page.evaluate(() => { const p = document.querySelector('#preview').getBoundingClientRect(); return [...document.querySelectorAll('#preview .extra, #preview .bdbtn, #preview .pts')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= p.left - 0.5 && r.right <= p.right + 0.5 && r.top >= p.top - 0.5 && r.bottom <= p.bottom + 0.5; }); });
      t.expect(fit, 'everything on the strip stays inside it');
      await t.shot('w3-b20-category-note');
      await t.page.evaluate(() => { window.__lines = []; let v = window.__G.lastLine; Object.defineProperty(window.__G, 'lastLine', { configurable: true, get: () => v, set: (x) => { v = x; if (x) window.__lines.push(x); } }); });
      const shown = await t.page.evaluate(async () => { await window.__game.act('play'); return window.__G.s.featured[0].shown.length; });
      t.equal(shown, 2, 'the plaque cleared one letter');
      await t.page.waitForFunction(() => window.__G.lastLine && window.__G.s.log.length >= 1);
      const said = await t.page.evaluate(() => window.__lines[0]);
      t.expect(/You played STEAM for .*clearing a Featured Spring letter/.test(said), `and the account read to a screen reader says it (${said})`);

      // the plaques carry their category in words, on a phone in the 44 px drawer too
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking; }, null, { timeout: 20000 });
      await t.waitIdle(8000);
      if (t.viewport === 'mobile') await t.page.click('[data-springs-toggle]');
      const tags = await t.page.evaluate(() => [...document.querySelectorAll('#springs .plaque, #springs .springs-bar')].map((p) => { const n = p.querySelector('.pcat-name'), r = p.getBoundingClientRect(), q = n.getBoundingClientRect(); return { tag: n.textContent, h: r.height, seen: q.width > 8 && q.left >= r.left && q.right <= r.right + 0.5, plaque: p.classList.contains('plaque') }; }));
      t.equal(tags.filter((x) => x.plaque).map((x) => x.tag).join(), 'Springs,Club,Track', 'Springs, Club and Track are written on the plaques');
      for (const x of tags) t.expect(x.seen && x.h >= 44, `${x.tag} shows on a ${x.h} px target`);
    },
  },
  {
    name: 'W6-S1-03 Lucky counts only what the multiplied letters and words earn: no flat bonus and no untouched cross-word',
    node: true,
    async run(t) {
      const c = await ctx();
      let n = 0, flat = 0, cross = 0;
      for (let seed = 51; seed <= 56; seed++) {
        const s = createGame({ mode: 'play', seed, seats: [{ kind: 'ai', level: 'medium', persona: 'lucky' }, { kind: 'ai', level: 'medium', persona: 'hollis' }] }, c.lex);
        for (let guard = 0; !s.over && guard < 60; guard++) {
          const p = s.players[s.cur];
          const { moves } = generateMoves(c.dict, s.board, p.rack, { lex: c.lex, featured: s.featured, budget: 900000 });
          for (const m of moves.slice(0, 60)) {
            const f = findWords(s.board, m.tiles);
            let want = m.score - m.bonus - m.full - m.featured;
            for (const w of f.words) want -= explainWord(s.board, f.add, w).parts.reduce((a, q) => a + q.v, 0);
            const got = premiumPoints(m, s.board);
            if (got !== want) { t.fail(`seed ${seed} ${m.words.join('+')}: ${got}, want ${want}`); return; }
            n++;
            if (m.bonus + m.full + m.featured > 0) flat++;
            if (f.words.length > 1) cross++;
            // the same tiles with 100 more flat points are worth the same to him
            if (styleBonus(STYLES.lucky, m, [], s, c.lex) !== styleBonus(STYLES.lucky, { ...m, score: m.score + 100 }, [], s, c.lex)) { t.fail('a flat bonus moves his style'); return; }
          }
          const r = apply(s, chooseAction(c.dict, c.lex, s, { level: 'medium' }).action, c);
          if (!r.ok) { t.fail(r.error); return; }
        }
      }
      t.expect(n > 2000 && flat > 100 && cross > 500, `${n} plays checked, ${flat} with a flat bonus, ${cross} with cross-words`);
    },
  },
  {
    name: 'W6-S1-03 the first character at the table greets the opening play, always the same for a game, and does not say it twice',
    node: true,
    async run(t) {
      const c = await ctx();
      const H = { kind: 'human', name: 'You' }, AI = (persona) => ({ kind: 'ai', persona, level: 'medium', name: persona });
      const game = (seats, seed) => createGame({ mode: 'play', seed, seats }, c.lex);
      for (const id of Object.keys(BARKS)) {
        const heard = new Set();
        for (let seed = 1; seed <= 60; seed++) {
          const s = game([H, AI(id)], seed), g = greeting(s);
          t.equal(g.persona, id, `${id} greets`);
          t.expect(BARKS[id].open.includes(g.text), `with an opening line (${g.text})`);
          t.equal(greeting(game([H, AI(id)], seed)).text, g.text, 'the same one for the same game');
          heard.add(g.text);
          const e = { p: 1, kind: 'play', n: 1, score: 12, full: 0, words: [], themed: 0, featured: null };
          s.log.push({ p: 0, kind: 'play', n: 0, score: 8, words: [] }, e); s.move = 2;
          t.equal(greeting(s), null, 'once the game is under way, no greeting');
          const b = barkFor(s, e);
          t.equal(b.event, 'open', 'a plain first play still has an opening line');
          t.expect(b.text !== g.text && BARKS[id].open.includes(b.text), `a different one (${b.text})`);
        }
        t.equal(heard.size, 6, `${id}: all six opening lines come up`);
      }
      t.equal(greeting(game([H, H, AI('lucky'), AI('opal')], 3)).persona, 'lucky', 'the first of several characters');
      t.equal(greeting(game([AI('opal'), H], 3)), null, 'a character who plays first does not');
      t.equal(greeting(game([H, H], 3)), null, 'nor does a table of people');
      t.equal(greeting(createGame({ mode: 'daily', date: '2026-11-25', seats: [H] }, c.lex)), null, 'nor the Daily Soak');
    },
  },
  {
    name: 'W6-S1-03 in the game the greeting waits in the strip with where to start, moves nothing, and steps aside for the play',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      const strip = () => t.page.evaluate(() => { const p = document.querySelector('#preview'), b = p.querySelector('.bark'), s = p.querySelector('.said'); return { bark: b && b.textContent, clip: b ? b.scrollHeight - b.clientHeight : 0, said: s && s.getBoundingClientRect().height > 0 ? s.textContent : '', rack: document.querySelector('#rack').getBoundingClientRect().top }; });
      const sizes = t.viewport === 'mobile' ? [[360, 740], [390, 844]] : [[1024, 600], [1280, 800]];
      for (const [width, height] of sizes) {
        await t.page.setViewportSize({ width, height });
        for (const id of Object.keys(BARKS)) for (let seed = 1; seed <= 8; seed++) {
          await t.game('newGame', { seed, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: id }] });
          await t.waitFrames(2);
          const g = await strip();
          t.equal(g.bark, `${SHORT[id]}: “${greeting((await t.state()).game).text}”`, `${width} px: ${SHORT[id]} greets`);
          t.expect(/^Start on the/.test(g.said), `${width} px: and where to start is still there (${g.said})`);
          t.expect(g.clip <= 1, `${width} px: the line is whole (${g.bark})`);
          const idle = await t.page.evaluate(() => { const p = document.querySelector('#preview'); p.className = 'idle'; p.textContent = 'Start'; return document.querySelector('#rack').getBoundingClientRect().top; });
          t.expect(Math.abs(idle - g.rack) <= 1, `${width} px: the rack does not move (${idle} and ${g.rack})`);
        }
      }
      await t.game('newGame', { seed: 2, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky' }] });
      await t.waitIdle(8000);
      const g = await strip();
      t.expect(!(await t.page.textContent('#live')).includes('“'), 'the live region stays plain');
      await t.shot('w3-b20-greeting');
      const cr = await t.contrastReport({ selector: '#preview', min: 4.5, largeMin: 3 });
      t.equal(cr.fails.length, 0, `readable (${JSON.stringify(cr.fails)})`);
      const mv = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv[0].tiles);
      t.equal((await strip()).bark, null, 'the score of a staged play takes its place');
      await t.game('act', 'recall');
      t.equal((await strip()).bark, g.bark, 'and it is back when the tiles are');
      await t.game('act', 'stage', mv[0].tiles);
      await t.game('act', 'play');
      await t.page.waitForFunction(() => { const s = window.__game.getState(); return s.game.log.length >= 2 && !s.aiThinking; }, null, { timeout: 20000 });
      t.expect((await strip()).bark !== g.bark, 'it is not said again');
      // a new game opens on its own line, not on the last game's account
      await t.game('newGame', { mode: 'daily', date: '2026-11-25' });
      await t.waitIdle(8000);
      const first = (await t.page.textContent('#preview')).trim();
      // a Daily's Turn 1 now opens on Today's Springs (W1-S4-10, wave4-b04); this test was written when it opened on 'Start on the'
      t.expect(/^Today's Springs/.test(first) && !first.includes('“'), `the next game does not open on the last one (${first})`);
    },
  },
];
