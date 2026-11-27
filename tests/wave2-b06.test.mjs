// Wave 2, batch W2-B06: W1-S3-06 (Spring Guide hints and post-game review coach Easy/Medium
// players with everyday SCOWL common words and Hot Springs bonus words instead of obscure ENABLE jargon).
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { hintChoices, bestHint, leaveValue, rackMinus, HINT_COMMON_GAP, isTeachableWord, casualAudience } from '../src/js/ai.js';
import { reviewSteps, summarize } from '../src/js/review.js';
import { RACK } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

export const tests = [
  {
    name: 'W1-S3-06 Spring Guide hints prefer common & Hot Springs words in Easy/Medium, fall back when >6 equity behind, and keep Hard full-dictionary',
    node: true,
    async run(t) {
      const c = await ctx();

      // 1. Seed 42 (rack YNMEBII): Easy, Medium, and Pass-and-Play avoid archaic MEINY and prefer everyday NIMBI.
      for (const [label, seats] of [
        ['Easy', [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }]],
        ['Medium', [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'hollis', level: 'medium' }]],
        ['Pass-and-Play', [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }]],
      ]) {
        const s = createGame({ mode: 'play', seed: 42, seats }, c.lex);
        t.equal(casualAudience(s), true, `${label} uses casual coaching vocabulary`);
        const list = hintChoices(c.dict, c.lex, s, 3);
        const best = bestHint(c.dict, c.lex, s);
        t.equal(list.length, 3, `${label} returns 3 hint choices`);
        t.equal(JSON.stringify(best.tiles), JSON.stringify(list[0].tiles), `${label} bestHint matches hintChoices[0]`);
        t.equal(list[0].words[0], 'NIMBI', `${label} seed 42 primary hint prefers NIMBI over MEINY (got ${list[0].words[0]})`);
        t.expect(!list.some((m) => m.words.includes('MEINY')), `${label} seed 42 avoids obscure MEINY when 3 common plays exist`);
        for (const m of list) {
          t.expect(m.words.every((w) => isTeachableWord(c.dict, c.lex, w)), `${label} hint ${m.words.join('+')} is teachable`);
        }
      }

      // 2. Hard opponent still receives full-dictionary coaching (MEINY on seed 42).
      const sHard = createGame({ mode: 'play', seed: 42, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] }, c.lex);
      t.equal(casualAudience(sHard), false, 'Hard opponent uses full-dictionary coaching');
      const hardList = hintChoices(c.dict, c.lex, sHard, 3);
      t.equal(hardList[0].words[0], 'MEINY', `Hard seed 42 keeps full-dictionary MEINY (got ${hardList[0].words[0]})`);

      // 3. Non-SCOWL Hot Springs bonus words (e.g., TUFA, DECO) count as teachable and win Slot 1 in Easy/Medium.
      const sTufa = createGame({ mode: 'play', seed: 99, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      sTufa.players[0].rack = ['T', 'U', 'F', 'A', 'X', 'Z', 'J'];
      t.expect(isTeachableWord(c.dict, c.lex, 'TUFA'), 'Hot Springs word TUFA is teachable even though not SCOWL common');
      const tufaHints = hintChoices(c.dict, c.lex, sTufa, 3);
      t.equal(tufaHints[0].words[0], 'TUFA', `Hot Springs bonus word TUFA is Slot 1 (got ${tufaHints[0].words[0]})`);

      // 4. Fallback when no teachable play sits within HINT_COMMON_GAP (6 equity points) of the raw best.
      const sGap = createGame({ mode: 'play', seed: 3, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      // Seed 3 rack NEOEGEC: CONGEE (14, rare) vs GENE (7, common) — verify gap > 6 triggers fallback while Slot 2 still offers a teachable play.
      const m3 = generateMoves(c.dict, sGap.board, sGap.players[0].rack, { lex: c.lex, featured: [] }).moves;
      const bagScale = 0.5 * Math.min(1, sGap.bag.length / RACK);
      const eq = (m) => m.score + leaveValue(rackMinus(sGap.players[0].rack, m.tiles)) * bagScale;
      const bestRaw3 = m3.map((m) => ({ m, e: eq(m) })).sort((a, b) => b.e - a.e)[0];
      const bestCom3 = m3.filter((m) => m.words.every((w) => isTeachableWord(c.dict, c.lex, w))).map((m) => ({ m, e: eq(m) })).sort((a, b) => b.e - a.e)[0];
      t.expect(bestRaw3.e - bestCom3.e > HINT_COMMON_GAP, `seed 3 equity gap ${(bestRaw3.e - bestCom3.e).toFixed(1)} exceeds ${HINT_COMMON_GAP}`);
      // W6-S1-01 (wave 3): on the opening play the first choice is always teachable and the far-ahead rare play waits in slot 3.
      const gapOpen = hintChoices(c.dict, c.lex, sGap, 3);
      t.expect(gapOpen[0].words.every((w) => isTeachableWord(c.dict, c.lex, w)), `opening Slot 1 is teachable (${gapOpen[0].words.join('+')})`);
      t.equal(gapOpen[2].words[0], bestRaw3.m.words[0], `opening Slot 3 keeps ${bestRaw3.m.words[0]}`);
      // Later in the game (AT on the board) the fallback is as it was.
      sGap.board[112] = { l: 'A', blank: false }; sGap.board[113] = { l: 'T', blank: false };
      const mLater = generateMoves(c.dict, sGap.board, sGap.players[0].rack, { lex: c.lex, featured: [] }).moves;
      const bestRawL = mLater.map((m) => ({ m, e: eq(m) })).sort((a, b) => b.e - a.e)[0];
      const bestComL = mLater.filter((m) => m.words.every((w) => isTeachableWord(c.dict, c.lex, w))).map((m) => ({ m, e: eq(m) })).sort((a, b) => b.e - a.e)[0];
      t.expect(bestRawL.e - bestComL.e > HINT_COMMON_GAP, `later equity gap ${(bestRawL.e - bestComL.e).toFixed(1)} exceeds ${HINT_COMMON_GAP}`);
      const gapHints = hintChoices(c.dict, c.lex, sGap, 3);
      t.equal(gapHints[0].words[0], bestRawL.m.words[0], `falls back to ${bestRawL.m.words[0]} when >${HINT_COMMON_GAP} eq ahead`);
      t.expect(gapHints[1].words.every((w) => isTeachableWord(c.dict, c.lex, w)), `Slot 2 still offers teachable play (${gapHints[1].words.join('+')})`);

      // 5. Invariant across 100 opening seeds (Easy): Slot 1 is NEVER obscure when a teachable move sits within HINT_COMMON_GAP.
      let violations = 0, commonFirst = 0, fallbacks = 0;
      for (let seed = 1; seed <= 100; seed++) {
        const s = createGame({ mode: 'play', seed, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
        const h = hintChoices(c.dict, c.lex, s, 1)[0];
        if (!h) continue;
        const ok = h.words.every((w) => isTeachableWord(c.dict, c.lex, w));
        if (ok) { commonFirst++; continue; }
        fallbacks++;
        const all = generateMoves(c.dict, s.board, s.players[0].rack, { lex: c.lex, featured: [] }).moves;
        const bs = 0.5 * Math.min(1, s.bag.length / RACK);
        const eOf = (m) => m.score + leaveValue(rackMinus(s.players[0].rack, m.tiles)) * bs;
        const topE = Math.max(...all.map(eOf));
        const com = all.filter((m) => m.words.every((w) => isTeachableWord(c.dict, c.lex, w)));
        const topComE = com.length ? Math.max(...com.map(eOf)) : -Infinity;
        if (topE - topComE <= HINT_COMMON_GAP) violations++;
      }
      t.equal(violations, 0, `0/100 opening seeds picked an obscure Slot 1 when a teachable word sat within ${HINT_COMMON_GAP} eq (common=${commonFirst}, fallbacks=${fallbacks})`);

      // 6. CD-WF1-06 zero-peeking preserved on Easy, Medium, and Hard hints.
      for (const level of ['easy', 'medium', 'hard']) {
        const a = createGame({ mode: 'play', seed: 778, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', level }] }, c.lex);
        a.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'Z'];
        a.featured = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
        const b = JSON.parse(JSON.stringify(a));
        b.featured = [];
        t.equal(JSON.stringify(hintChoices(c.dict, c.lex, a, 3)), JSON.stringify(hintChoices(c.dict, c.lex, b, 3)), `${level} hints ignore hidden Featured Spring`);
      }
      t.log(`100 Easy seeds: ${commonFirst} common/HS primary hints, ${fallbacks} >6 eq fallbacks, 0 violations`);
    },
  },
  {
    name: 'W1-S3-06 post-game review prefers teachable common/Hot Springs misses in Easy/Medium/Daily and keeps Hard full-dictionary',
    node: true,
    async run(t) {
      const c = await ctx();

      // Build seed 31 game where human plays weak moves on turns 1..6 against Easy Opal.
      const s = createGame({ mode: 'play', seed: 31, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      for (let turn = 0; !s.over && turn < 20; turn++) {
        const { moves } = generateMoves(c.dict, s.board, s.players[s.cur].rack, { lex: c.lex, featured: [] });
        const action = s.cur === 0
          ? (moves.length ? { type: 'play', tiles: moves[moves.length - 1].tiles } : { type: 'pass' })
          : (moves.length ? { type: 'play', tiles: moves[0].tiles } : { type: 'pass' });
        t.expect(apply(s, action, c).ok, 'setup move legal');
      }

      // Easy review: Turn 1 best is COMETS (15, common) rather than COZES (18, obscure), and all misses are teachable.
      const easySteps = [...reviewSteps(s, 0, c.dict, c.lex)];
      t.equal(easySteps[0].best.word, 'COMETS', `Easy review Turn 1 prefers COMETS over COZES (got ${easySteps[0].best.word})`);
      t.equal(easySteps[0].best.score, 15, 'Easy review Turn 1 COMETS scores 15');
      const easySum = summarize(easySteps);
      t.expect(easySum.misses.length >= 1, 'Easy review lists misses');
      for (const m of easySum.misses) {
        t.expect(isTeachableWord(c.dict, c.lex, m.best.word), `Easy review miss ${m.best.word} is teachable`);
      }

      // Medium review matches Easy teachable preference.
      const sMed = JSON.parse(JSON.stringify(s));
      sMed.players[1].level = 'medium';
      const medSteps = [...reviewSteps(sMed, 0, c.dict, c.lex)];
      t.equal(medSteps[0].best.word, 'COMETS', 'Medium review Turn 1 prefers COMETS');

      // Hard review retains full-dictionary COZES (18).
      const sHard = JSON.parse(JSON.stringify(s));
      sHard.players[1].level = 'hard';
      const hardSteps = [...reviewSteps(sHard, 0, c.dict, c.lex)];
      t.equal(hardSteps[0].best.word, 'COZES', `Hard review Turn 1 keeps full-dictionary COZES (got ${hardSteps[0].best.word})`);
      t.equal(hardSteps[0].best.score, 18, 'Hard review Turn 1 COZES scores 18');

      // Player beating the teachable target with a rare word (COZES 18 vs COMETS 15) counts as found, never a miss.
      const sRarePlay = createGame({ mode: 'play', seed: 31, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      const cozes = generateMoves(c.dict, sRarePlay.board, sRarePlay.players[0].rack, { lex: c.lex, featured: [] }).moves[0];
      t.equal(cozes.words[0], 'COZES', 'sanity: raw best on seed 31 is COZES');
      t.expect(apply(sRarePlay, { type: 'play', tiles: cozes.tiles }, c).ok, 'COZES applied');
      const rareSum = summarize([...reviewSteps(sRarePlay, 0, c.dict, c.lex)]);
      t.equal(rareSum.found, 1, 'beating the teachable target with a rare word counts as found');
      t.equal(rareSum.misses.length, 0, 'and is not listed as a miss');

      // Fallback when NO teachable play exists on a turn (rack QIJJVVW): review still names QI instead of null.
      const sOnlyRare = createGame({ mode: 'play', seed: 5, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      sOnlyRare.players[0].rack = ['Q', 'I', 'J', 'J', 'V', 'V', 'W'];
      t.expect(apply(sOnlyRare, { type: 'pass' }, c).ok, 'pass applied');
      const onlyRareSteps = [...reviewSteps(sOnlyRare, 0, c.dict, c.lex)];
      t.equal(onlyRareSteps[0].best.word, 'QI', 'falls back to QI when no teachable word fits');

      // Daily Soak review uses casual teachable coaching.
      const sDaily = createGame({ mode: 'daily', date: '2026-11-16' }, c.lex);
      sDaily.players[0].rack = ['Y', 'N', 'M', 'E', 'B', 'I', 'I'];
      t.expect(apply(sDaily, { type: 'pass' }, c).ok, 'daily pass applied');
      const dailySteps = [...reviewSteps(sDaily, 0, c.dict, c.lex)];
      t.equal(dailySteps[0].best.word, 'NIMBI', `Daily review prefers NIMBI over MEINY (got ${dailySteps[0].best.word})`);
    },
  },
  {
    name: 'W1-S3-06 live Spring Guide (Worker) stages NIMBI on Easy seed 42, MEINY on Hard seed 42, and What you missed coaches COMETS on Easy seed 31',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      await ready(t);

      // 1. Seed 42 Easy Opal: Spring Guide stages NIMBI (not archaic MEINY) through the AI worker.
      await t.game('newGame', { seed: 42, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      await t.page.waitForFunction(() => window.__game.getState().staged.length > 0 && !window.__G.hintBusy, null, { timeout: 10000 });
      const easyWords = (await t.page.textContent('#preview .words')).trim();
      t.equal(easyWords, 'NIMBI', `Easy seed 42 Spring Guide stages NIMBI (got ${easyWords})`);
      t.expect(!/MEINY/.test(easyWords), 'Easy seed 42 does not stage archaic MEINY');
      t.equal((await t.state()).ai, 'worker', 'hint ran through the AI worker');
      await t.shot('W1-S3-06-hint-easy');
      await t.checkLayout({ allowScrollY: true });

      // 2. Seed 42 Hard Julian: Spring Guide stages full-dictionary MEINY through the AI worker.
      await t.game('newGame', { seed: 42, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      await t.waitIdle(8000);
      await t.game('act', 'hint');
      await t.page.waitForFunction(() => window.__game.getState().staged.length > 0 && !window.__G.hintBusy, null, { timeout: 10000 });
      const hardWords = (await t.page.textContent('#preview .words')).trim();
      t.equal(hardWords, 'MEINY', `Hard seed 42 Spring Guide keeps MEINY (got ${hardWords})`);

      // 3. Seed 31 Easy Opal: play weakest move on Turn 1 then finish via passes/short game and open What you missed.
      await t.game('newGame', { seed: 31, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(8000);
      const mv = await t.game('act', 'moves', 300);
      const weak = mv[mv.length - 1];
      await t.game('act', 'stage', weak.tiles);
      t.expect((await t.game('act', 'play')).ok, 'weak Turn 1 move played');
      await t.page.waitForFunction(() => { const x = window.__game.getState(); return x.game.over || x.game.players[x.game.cur].kind === 'human'; }, null, { timeout: 15000 });
      // Complete game cleanly via human/AI turns to reach the real results screen and What you missed.
      for (let n = 0; n < 150; n++) {
        const g = (await t.state()).game;
        if (g.over) break;
        if (g.players[g.cur].kind !== 'human') {
          await t.page.waitForFunction(() => { const x = window.__game.getState(); return x.game.over || x.game.players[x.game.cur].kind === 'human'; }, null, { timeout: 20000 });
          continue;
        }
        const best = await t.game('act', 'moves', 1);
        if (best && best[0]) {
          const st = await t.game('act', 'stage', best[0].tiles);
          const r = st.ok ? await t.game('act', 'play') : { ok: false };
          if (!r.ok) { await t.game('act', 'recall'); await t.game('act', 'pass'); }
        } else {
          await t.game('act', 'pass');
        }
        await t.page.waitForFunction((m) => window.__game.getState().game.move > m, g.move, { timeout: 10000 });
      }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 15000 });
      await t.page.click('[data-review]');
      await t.page.waitForSelector('.review .rv-rate', { timeout: 15000 });
      const rvText = (await t.page.textContent('.review')).trim();
      t.expect(/Turn 1 .*COMETS would have scored 15/.test(rvText), `What you missed coaches teachable COMETS (15) on Turn 1 (${rvText})`);
      t.expect(!/\bCOZES\b/.test(rvText), 'What you missed does not scold Easy player for obscure COZES');
      await t.shot('W1-S3-06-review-easy');
      await t.checkLayout();
      await t.page.click('.review [data-close]');
    },
  },
];
