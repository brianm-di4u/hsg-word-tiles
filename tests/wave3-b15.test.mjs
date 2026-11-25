// Wave 3, batch W3-B15: W6-S3-02 (Featured Springs count only when the plaque gives them away: computers, hint, review, look-ahead).
// W6-S3-01 was built by 31b7f5a, fda7f2b and 9d2314a (tests: wave2-b01, wave2-b02) and W6-S3-05 by 6e9920d, 355be8e and a4969fc
// (tests: wave2-b05, wave3-b11).
import { ctx } from './lib.mjs';
import { createGame, apply, evaluate } from '../src/js/engine.js';
import { chooseAction, hintChoices } from '../src/js/ai.js';
import { generateMoves } from '../src/js/movegen.js';
import { reviewSteps } from '../src/js/review.js';
import { deducibleFeatured, READABLE_FOG } from '../src/js/lexicon.js';
import { validSavedGame } from '../src/js/storage.js';
import { FEATURED_BONUS } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const plaque = (c, word, shown, by = null) => { const e = c.lex.entry(word); return { id: e.id, word, cat: e.cat, shown, by, at: null }; };
const first = (word, n) => [...word].map((_, k) => k).slice(0, n);
const json = JSON.stringify;

// an opening rack of CASINO and a Z: with the plaque worth nothing another word may win, with it CASINO does
const casino = (c, seats, shown, by = null) => {
  const s = createGame({ mode: 'play', seats, seed: 777 }, c.lex);
  s.players[0].rack = 'CASINOZ'.split('');
  s.featured = [plaque(c, 'CASINO', shown, by)];
  return s;
};

