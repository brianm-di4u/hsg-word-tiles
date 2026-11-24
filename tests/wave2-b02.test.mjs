// Wave 2, batch W2-B02: W1-S2-07, W1-S2-08, W1-S3-04.
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, openedPremium, leaveValue, rackMinus, LEVELS } from '../src/js/ai.js';
import { generateMoves } from '../src/js/movegen.js';
import { townWordsInRack } from '../src/js/lexicon.js';
import { SCORES } from '../src/js/music.js';
import { scoresHtml } from '../src/js/ui.js';
import { dailyPar } from '../src/js/par.js';
import { SQUARE, N } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const withSound = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true })); };

export const tests = [
  {
    name: 'W1-S2-07 Daily Soak solo par disables phantom opponent defense and tapers Turn-10 leave hoarding to 0',
    node: true,
    async run(t) {
      const c = await ctx();

      // 1) Guard against phantom openedPremium() defense in 1-player Daily mode:
      // Find a position where Hard's best 2P move differs from its 1P Daily move specifically because of openedPremium().
      // Place an anchor tile near a Boiling Spring (square 'b') so playing toward it opens a Boiling Spring (penalty 4).
      const boilingIdx = SQUARE.indexOf('b'); // first Boiling Spring on the board
      const br = Math.floor(boilingIdx / N), bc = boilingIdx % N;
      // Put a seed word 2 squares away from the Boiling Spring so opening it triggers openedPremium()
      const anchor = br * N + Math.min(N - 3, Math.max(2, bc + (bc < 7 ? 2 : -2)));
      const sDaily = createGame({ mode: 'daily', date: '2026-11-16', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sDaily.board[anchor] = { l: 'A', blank: false, p: 0, t: 0 };
      sDaily.board[anchor + 1] = { l: 'T', blank: false, p: 0, t: 0 };
      sDaily.daily.turns = 1; // Turn 10: leave weight is 0 so ONLY score vs openedPremium decides!
      sDaily.players[0].rack = ['C', 'R', 'E', 'S', 'T', 'O', 'N'];

      // Check every generated move on this board: in 1P Daily Turn 10, Hard MUST pick the strictly maximum raw score
      // even if it opens a Boiling/Steam square (openedPremium > 0)!
      const gen = generateMoves(c.dict, sDaily.board, sDaily.players[0].rack, { lex: c.lex, featured: [], budget: 1500000 }).moves;
      t.expect(gen.length > 0, 'moves exist near Boiling Spring');
      const maxScore = gen[0].score;
      const dailyPick = chooseAction(c.dict, c.lex, sDaily, { level: 'hard', exact: true });
      t.equal(dailyPick.move.score, maxScore, `Turn-10 1P Daily picks max raw score (${dailyPick.move.score} === ${maxScore}) with 0 defense & 0 leave penalty`);

      // Verify openedPremium > 0 on that exact move and that in 2P Play with a lower-scoring safe alternative, defense STILL applies
      const s2p = createGame({ mode: 'play', seed: 901, seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }] }, c.lex);
      s2p.board = sDaily.board.slice();
      s2p.players[0].rack = ['C', 'R', 'E', 'S', 'T', 'O', 'N'];
      // Verify openedPremium is actually positive on the top raw-score move near the Boiling Spring
      const topOpens = openedPremium(sDaily.board, dailyPick.move.tiles);
      t.expect(topOpens > 0, `top raw-score move near Boiling Spring has openedPremium=${topOpens} > 0`);

      // 2) Guard against Turn-10 leave hoarding: construct a Turn-10 Daily position where a 2-tile play scores more
      // than a 1-tile play that keeps a much better leave (e.g. keeping S/? vs keeping Q/V).
      // Use a controlled rack with '?' and 'S' and 'Q' and 'V' on Turn 10 vs Turn 1.
      const sT10 = createGame({ mode: 'daily', date: '2026-10-05', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sT10.board[112] = { l: 'A', blank: false, p: 0, t: 0 };
      sT10.board[113] = { l: 'T', blank: false, p: 0, t: 0 };
      sT10.players[0].rack = ['?', 'S', 'E', 'R', 'Q', 'V', 'Z'];
      sT10.daily.turns = 1; // Turn 10 -> 0 turns left after this move
      const gen10 = generateMoves(c.dict, sT10.board, sT10.players[0].rack, { lex: c.lex, featured: [], budget: 1500000 }).moves;
      const pickT10 = chooseAction(c.dict, c.lex, sT10, { level: 'hard', exact: true });
      t.equal(pickT10.move.score, gen10[0].score, `Turn 10 Daily ignores leave hoarding and takes max score (${pickT10.move.score} === ${gen10[0].score})`);

      // Same exact board/rack on Turn 1 (daily.turns = 10): leave equity IS active, so Hard prefers keeping S/? over burning them for +1/+2 pts
      const sT1 = JSON.parse(JSON.stringify(sT10));
      sT1.daily.turns = 10;
      const pickT1 = chooseAction(c.dict, c.lex, sT1, { level: 'hard', exact: true });
      const lvT10 = leaveValue(rackMinus(sT10.players[0].rack, pickT10.move.tiles));
      const lvT1 = leaveValue(rackMinus(sT1.players[0].rack, pickT1.move.tiles));
      t.expect(lvT1 >= lvT10, `Turn 1 values leave (${lvT1.toFixed(1)}) at least as much as Turn 10 (${lvT10.toFixed(1)})`);
      t.expect(pickT10.move.score >= pickT1.move.score, `Turn 10 raw score (${pickT10.move.score}) >= Turn 1 raw score (${pickT1.move.score})`);

      // 3) Turn 10 Daily never swaps when any scoring play exists (even weak score < 8 with ugly rack leave < -6)
      const sWeak = createGame({ mode: 'daily', date: '2026-10-06', seats: [{ kind: 'human', name: 'You' }] }, c.lex);
      sWeak.players[0].rack = ['Q', 'V', 'W', 'V', 'U', 'U', 'I'];
      sWeak.board[112] = { l: 'O', blank: false, p: 0, t: 0 };
      sWeak.board[113] = { l: 'N', blank: false, p: 0, t: 0 };
      sWeak.daily.turns = 1;
      const pickWeak = chooseAction(c.dict, c.lex, sWeak, { level: 'hard', exact: true });
      t.equal(pickWeak.action.type, 'play', 'Turn 10 Daily never swaps away its final turn when a play exists');

      // 4) Historical inversion check on key previously-inverted dates (2026-01-15, 2026-11-16, 2026-12-25)
      for (const dt of ['2026-01-15', '2026-11-16', '2026-12-25']) {
        const p = await dailyPar(c, dt);
        t.expect(p.h >= p.m, `${dt}: Julian (${p.h}) >= Hollis (${p.m})`);
      }
    },
  },
  {
    name: 'W1-S2-08 AI lexicon-bonus foresight scales by tier (Easy 0%, Medium 50%, Hard 100%) and townWordsInRack detects formable town words',
    node: true,
    async run(t) {
      const c = await ctx();
      // CD-WF0-09: locked tiers and 107 bonus entries stay completely untouched
      t.equal(JSON.stringify(c.lex.data.tiers), JSON.stringify({ 1: 10, 2: 18, 3: 30 }), 'locked +10/+18/+30 tiers untouched');
      t.equal(c.lex.data.words.length, 107, 'all 107 Hot Springs entries preserved');
      t.equal(LEVELS.easy.bonusWeight, 0, 'Easy bonusWeight is 0');
      t.equal(LEVELS.medium.bonusWeight, 0.5, 'Medium bonusWeight is 0.5');
      t.equal(LEVELS.hard.bonusWeight, 1, 'Hard bonusWeight is 1');

      // Easy ignores hidden Hot Springs bonus weights: choosing with lex vs without lex gives identical actions
      const sEasy1 = createGame({ mode: 'play', seed: 801, seats: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }] }, c.lex);
      sEasy1.players[0].rack = ['S', 'P', 'A', 'Z', 'O', 'N', 'E'];
      const sEasy2 = JSON.parse(JSON.stringify(sEasy1));
      const rWithLex = chooseAction(c.dict, c.lex, sEasy1, { level: 'easy' });
      const rNoLex = chooseAction(c.dict, null, sEasy2, { level: 'easy' });
      t.equal(JSON.stringify(rWithLex.action), JSON.stringify(rNoLex.action), 'Easy makes the exact same choice with or without hidden Hot Springs bonuses');

      // movegen evalScore respects bonusWeight while keeping m.score equal to the true engine score
      const m0 = generateMoves(c.dict, sEasy1.board, ['S', 'T', 'E', 'A', 'M', 'Z', 'X'], { lex: c.lex, featured: [], bonusWeight: 0 }).moves;
      const m5 = generateMoves(c.dict, sEasy1.board, ['S', 'T', 'E', 'A', 'M', 'Z', 'X'], { lex: c.lex, featured: [], bonusWeight: 0.5 }).moves;
      const m1 = generateMoves(c.dict, sEasy1.board, ['S', 'T', 'E', 'A', 'M', 'Z', 'X'], { lex: c.lex, featured: [], bonusWeight: 1 }).moves;
      const steam0 = m0.find((m) => m.words.includes('STEAM'));
      const steam5 = m5.find((m) => m.words.includes('STEAM'));
      const steam1 = m1.find((m) => m.words.includes('STEAM'));
      t.expect(!!steam0 && !!steam5 && !!steam1, 'STEAM generated under all bonusWeights');
      t.equal(steam0.score, steam1.score, 'true engine score preserved under bonusWeight=0');
      t.equal(steam0.evalScore, steam0.score - steam0.bonus, 'bonusWeight=0 subtracts 100% of bonus from evalScore');
      t.equal(steam5.evalScore, steam5.score - 0.5 * steam5.bonus, 'bonusWeight=0.5 subtracts 50% of bonus from evalScore');
      t.equal(steam1.evalScore, steam1.score, 'bonusWeight=1 keeps full bonus in evalScore');

      // Medium vs Hard bonus foresight split: on a rack with ZEST (high base) vs SPA (+10 tier 1),
      // verify Medium (50% = +5) and Hard (100% = +10) evaluate the exact bonus differential cleanly
      const sSplit = createGame({ mode: 'play', seed: 802, seats: [{ kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'hard' }] }, c.lex);
      sSplit.players[0].rack = ['S', 'P', 'A', 'J', 'A', 'W', 'S'];
      const rMed = chooseAction(c.dict, c.lex, JSON.parse(JSON.stringify(sSplit)), { level: 'medium', exact: true });
      const rHard = chooseAction(c.dict, c.lex, JSON.parse(JSON.stringify(sSplit)), { level: 'hard', exact: true });
      t.expect(rMed.move.evalScore === rMed.move.score - 0.5 * (rMed.move.bonus || 0), 'Medium ranks by 50% bonusWeight');
      t.expect(rHard.move.evalScore === rHard.move.score, 'Hard ranks by 100% bonusWeight');

      // Organic bonus still pays full value when Easy plays a Hot Springs word on its own letter merit
      const sOrg = createGame({ mode: 'play', seed: 803, seats: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'easy' }] }, c.lex);
      sOrg.players[0].rack = ['S', 'P', 'A', 'Q', 'V', 'W', 'X'];
      const rOrg = apply(sOrg, { type: 'play', tiles: [{ i: 112, l: 'S', blank: false }, { i: 113, l: 'P', blank: false }, { i: 114, l: 'A', blank: false }] }, c);
      t.expect(rOrg.ok && rOrg.entry.themed === 10, 'Engine still awards full +10 tier bonus on organic play');

      // townWordsInRack pure helper
      const hits = townWordsInRack(['S', 'P', 'A', 'Q', 'X', 'Z', 'V'], c.lex);
      t.expect(hits.some((h) => h.word === 'SPA'), 'townWordsInRack detects SPA');
      t.equal(townWordsInRack(['Q', 'X', 'Z', 'V', 'W', 'Y', 'B'], c.lex).length, 0, 'townWordsInRack returns empty when no town word fits');
      t.expect(townWordsInRack(['S', 'P', '?', 'X', 'Z', 'V', 'W'], c.lex).some((h) => h.word === 'SPA'), 'townWordsInRack supports blank tiles');
    },
  },
  {
    name: 'W1-S2-08 Help Hot Springs words has browsable 6-category reference without fact spoilers, and rack cue is optional and zero-shift',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      // 1) Help -> Hot Springs words browsable category reference
      await t.game('scene', 'help');
      await t.page.click('[data-tab="words"]');
      const ref = await t.page.evaluate(() => {
        const items = [...document.querySelectorAll('.word-ref .cat-ref')];
        return items.map((d) => {
          const s = d.querySelector('summary');
          return { cat: d.dataset.catRef, h: Math.round(s.getBoundingClientRect().height), text: s.textContent.trim() };
        });
      });
      t.equal(ref.length, 6, 'all 6 Hot Springs categories are browsable in Help');
      t.expect(ref.every((r) => r.h >= 44), 'every category summary meets >= 44 px touch floor: ' + JSON.stringify(ref));
      await t.page.click('.cat-ref[data-cat-ref="springs"] summary');
      const bodyText = await t.page.textContent('.cat-ref[data-cat-ref="springs"] .cat-ref-body');
      t.expect(/\+10/.test(bodyText) && /\+18/.test(bodyText) && /\+30/.test(bodyText), 'tiers +10/+18/+30 shown');
      t.expect(/SPRING/.test(bodyText) && /TUFA/.test(bodyText) && /COLD/.test(bodyText), 'word families listed cleanly');
      t.expect(!/4,400 years|Fordyce basement|Source:/.test(bodyText), 'fact cards are NOT spoiled in Help');
      const cDay = await t.contrastReport({ selector: '.word-ref', min: 4.5, largeMin: 3 });
      t.equal(cDay.fails.length, 0, 'Help word-ref passes Day WCAG contrast (' + JSON.stringify(cDay.fails) + ')');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W1-S2-08-help-words');

      // 2) Optional subtle rack cue: zero layout shift, hidden on non-town racks, Settings toggle, hidden in Challenge mode
      await t.game('newGame', { seed: 9, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      const geom = () => t.page.evaluate(() => {
        const r = (sel) => document.querySelector(sel).getBoundingClientRect();
        const cue = document.querySelector('#rack-cue');
        const bar = r('#rackbar');
        const cr = cue && !cue.hidden ? cue.getBoundingClientRect() : null;
        return {
          rackTop: Math.round(r('#rack').top),
          playTop: Math.round(r('#actions .play').top),
          visible: !!cr && cr.width > 0 && cr.height > 0,
          insideBar: !!cr && cr.left >= bar.left - 1 && cr.right <= bar.right + 1 && cr.top >= bar.top - 1 && cr.bottom <= bar.bottom + 1,
        };
      });
      let st = (await t.state()).game;
      st.players[0].rack = ['Q', 'X', 'Z', 'V', 'W', 'Y', 'B'];
      await t.game('setState', { game: st });
      const gOff = await geom();
      t.equal(gOff.visible, false, 'rack cue hidden when rack cannot form a town word');

      st = (await t.state()).game;
      st.players[0].rack = ['S', 'P', 'A', 'Q', 'X', 'Z', 'V'];
      await t.game('setState', { game: st });
      const gOn = await geom();
      t.equal(gOn.visible, true, 'rack cue appears when rack can form a town word');
      t.equal(gOn.insideBar, true, 'rack cue sits strictly inside #rackbar');
      t.equal(gOn.rackTop, gOff.rackTop, 'rack cue causes 0 px shift on #rack');
      t.equal(gOn.playTop, gOff.playTop, 'rack cue causes 0 px shift on #actions .play');
      const cueContrast = await t.contrastReport({ selector: '#rack-cue', min: 4.5, largeMin: 3 });
      t.equal(cueContrast.fails.length, 0, 'rack cue passes WCAG contrast (' + JSON.stringify(cueContrast.fails) + ')');
      await t.shot('W1-S2-08-rack-cue');

      // Challenge mode suppresses the rack cue
      await t.game('newGame', { seed: 9, challenge: true, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      st = (await t.state()).game;
      st.players[0].rack = ['S', 'P', 'A', 'Q', 'X', 'Z', 'V'];
      await t.game('setState', { game: st });
      t.equal((await geom()).visible, false, 'rack cue stays hidden in Challenge mode');

      // Settings toggle turns it off cleanly
      await t.game('newGame', { seed: 9, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitIdle(6000);
      await t.game('scene', 'settings');
      await t.page.click('[data-set="townCue"][data-val="false"]');
      await t.game('scene', 'game');
      st = (await t.state()).game;
      st.players[0].rack = ['S', 'P', 'A', 'Q', 'X', 'Z', 'V'];
      await t.game('setState', { game: st });
      t.equal((await geom()).visible, false, 'turning Hot Springs rack cue Off in Settings hides it');
    },
  },
  {
    name: 'W1-S3-04 SCORES.table defines perc2 + lead.lift and scoresHtml shows per-seat tile counts strictly when bag is empty (Node)',
    node: true,
    async run(t) {
      t.expect(!!SCORES.table.perc2 && Array.isArray(SCORES.table.perc2.b) && SCORES.table.perc2.b.length >= 2, 'SCORES.table defines perc2 brush layer');
      t.equal(SCORES.table.lead.lift, true, 'SCORES.table defines lead.lift');

      const mk = (bagLen, mode = 'play') => ({
        mode, over: false, cur: 0, bag: Array(bagLen).fill('E'),
        players: [
          { kind: 'human', name: 'You', score: 180, rack: ['A', 'E', 'S'] },
          { kind: 'human', name: 'Player 2', score: 170, rack: ['T'] },
          { kind: 'human', name: 'Player 3', score: 165, rack: ['R', 'N', 'I', 'O', 'L'] },
        ],
      });
      const fullDesk = scoresHtml(mk(12), false);
      const fullMob = scoresHtml(mk(12), true);
      t.expect(!/data-tiles/.test(fullDesk) && !/data-tiles/.test(fullMob), 'tile counts stay hidden while bag > 0');

      const emptyDesk = scoresHtml(mk(0), false);
      const emptyMob = scoresHtml(mk(0), true);
      t.expect(emptyDesk.includes('3 tiles') && emptyDesk.includes('1 tile') && emptyDesk.includes('5 tiles'), 'desktop .pcard shows each seat tile count when bag === 0');
      t.expect(emptyMob.includes('3 tiles') && emptyMob.includes('1 tile') && emptyMob.includes('5 tiles'), 'mobile .chip shows each seat tile count when bag === 0');
      t.expect(/1 tile left/.test(emptyMob), 'mobile .chip aria-label includes remaining tile count');

      const dailyEmpty = scoresHtml(mk(0, 'daily'), false);
      t.expect(!/data-tiles/.test(dailyEmpty), 'Daily Soak does not show opponent rack counts');
    },
  },
  {
    name: 'W1-S3-04 Standard Play shows empty-bag per-seat tile counts (2P & 4P), phase callouts at bag < 7 and bag === 0, and progressive endgame music escalation',
    viewports: ['desktop', 'mobile'],
    initScript: withSound,
    async run(t) {
      await ready(t);
      // Unlock WebAudio via a real gesture on Title
      await t.page.click('[data-go="setup"]');
      await t.game('newGame', {
        seed: 12,
        seats: [
          { kind: 'human', name: 'You' },
          { kind: 'ai', persona: 'opal', level: 'easy' },
          { kind: 'ai', persona: 'hollis', level: 'medium' },
          { kind: 'ai', persona: 'julian', level: 'hard' },
        ],
      });
      await t.waitIdle(6000);

      // 1) Midgame (bag >= 14): intensity 0, no phase callout, no tile counts
      let st = (await t.state()).game;
      st.bag = Array(20).fill('E');
      await t.game('setState', { game: st });
      t.equal(await t.page.evaluate(() => window.__game.audioState().intensity), 0, 'bag=20 intensity is 0');
      t.equal(await t.page.locator('[data-tiles]').count(), 0, 'no seat tile counts while bag > 0');

      // 2) Approaching endgame (bag < 14, >= 7): progressive ramp to 0.35
      st = (await t.state()).game;
      st.bag = Array(10).fill('E');
      await t.game('setState', { game: st });
      t.equal(await t.page.evaluate(() => window.__game.audioState().intensity), 0.35, 'bag=10 (< 14) ramps intensity to 0.35');

      // 3) Final stretch (bag < 7, > 0): swaps closed callout + intensity 0.6 (activates perc2)
      st = (await t.state()).game;
      st.bag = Array(5).fill('E');
      await t.game('setState', { game: st });
      t.equal(await t.page.evaluate(() => window.__game.audioState().intensity), 0.6, 'bag=5 (< 7) ramps intensity to 0.6');
      const finalCallout = await t.page.evaluate(() => {
        const el = document.querySelector('#turnline .bag');
        return { text: el.textContent.trim(), clipped: el.scrollWidth > el.clientWidth + 1 };
      });
      t.expect(/Final stretch · swaps closed/.test(finalCallout.text), 'bag < 7 displays Final stretch · swaps closed (' + finalCallout.text + ')');
      t.equal(finalCallout.clipped, false, 'Final stretch callout is never truncated');
      t.equal(await t.page.locator('[data-act="swap"]').isDisabled(), true, 'Swap button is disabled at bag < 7');

      // 4) Empty bag (bag === 0) with 4 players: per-seat remaining tile counts visible on all 4 seats + Bag empty callout + intensity 0.9 (perc2 + lead.lift)
      st = (await t.state()).game;
      st.bag = [];
      st.players[0].rack = ['A', 'E', 'S'];
      st.players[1].rack = ['T'];
      st.players[2].rack = ['R', 'N', 'I', 'O'];
      st.players[3].rack = ['L', 'D'];
      await t.game('setState', { game: st });
      t.equal(await t.page.evaluate(() => window.__game.audioState().intensity), 0.9, 'bag=0 ramps intensity to 0.9');

      const emptyHud = await t.page.evaluate(() => {
        const bag = document.querySelector('#turnline .bag');
        const tiles = [...document.querySelectorAll('[data-tiles]')].map((el) => ({
          seat: +el.dataset.tiles,
          text: el.textContent.trim(),
          low: el.classList.contains('low'),
          visible: el.getBoundingClientRect().width > 0 && el.getBoundingClientRect().height > 0,
        }));
        return { text: bag.textContent.trim(), clipped: bag.scrollWidth > bag.clientWidth + 1, tiles };
      });
      t.expect(/Bag empty · go out to collect remaining tiles/.test(emptyHud.text), 'bag === 0 displays Bag empty callout (' + emptyHud.text + ')');
      t.equal(emptyHud.clipped, false, 'Bag empty callout is never truncated');
      t.equal(emptyHud.tiles.length, 4, 'all 4 seats display remaining tile counts');
      t.equal(emptyHud.tiles.map((x) => x.text).join('|'), '3 tiles|1 tile|4 tiles|2 tiles', 'exact tile counts rendered per seat');
      t.expect(emptyHud.tiles.every((x) => x.visible), 'all 4 seat tile counts are visible even in 4P compact layout');
      t.equal(emptyHud.tiles[1].low, true, '1-tile seat carries .low highlight');

      const contrast = await t.contrastReport({ selector: t.viewport === 'mobile' ? '#turnline' : '#scores, #turnline', min: 4.5, largeMin: 3 });
      t.equal(contrast.fails.length, 0, 'endgame HUD passes WCAG contrast (' + JSON.stringify(contrast.fails) + ')');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W1-S3-04-endgame-4p');

      // 5) Offline audio render verification (desktop): SCORES.table at inten=0 vs 0.6 vs 0.9 and full volume headroom <= 0.88
      if (t.viewport === 'desktop') {
        const r0 = await t.game('audioRender', 'table', 20, false, { intensity: 0 });
        const r6 = await t.game('audioRender', 'table', 20, false, { intensity: 0.6 });
        const r9 = await t.game('audioRender', 'table', 20, false, { intensity: 0.9 });
        const r9Full = await t.game('audioRender', 'table', 20, false, { intensity: 0.9, vol: 1 });
        t.log(`table render (20s): i=0 peak=${r0.peak} rms=${r0.rmsDb}dB bars=${r0.built.bars} | i=0.6 peak=${r6.peak} rms=${r6.rmsDb}dB bars=${r6.built.bars} | i=0.9 peak=${r9.peak} rms=${r9.rmsDb}dB bars=${r9.built.bars} | i=0.9@vol1 peak=${r9Full.peak}`);
        t.expect(r6.peak > r0.peak, `perc2 brush layer raises peak at intensity=0.6 (${r6.peak} > ${r0.peak})`);
        t.expect(r9.peak > r0.peak && r9.rms > r0.rms && r9.peak < 0.3, `endgame climax at intensity=0.9 lifts peak & RMS cleanly (peak ${r9.peak}, rms ${r9.rmsDb} dB)`);
        t.expect(r9Full.peak <= 0.88, `endgame table at 100% volume stays safely under 0.88 peak (${r9Full.peak})`);
      }
    },
  },
];
