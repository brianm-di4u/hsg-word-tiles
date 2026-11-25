// Wave 2, batch W2-B17: W1-S5-02 (orthogonal trade-grounded styles & bios for all 4 town personas)
// and W1-S5-03 (mood-sync onboarding + competitive Hot Springs bonus word surfaced in Spring Guide hints).
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, hintChoices, bestHint, HINT_THEMED_GAP, isTeachableWord, STYLES, styleBonus, premiumPoints, leaveValue, rackMinus, openedPremium, EASY_TWO } from '../src/js/ai.js';
import { PERSONAS, LEVEL_BLURB } from '../src/js/personas.js';
import { isCommon } from '../src/js/dict.js';
import { SQUARE, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};

export const tests = [
  {
    name: 'W1-S5-02 all four town personas have orthogonal trade-grounded STYLES, distinct multi-game profiles at the same difficulty, and non-contradictory bios',
    node: true,
    async run(t) {
      const c = await ctx();

      // 1) All 4 personas defined in STYLES and PERSONAS[].line is strictly orthogonal to difficulty copy (LEVEL_BLURB)
      for (const per of PERSONAS) {
        t.expect(!!STYLES[per.id], `${per.id} has a style in STYLES`);
        t.expect(!/plain, everyday|common words and every short|Knows every word/i.test(per.line), `${per.id} bio avoids difficulty/vocabulary claims ("${per.line}")`);
        for (const blurb of Object.values(LEVEL_BLURB)) {
          t.expect(per.line !== blurb, `${per.id} bio does not repeat LEVEL_BLURB`);
        }
      }

      // 2) Unit guards on styleBonus for every character's signature trade habit
      const s2p = createGame({ mode: 'play', seed: 101, seats: [{ kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'medium' }] }, c.lex);
      const bathSq = SQUARE.indexOf('B');
      const boilSq = SQUARE.indexOf('b');
      const br = Math.floor(boilSq / N), bc = boilSq % N;
      const nearBoil = br * N + (bc < 7 ? bc + 2 : bc - 2);

      // Opal: rewards baths/springs words and Bathhouse Row squares
      const opalBathMove = { tiles: [{ i: bathSq, l: 'S' }, { i: bathSq + 1, l: 'P' }, { i: bathSq + 2, l: 'A' }], words: ['SPA'], score: 15, full: 0 };
      const plainMove = { tiles: [{ i: 112, l: 'C' }, { i: 113, l: 'A' }, { i: 114, l: 'T' }], words: ['CAT'], score: 15, full: 0 };
      t.expect(styleBonus(STYLES.opal, opalBathMove, [], s2p, c.lex) > styleBonus(STYLES.opal, plainMove, [], s2p, c.lex) + 5, 'Opal favours baths/springs words and Bathhouse Row squares');

      // Hollis: rewards park words + cross-plays + penalizes opening Boiling Springs in 2P (but NOT in 1P Daily)
      const hollisCross = { tiles: [{ i: 112, l: 'T' }, { i: 113, l: 'R' }, { i: 114, l: 'A' }, { i: 115, l: 'I' }, { i: 116, l: 'L' }], words: ['TRAIL', 'AT'], score: 20, full: 0 };
      t.expect(styleBonus(STYLES.hollis, hollisCross, [], s2p, c.lex) > styleBonus(STYLES.hollis, plainMove, [], s2p, c.lex) + 5, 'Hollis favours park words and connected cross-plays');
      const openMove = { tiles: [{ i: nearBoil, l: 'A' }, { i: nearBoil + 1, l: 'T' }], words: ['AT'], score: 6, full: 0 };
      t.expect(styleBonus(STYLES.hollis, openMove, [], s2p, c.lex) < 0, 'Hollis penalizes opening Boiling/Steam springs in 2P');
      const sDaily = createGame({ mode: 'daily', date: '2026-11-16', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      t.equal(styleBonus(STYLES.hollis, openMove, [], sDaily, c.lex), 0, 'Hollis has zero phantom opponent defense in 1P Daily Soak');

      // Julian: rewards 5+ letter crescendo plays, Full Soak, elevated leaveScale, AND tidyLeave even on Easy
      const longMove = { tiles: [{ i: 110, l: 'S' }, { i: 111, l: 'T' }, { i: 112, l: 'O' }, { i: 113, l: 'N' }, { i: 114, l: 'E' }], words: ['STONE'], score: 15, full: 0 };
      t.expect(styleBonus(STYLES.julian, longMove, ['E', 'R', 'S'], s2p, c.lex, { easy: true }) > styleBonus(STYLES.julian, plainMove, ['Q', 'V', 'U'], s2p, c.lex, { easy: true }) + 4, 'Julian favours 5+ letter crescendo plays and tidy rack leaves even on Easy');
      t.expect(STYLES.julian.leaveScale > 1 && STYLES.lucky.leaveScale < 0.5, 'Julian elevates rack-leave care while Lucky lowers it');

      // 3) All 4 personas play legal moves at Easy, Medium, and Hard, and Easy stays strictly within everyday vocabulary
      for (const per of PERSONAS) {
        for (const level of ['easy', 'medium', 'hard']) {
          const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level, persona: per.id }, { kind: 'ai', level: 'medium', persona: 'hollis' }], seed: 91 }, c.lex);
          let guard = 0;
          while (!s.over && guard++ < 400) {
            const seatIdx = s.cur, seat = s.players[seatIdx];
            const { action } = chooseAction(c.dict, c.lex, s, { level: seat.level, persona: seat.persona });
            const r = apply(s, action, c);
            t.expect(r.ok, `${per.id}@${level} legal ${action.type}: ${r.error || 'ok'}`);
            if (seatIdx === 0 && level === 'easy' && r.entry.kind === 'play') {
              for (const w of r.entry.words) {
                t.expect(w.w.length === 2 ? EASY_TWO.has(w.w) : isCommon(c.dict, w.w), `${per.id}@easy keeps everyday vocabulary (${w.w})`);
              }
            }
          }
          t.expect(s.over, `${per.id}@${level} finishes cleanly`);
        }
      }

      // 4) Multi-game behavioral divergence at the same difficulty (Medium, 24 games each): each persona leads on its signature habit
      const personas = ['opal', 'hollis', 'lucky', 'julian'];
      const metrics = {};
      for (const per of personas) {
        const st = { pts: 0, plays: 0, prem: 0, bathSprings: 0, rowSq: 0, cross: 0, long: 0, leave: 0, leaveN: 0, opened: 0 };
        for (let g = 0; g < 24; g++) {
          const flip = g % 2 === 1;
          const opp = personas[(personas.indexOf(per) + 1 + (g % 3)) % 4];
          const seats = flip
            ? [{ kind: 'ai', level: 'medium', persona: opp }, { kind: 'ai', level: 'medium', persona: per }]
            : [{ kind: 'ai', level: 'medium', persona: per }, { kind: 'ai', level: 'medium', persona: opp }];
          const s = createGame({ mode: 'play', seats, seed: 5100 + g }, c.lex);
          let guard = 0;
          while (!s.over && guard++ < 400) {
            const cur = s.players[s.cur];
            const mine = s.cur === (flip ? 1 : 0);
            const bag0 = s.bag.length, b0 = mine ? s.board.slice() : null, r0 = mine ? cur.rack.slice() : null;
            const { action } = chooseAction(c.dict, c.lex, s, { level: cur.level, persona: cur.persona });
            const res = apply(s, action, c);
            if (!res.ok) throw new Error(res.error);
            if (mine && res.entry.kind === 'play') {
              const e = res.entry;
              st.plays++; st.pts += e.score;
              st.prem += premiumPoints(e, b0);
              for (const w of e.words) { const en = c.lex.entry(w.w); if (en && (en.cat === 'baths' || en.cat === 'springs')) st.bathSprings++; }
              st.rowSq += e.tiles.filter((x) => SQUARE[x.i] === 'B').length;
              if (e.words.length > 1) st.cross++;
              if (e.words[0].w.length >= 5) st.long++;
              if (bag0 > 0) { st.leave += leaveValue(rackMinus(r0, e.tiles)); st.leaveN++; st.opened += openedPremium(b0, e.tiles); }
            }
          }
        }
        metrics[per] = {
          premShare: st.prem / st.pts,
          opalAffinity: (st.bathSprings + st.rowSq) / 24,
          crossRate: st.cross / st.plays,
          longRate: st.long / st.plays,
          avgLeave: st.leave / st.leaveN,
          avgOpened: st.opened / st.leaveN,
        };
      }
      t.expect(metrics.opal.opalAffinity > metrics.hollis.opalAffinity && metrics.opal.opalAffinity > metrics.lucky.opalAffinity, `Opal leads baths/springs+Row affinity (${metrics.opal.opalAffinity.toFixed(2)} vs hollis ${metrics.hollis.opalAffinity.toFixed(2)}, lucky ${metrics.lucky.opalAffinity.toFixed(2)})`);
      t.expect(metrics.hollis.crossRate > metrics.opal.crossRate + 0.05 && metrics.hollis.crossRate > metrics.lucky.crossRate + 0.05, `Hollis leads connected cross-play rate (${metrics.hollis.crossRate.toFixed(3)} vs opal ${metrics.opal.crossRate.toFixed(3)}, lucky ${metrics.lucky.crossRate.toFixed(3)})`);
      t.expect(metrics.hollis.avgOpened < metrics.lucky.avgOpened && metrics.hollis.avgOpened < metrics.julian.avgOpened, `Hollis opens fewest premium springs (${metrics.hollis.avgOpened.toFixed(2)} vs lucky ${metrics.lucky.avgOpened.toFixed(2)}, julian ${metrics.julian.avgOpened.toFixed(2)})`);
      t.expect(metrics.lucky.premShare > metrics.hollis.premShare + 0.03 && metrics.lucky.premShare > metrics.opal.premShare + 0.03, `Lucky leads premium share (${metrics.lucky.premShare.toFixed(3)})`);
      t.expect(metrics.julian.longRate > metrics.hollis.longRate && metrics.julian.avgLeave > metrics.lucky.avgLeave, `Julian leads crescendo length (${metrics.julian.longRate.toFixed(3)}) & rack leave (${metrics.julian.avgLeave.toFixed(2)})`);
      t.log('Medium persona profiles: ' + JSON.stringify(metrics));
    },
  },
  {
    name: 'W1-S5-02 Setup character bios stay orthogonal when pairing Opal with Hard or Julian with Easy',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.page.click('#screen [data-go="setup"]');
      await t.page.click('.house-rules summary');

      // Pair Opal with Hard: bio must describe her bathhouse/Row habit, never "plain, everyday words"
      await t.page.click('[data-persona="1"][data-val="opal"]');
      await t.page.selectOption('[data-level="1"]', 'hard');
      const opalBio = (await t.page.textContent('.seat[data-k="1"] .seat-note')).trim();
      const hardNote = (await t.page.textContent('[data-level-note="1"]')).trim();
      t.expect(/bathhouse|Bathhouse Row/i.test(opalBio) && !/plain, everyday/i.test(opalBio), `Opal+Hard bio is trade-grounded (${opalBio})`);
      t.expect(/every word in the book/i.test(hardNote), `Hard blurb stays in difficulty note (${hardNote})`);

      // Pair Julian with Easy: bio must describe his long words / balanced rack habit, never "Knows every word in the book"
      await t.page.click('[data-persona="1"][data-val="julian"]');
      await t.page.selectOption('[data-level="1"]', 'easy');
      const julianBio = (await t.page.textContent('.seat[data-k="1"] .seat-note')).trim();
      const easyNote = (await t.page.textContent('[data-level-note="1"]')).trim();
      t.expect(/long, sweeping words/i.test(julianBio) && !/Knows every word/i.test(julianBio), `Julian+Easy bio is trade-grounded (${julianBio})`);
      t.expect(/everyday words/i.test(easyNote), `Easy blurb stays in difficulty note (${easyNote})`);

      // Check Hollis and Lucky bios too
      await t.page.click('[data-persona="1"][data-val="hollis"]');
      const hollisBio = (await t.page.textContent('.seat[data-k="1"] .seat-note')).trim();
      t.expect(/cross-plays/i.test(hollisBio) && /park words/i.test(hollisBio), `Hollis bio is trade-grounded (${hollisBio})`);

      await t.page.click('[data-persona="1"][data-val="lucky"]');
      const luckyBio = (await t.page.textContent('.seat[data-k="1"] .seat-note')).trim();
      t.expect(/big squares/i.test(luckyBio), `Lucky bio is trade-grounded (${luckyBio})`);

      const cr = await t.contrastReport({ selector: '.setup', min: 4.5, largeMin: 3 });
      t.equal(cr.fails.length, 0, `Setup passes WCAG contrast (${JSON.stringify(cr.fails)})`);
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W1-S5-02-setup-personas');
    },
  },
  {
    name: 'W1-S5-03 hintChoices surfaces a competitive Hot Springs bonus word among the 3 choices without displacing bestHint or forcing uncompetitive plays',
    node: true,
    async run(t) {
      const c = await ctx();
      t.expect(HINT_THEMED_GAP >= 6 && HINT_THEMED_GAP <= 10, `HINT_THEMED_GAP is bounded (${HINT_THEMED_GAP})`);

      // 1) Board with FOX on H8-J8 + rack IDAHARR: top 3 plain moves (HARD, HAIR, RADAR) outrank RADIO (+10 Hot Springs) by <= 5.3 eq.
      // hintChoices(3) must keep HARD as Slot 1 (matching bestHint) and surface RADIO in Slot 3.
      const s = createGame({ mode: 'play', seed: 4, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      s.board[112] = { l: 'F', blank: false };
      s.board[113] = { l: 'O', blank: false };
      s.board[114] = { l: 'X', blank: false };
      s.players[0].rack = ['I', 'D', 'A', 'H', 'A', 'R', 'R'];
      const choices = hintChoices(c.dict, c.lex, s, 3);
      const best = bestHint(c.dict, c.lex, s);
      t.equal(choices.length, 3, 'returns 3 distinct choices');
      t.equal(choices[0].words[0], best.words[0], `Slot 1 matches bestHint (${choices[0].words[0]})`);
      t.equal(choices[0].words[0], 'HARD', `Slot 1 remains strongest plain play HARD (got ${choices[0].words[0]})`);
      t.expect(choices.some((m) => m.words.some((w) => !!c.lex.entry(w))), `surfaces competitive Hot Springs word RADIO among the 3 choices (${choices.map((m) => m.words.join('+')).join(' | ')})`);
      t.equal(choices[2].words[0], 'RADIO', `Slot 3 surfaces RADIO (+10 Hot Springs bonus)`);
      for (const m of choices) t.expect(m.words.every((w) => isTeachableWord(c.dict, c.lex, w)), `choice ${m.words.join('+')} stays teachable`);

      // 2) Uncompetitive Hot Springs word (> HINT_THEMED_GAP behind a 7-tile Full Soak): must NOT force a weak play into top 3.
      const sSoak = createGame({ mode: 'play', seed: 9, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] }, c.lex);
      // Rack spells Full Soaks like RETAINS / RETINAS / NASTIER (~50+ pts) while also containing tiny SPA? Use R,E,T,A,I,N,S (no SPA) -> try S,P,A,I,N,E,R (SPANIEL? S,P,A,R,I,N,G -> SPARING 7-tile Full Soak ~52+ vs SPA 15!)
      sSoak.players[0].rack = ['S', 'P', 'A', 'R', 'I', 'N', 'G'];
      const soakChoices = hintChoices(c.dict, c.lex, sSoak, 3);
      t.expect(soakChoices[0].score >= 45, `Full Soak leads (${soakChoices[0].words[0]} ${soakChoices[0].score} pts)`);
      t.expect(!soakChoices.some((m) => m.words[0] === 'SPA'), `uncompetitive SPA (${soakChoices.map((m) => m.words[0] + ':' + m.score).join(', ')}) is not forced into Full Soak choices`);

      // 3) CD-WF1-06: hidden Featured Spring does not change hintChoices
      const sFeat = JSON.parse(JSON.stringify(s));
      sFeat.featured = [{ id: 'radio', word: 'RADIO', cat: 'town', shown: [0], by: null, at: null }];
      t.equal(JSON.stringify(hintChoices(c.dict, c.lex, sFeat, 3)), JSON.stringify(choices), 'hidden Featured Spring has zero effect on hintChoices');
    },
  },
  {
    name: 'W1-S5-03 newcomer mood-sync corridor: Easy Opal default + above-fold Start + AI worker Spring Guide surfaces competitive Hot Springs word in Other plays',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      // Verify newcomer Setup still holds sticky above-fold Start + Easy Opal default (52f031f, 7c4489e)
      await t.page.click('#screen [data-go="setup"]');
      const setup = await t.page.evaluate(() => {
        const sr = document.querySelector('.setup [data-start]').getBoundingClientRect();
        return {
          persona: document.querySelector('[data-persona="1"][aria-checked="true"]').dataset.val,
          startVisible: sr.top >= 0 && sr.bottom <= innerHeight + 0.5 && sr.height >= 44,
        };
      });
      t.equal(setup.persona, 'opal', 'newcomer defaults to Easy Opal Vance');
      t.equal(setup.startVisible, true, 'Start CTA sits above fold');

      // Start match, set FOX + IDAHARR, ask Spring Guide (AI worker), and cycle Other plays to confirm RADIO (+10) surfaces
      await t.page.click('#screen [data-start]');
      await t.waitIdle(8000);
      const g = (await t.state()).game;
      g.board[112] = { l: 'F', blank: false };
      g.board[113] = { l: 'O', blank: false };
      g.board[114] = { l: 'X', blank: false };
      g.players[0].rack = ['I', 'D', 'A', 'H', 'A', 'R', 'R'];
      await t.game('setState', { game: g });
      await t.waitIdle(5000);

      await t.game('act', 'hint');
      await t.page.waitForFunction(() => window.__game.getState().staged.length > 0 && !window.__G.hintBusy, null, { timeout: 10000 });
      t.equal((await t.state()).ai, 'worker', 'hint ran through the AI worker');
      const seenWords = [(await t.page.textContent('#preview .words')).trim()];
      await t.page.click('#preview [data-hintnext]');
      seenWords.push((await t.page.textContent('#preview .words')).trim());
      await t.page.click('#preview [data-hintnext]');
      seenWords.push((await t.page.textContent('#preview .words')).trim());
      t.expect(seenWords.some((w) => /\bRADIO\b/.test(w)), `Other plays surfaces Hot Springs word RADIO (${seenWords.join(' | ')})`);
      t.expect(/\+10/.test(await t.page.textContent('#preview')), 'surfaced RADIO shows its +10 Hot Springs badge in #preview');
      await t.shot('W1-S5-03-hint-themed');
      await t.checkLayout({ allowScrollY: true });
    },
  },
];