export const tests = [
  {
    name: 'W6-S3-02 a Featured Spring counts as readable only when its plaque leaves one entry of the lexicon and two letters or fewer in the fog',
    node: true,
    async run(t) {
      const c = await ctx();
      const known = (word, shown, by) => deducibleFeatured([plaque(c, word, shown, by)], c.lex).length;
      t.equal(READABLE_FOG, 2, 'two letters of fog');
      t.equal(known('CASINO', first('CASINO', 4)), 1, 'CASI.. in the Club is readable');
      t.equal(known('CASINO', first('CASINO', 3)), 0, 'CAS... is not, whatever the lexicon holds');
      t.equal(known('CASINO', [0]), 0, 'one letter in six is not');
      t.equal(known('CASINO', [0, 0, 0, 0]), 0, 'a letter counted four times is still one letter');
      t.equal(known('CASINO', first('CASINO', 4), 1), 0, 'a claimed one is out of it');
      // two entries fit: not readable. Two forms of one entry fit: readable, since any form claims it.
      const all = [...c.lex.byForm];
      let twins = 0, forms = 0, checked = 0, wrong = 0;
      for (const f of c.lex.featurable) for (let a = 0; a < f.word.length; a++) for (let b = a; b < f.word.length; b++) {
        const shown = [...f.word].map((_, k) => k).filter((k) => k !== a && k !== b);
        const fits = all.filter(([w, e]) => e.cat === f.cat && w.length === f.word.length && shown.every((k) => w[k] === f.word[k]));
        const ids = new Set(fits.map(([, e]) => e.id));
        if ((known(f.word, shown) === 1) !== (ids.size === 1)) wrong++;
        if (ids.size > 1) twins++;
        if (ids.size === 1 && fits.length > 1) forms++;
        checked++;
      }
      t.equal(wrong, 0, `the rule holds for every plaque with one or two letters hidden (${checked})`);
      t.log(`${checked} plaques: ${twins} with two entries left, ${forms} with two forms of one entry`);
      t.expect(twins > 0 && forms > 0, 'both kinds occur, so both rules are used');
      t.equal(deducibleFeatured(null, c.lex).length + deducibleFeatured([plaque(c, 'CASINO', first('CASINO', 5))], null).length, 0, 'no list or no lexicon: none');
      t.equal(deducibleFeatured([{ id: 'x', word: 'ZZZZZZ', cat: 'club', shown: [0, 1, 2, 3, 4], by: null }], c.lex).length, 0, 'a word the lexicon does not hold is never readable');
    },
  },
  {
    name: 'W6-S3-02 the computers chase a readable Featured Spring (Medium and Hard, never Easy) and ignore a hidden one at every level',
    node: true,
    async run(t) {
      const c = await ctx();
      const seats = (level) => [{ kind: 'ai', level }, { kind: 'ai', level }];
      const pick = (level, shown, by, feat) => { const s = casino(c, seats(level), shown, by); if (feat) s.featured = feat; return chooseAction(c.dict, c.lex, s, { level, exact: true }); };
      for (const level of ['easy', 'medium', 'hard']) {
        const none = json(pick(level, [0], null, []).action);
        for (const n of [1, 2, 3]) t.equal(json(pick(level, first('CASINO', n)).action), none, `${level}: ${n} letters of CASINO change nothing`);
        t.equal(json(pick(level, first('CASINO', 5), 1).action), none, `${level}: nor does a claimed plaque`);
        const read = pick(level, first('CASINO', 4));
        if (level === 'easy') { t.equal(json(read.action), none, 'Easy does not chase a readable one either'); continue; }
        t.equal(read.move.featured, FEATURED_BONUS, `${level}: the readable plaque is worth +30 in the search`);
        const s = casino(c, seats(level), first('CASINO', 4));
        const r = apply(s, read.action, c);
        t.expect(r.ok && r.entry.score === read.move.score && s.featured[0].by === 0, `${level}: the engine pays what the search counted (${r.entry && r.entry.score})`);
      }
      // real positions: what is in the fog never moves a computer. Each hidden word is swapped for another that shows the same face.
      let turns = 0, hidden = 0, differ = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'medium' }], seed }, c.lex);
        for (let n = 0; !s.over && n < 60; n++) {
          const blind = JSON.parse(json(s));
          blind.featured = s.featured.map((f) => {
            const other = f.by == null && [...c.lex.byForm].find(([w, e]) => e.id !== f.id && e.cat === f.cat && w.length === f.word.length && f.shown.every((k) => w[k] === f.word[k]));
            if (!other) return f;
            hidden++;
            return { ...f, id: other[1].id, word: other[0] };
          });
          const a = chooseAction(c.dict, c.lex, JSON.parse(json(s)), {}), b = chooseAction(c.dict, c.lex, blind, {});
          if (json(a.action) !== json(b.action)) differ++;
          apply(s, a.action, c); turns++;
        }
      }
      t.equal(differ, 0, 'the same answer whatever word the fog hides, turn by turn');
      t.expect(hidden >= 20, `${hidden} plaques with another word behind the same face over ${turns} turns`);
    },
  },
  {
    name: 'W6-S3-02 the Spring Guide and the review follow the same rule, turn by turn, and a save keeps what could be read',
    node: true,
    async run(t) {
      const c = await ctx();
      const seats = [{ kind: 'human', name: 'You' }, { kind: 'ai', level: 'hard' }];
      const hints = (shown, none) => { const s = casino(c, seats, shown); if (none) s.featured = []; return hintChoices(c.dict, c.lex, s, 3); };
      t.equal(json(hints([0, 1, 2])), json(hints([], true)), 'a hidden plaque changes no hint');
      const read = hints(first('CASINO', 4)), table = casino(c, seats, first('CASINO', 4));
      t.equal(evaluate(table, read[0].tiles, c).featured, 'CASINO', `the readable one leads the hints (${read[0].words})`);
      t.equal(evaluate(table, read[0].tiles, c).score, read[0].score, 'and is listed at the score the board will show');
      // the review: turn 1 with the plaque hidden, turn 2 with the same plaque readable, turn 3 after the other side claimed it
      const s = casino(c, seats, [0]);
      const turn = (shown) => { s.featured[0].shown = shown; s.players[0].rack = 'CASINOZ'.split(''); s.cur = 0; s.scoreless = 0; return apply(s, { type: 'pass' }, c).entry; };
      t.equal(turn([0]).known, undefined, 'nothing is written on a turn with nothing to read');
      t.equal(json(turn(first('CASINO', 4)).known), '["CASINO"]', 'the readable plaque is written into the turn');
      s.cur = 1; s.scoreless = 0;
      t.equal(apply(s, { type: 'pass' }, c).entry.known, undefined, "never into a computer's turn");
      s.featured[0].by = 1;
      t.equal(turn(first('CASINO', 5)).known, undefined, 'nor once it is claimed');
      const best = (featured) => generateMoves(c.dict, s.board, 'CASINOZ'.split(''), { lex: c.lex, featured }).moves[0].score;
      const plain = best([]), paid = best([plaque(c, 'CASINO', [])]);
      t.expect(paid > plain, `CASINO with its plaque beats the best without (${paid} against ${plain})`);
      t.equal([...reviewSteps(s, 0, c.dict, c.lex)].map((x) => x.best.score).join(), [plain, paid, plain].join(), 'the review counts the +30 on the one turn it could be read');
      // saves: the new field passes the check, and a game saved without it is reviewed as before
      t.expect(validSavedGame(JSON.parse(json(s))), 'a save with the field is valid');
      const old = JSON.parse(json(s)); for (const e of old.log) delete e.known;
      t.expect(validSavedGame(old), 'and one without it');
      t.equal([...reviewSteps(old, 0, c.dict, c.lex)].map((x) => x.best.score).join(), [plain, plain, plain].join(), 'an older save counts no plaque');
      for (const bad of ['CASINO', 7, null, [1], {}]) { const odd = JSON.parse(json(s)); odd.log.forEach((e) => { e.known = bad; }); t.equal([...reviewSteps(odd, 0, c.dict, c.lex)].map((x) => x.best.score).join(), [plain, plain, plain].join(), 'a damaged field is read without an error: ' + json(bad)); }
    },
  },
  {
    name: "W6-S3-02 Hard's look at the reply leaves out a Featured Spring its own play has just claimed",
    node: true,
    async run(t) {
      const c = await ctx();
      const rows = ['...........R...', '...........O...', '...PIKE....W..M', '.....ARSONIST.E', '..GIVE......R.R', 'EGER........I.M', 'DOMED.......APE',
        '...DEEJAyS..GUN', '....I.......EN.', '.OXALATE...B.T.', 'CHUB...LIQuORS.', '.........U.N...', '.........E.N...', '...TUFA..R.Y...', '......ALLYL....'];
      // the bag is empty and both sides can make CHAPEL, whose plaque is readable
      const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }], seed: 168 }, c.lex);
      s.bag = [];
      s.board = [...rows.join('')].map((l) => (l === '.' ? null : { l: l.toUpperCase(), blank: l !== l.toUpperCase(), p: 0, t: 0 }));
      s.players[0].rack = 'HTCNIOP'.split(''); s.players[1].rack = 'CTZSAD'.split('');
      s.featured = [plaque(c, 'CHAPEL', first('CHAPEL', 5))];
      t.equal(deducibleFeatured(s.featured, c.lex).length, 1, 'the plaque is readable');
      // counting the claimed plaque again for the reply made Hard leave it (it played HERN); its claim is the better play
      const got = chooseAction(c.dict, c.lex, s, { level: 'hard', exact: true });
      t.equal(got.move.words[0], 'CHAPEL', 'Hard claims it'); t.equal(got.move.featured, FEATURED_BONUS, 'for the +30');
      // the same plaque with two more letters in the fog is worth nothing to either side
      s.featured = [plaque(c, 'CHAPEL', [0, 1, 2])];
      const blind = chooseAction(c.dict, c.lex, s, { level: 'hard', exact: true });
      s.featured = [];
      t.equal(json(blind.action), json(chooseAction(c.dict, c.lex, s, { level: 'hard', exact: true }).action), 'a hidden one changes nothing in the look-ahead');
    },
  },
  {
    name: 'W6-S3-02 in the page, the worker gets no hidden Featured Spring, and the Spring Guide stages a readable one at its full score',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(777);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      await t.waitIdle(8000);
      // what is sent to the worker, as it is sent
      await t.page.evaluate(() => { window.__posted = []; const post = Worker.prototype.postMessage; Worker.prototype.postMessage = function (m, ...r) { if (m && m.state) window.__posted.push(JSON.parse(JSON.stringify({ type: m.type, featured: m.state.featured }))); return post.call(this, m, ...r); }; });
      const posted = () => t.page.evaluate(() => window.__posted.splice(0));
      const set = async (shown) => {
        const g = (await t.state()).game;
        g.players[0].rack = 'CASINOZ'.split(''); g.players[0].hints = 3;
        g.featured = [{ id: 'casino', word: 'CASINO', cat: 'club', shown, by: null, at: null }];
        await t.game('setState', { game: g });
      };
      const hint = async () => {
        await t.game('act', 'hint');
        await t.page.waitForFunction(() => window.__G.staged.length > 0, null, { timeout: 15000 });
      };
      await set([0, 1, 2]);
      await hint();
      t.equal(JSON.stringify(await posted()), '[{"type":"hint","featured":[]}]', 'the hint is asked for without the hidden word');
      await t.game('act', 'recall');
      await set([0, 1, 2, 3]);
      await hint();
      const asked = await posted();
      t.equal(asked.map((p) => p.featured.map((f) => f.word).join()).join(), 'CASINO', 'and with the readable one');
      const v = await t.page.evaluate(() => ({ listed: window.__G.hintAlts[0].score, shown: window.__G.preview.score, feat: window.__G.preview.featured }));
      t.equal(v.feat, 'CASINO', 'the Spring Guide stages it'); t.equal(v.listed, v.shown, 'at the score the board shows');
      await t.shot('W6-S3-02-readable-hint');
      await t.checkLayout();
      // the turn is kept with the plaque that could be read, and the computer hears nothing more of it
      await t.game('act', 'play');
      await t.page.waitForFunction(() => window.__game.getState().game.move >= 2, null, { timeout: 15000 });
      const log = (await t.state()).game.log;
      t.equal(JSON.stringify(log[0].known), '["CASINO"]', 'the log keeps what could be read'); t.equal(log[0].featured, 'CASINO', 'and the claim');
      const after = (await posted()).filter((p) => p.type === 'move');
      t.expect(after.length >= 1 && after.every((p) => p.featured.length === 0), 'the computer is told of no plaque after the claim');
    },
  },
];
