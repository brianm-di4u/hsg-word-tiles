// Wave 2, batch W2-B17: W1-S5-02 (orthogonal trade-grounded styles & bios for all 4 town personas)
// and W1-S5-03 (mood-sync onboarding + competitive Hot Springs bonus word surfaced in Spring Guide hints).
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, STYLES, styleBonus, premiumPoints, leaveValue, rackMinus, openedPremium, EASY_TWO } from '../src/js/ai.js';
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
              st.prem += premiumPoints({ tiles: e.tiles, score: e.score });
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
];
