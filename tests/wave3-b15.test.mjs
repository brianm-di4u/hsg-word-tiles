// Wave 3, batch W3-B15: W6-S3-02 (Featured Springs count only when the plaque gives them away: computers, hint, review, look-ahead) and
// W6-S3-04 (a better later try of an older Daily record is kept as practice; the rest was built by 810a42a, 5d83edc and a4969fc, tests: wave2-b01,
// wave2-b02, wave3-b11).
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
      for (const level of ['beginner', 'easy', 'medium', 'hard', 'expert']) {
        const none = json(pick(level, [0], null, []).action);
        for (const n of [1, 2, 3]) t.equal(json(pick(level, first('CASINO', n)).action), none, `${level}: ${n} letters of CASINO change nothing`);
        t.equal(json(pick(level, first('CASINO', 5), 1).action), none, `${level}: nor does a claimed plaque`);
        const read = pick(level, first('CASINO', 4));
        if (level === 'easy' || level === 'beginner') { t.equal(json(read.action), none, `${level} does not chase a readable one either`); continue; }
        // OQ-POST-REL-01: CASINO is over Medium's four letters, so the plaque can only matter when its long-word rule lets the play through
        if (level === 'medium' && read.move.featured !== FEATURED_BONUS) { t.equal(json(read.action), none, 'medium: the six-letter CASINO stays out of reach here, so the plaque changes nothing'); continue; }
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
  // ---------- W6-S3-04 ----------
  {
    name: 'W6-S3-04 a record from before the first-run lock keeps its better later try as practice when the Daily is replayed, and the official score stays the first run',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);
      const DAILY = 'hs-letters-daily-v1', STATS = 'hs-letters-stats-v1';
      const read = (k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key)), k);
      const passDaily = async () => {
        await t.game('newGame', { mode: 'daily' });
        await t.waitIdle(5000);
        for (let k = 0; k < 10; k++) { await t.game('act', 'pass'); await t.waitIdle(5000); }
        await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 10000 });
      };
      // three tries in the live game: the first 300, the best 420, kept as the day's score
      const date = await t.page.evaluate(({ DAILY, STATS }) => {
        const d = new Date(), date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        localStorage.setItem(DAILY, JSON.stringify({ days: { [date]: { score: 420, first: 300, plays: 3, par: { m: 250, h: 350 } } }, streak: 4, last: date }));
        localStorage.setItem(STATS, JSON.stringify({ v: 1, daily: { games: 9, best: 420, bestStreak: 6 } }));
        return date;
      }, { DAILY, STATS });
      await t.reload(); await ready(t);
      t.expect(/Today: 300 pts/.test(await t.page.textContent('[data-go="daily"] small')), 'the title shows the first run');
      await passDaily();
      const day = (await read(DAILY)).days[date];
      t.equal(day.first, 300, 'the first run stands'); t.equal(day.score, 300, 'as the official score');
      t.equal(day.replayBest, 420, 'and the 420 is kept, as the best practice replay');
      t.equal(day.plays, 4, 'the replay is counted'); t.equal(JSON.stringify(day.par), '{"m":250,"h":350}', 'a saved par is untouched');
      const box = await t.page.textContent('.daily-box');
      t.expect(/Practice replay/.test(box) && /Best practice replay today: 420\./.test(box) && /Your first try today: 300\./.test(box), 'the results say so (' + box.slice(0, 160) + ')');
      t.equal(JSON.stringify((await read(STATS)).daily), '{"games":9,"best":420,"bestStreak":6}', "the record's Daily line is neither raised nor lowered");
      await t.page.waitForFunction(() => !document.querySelector('.sheet.over').getAnimations({ subtree: true }).some((x) => x.playState === 'running' && x.effect.getTiming().iterations !== Infinity), null, { timeout: 5000 });
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W6-S3-04-old-record-replay');
      await passDaily();
      t.equal((await read(DAILY)).days[date].replayBest, 420, 'a second replay keeps it');
      // a day from before first tries were kept: its one score is the official one, and nothing is made up
      await t.page.evaluate(({ DAILY, date }) => localStorage.setItem(DAILY, JSON.stringify({ days: { [date]: { score: 250, plays: 1 } }, streak: 1, last: date })), { DAILY, date });
      await t.reload(); await ready(t);
      await passDaily();
      const old = (await read(DAILY)).days[date];
      t.equal(`${old.first}/${old.score}/${old.replayBest}`, '250/250/0', 'official 250, practice 0');
    },
  },
];
