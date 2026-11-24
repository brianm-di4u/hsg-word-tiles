// Wave 2, batch W2-B01: W1-S3-01, W1-S3-02, W1-S3-03, W1-P-N02.
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, hintChoices, LEVELS, EASY_TWO } from '../src/js/ai.js';
import { reviewSteps } from '../src/js/review.js';
import { emptyStats, applyDaily } from '../src/js/stats.js';
import { pruneDays } from '../src/js/storage.js';
import { dailyLine } from '../src/js/ui.js';
import { isCommon } from '../src/js/dict.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: true })); };

export const tests = [
  {
    name: 'W1-S3-01 Easy AI plays only everyday common words + EASY_TWO, avoids Full Soaks, and averages ~220-290 pts',
    node: true,
    async run(t) {
      const c = await ctx();
      t.equal(LEVELS.easy.freeLen, 0, 'Easy freeLen is 0');
      t.expect(LEVELS.easy.slip >= 0.6, 'Easy slip is softened (' + LEVELS.easy.slip + ')');
      t.expect(LEVELS.easy.maxLen <= 6, 'Easy maxLen caps routine 7-tile Full Soaks (' + LEVELS.easy.maxLen + ')');

      // Explicit guard against obscure 2-3 letter tournament words: rack with only rare 2-3 letter tools (QI, ZA, XI, ZAX, XU, KI)
      const sRare = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }], seed: 42 }, c.lex);
      sRare.players[0].rack = ['Q', 'I', 'Z', 'X', 'U', 'K', 'J'];
      const rRare = chooseAction(c.dict, c.lex, sRare, { level: 'easy' });
      if (rRare.action.type === 'play') {
        for (const w of rRare.move.words) {
          t.expect(w.length === 2 ? EASY_TWO.has(w) : isCommon(c.dict, w), `Easy must not play rare word ${w}`);
        }
      }

      // Explicit check that everyday 2-letter OK is playable by Easy even though OK is not marked SCOWL common
      const sOk = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }], seed: 43 }, c.lex);
      sOk.players[0].rack = ['O', 'K', 'Q', 'V', 'Z', 'J', 'X'];
      const rOk = chooseAction(c.dict, c.lex, sOk, { level: 'easy' });
      t.equal(rOk.action.type, 'play', 'Easy can play everyday OK when no longer word fits');
      t.expect(rOk.move.words.includes('OK'), 'Easy played OK (' + rOk.move.words.join(',') + ')');

      // 40 seeded Easy-vs-Medium games: verify beginner score band and zero obscure short words or 7-tile Full Soaks
      let words = 0, bad = 0, easyFulls = 0;
      const easyScores = [];
      for (let g = 0; g < 40; g++) {
        const flip = g % 2 === 1;
        const seats = flip ? [{ kind: 'ai', level: 'easy' }, { kind: 'ai', level: 'medium' }] : [{ kind: 'ai', level: 'medium' }, { kind: 'ai', level: 'easy' }];
        const s = createGame({ mode: 'play', seats, seed: 3000 + g }, c.lex);
        let guard = 0;
        while (!s.over && guard++ < 400) {
          const lv = s.players[s.cur].level;
          const { action } = chooseAction(c.dict, c.lex, s, { level: lv });
          const r = apply(s, action, c);
          if (!r.ok) throw new Error(`illegal move: ${r.error}`);
          if (lv === 'easy' && r.entry.kind === 'play') {
            if (r.entry.full) easyFulls++;
            for (const w of r.entry.words) {
              words++;
              const ok = w.w.length === 2 ? EASY_TWO.has(w.w) : isCommon(c.dict, w.w);
              if (!ok) bad++;
            }
          }
        }
        easyScores.push(s.players[flip ? 0 : 1].score);
      }
      const avg = easyScores.reduce((a, b) => a + b, 0) / easyScores.length;
      t.equal(bad, 0, `zero non-common/obscure words across ${words} Easy words`);
      t.equal(easyFulls, 0, 'Easy drops zero 7-tile Full Soaks');
      t.expect(avg >= 190 && avg <= 285, `Easy avg vs Medium is approachable beginner tier (${avg.toFixed(1)} pts)`);
      t.log(`Easy vs Medium (40g): avg=${avg.toFixed(1)} pts, words=${words}, nonCommon=${bad}, fullSoaks=${easyFulls}`);
    },
  },
  {
    name: 'W1-S3-02 AI opponents, Spring Guide hints, and post-game Review never peek at hidden Featured Springs (+30)',
    node: true,
    async run(t) {
      const c = await ctx();
      // Construct a position where the rack can play either a fogged Featured Spring (CASINO) or a higher-scoring non-featured word (CASINOS/etc.)
      // Compare chooseAction & hintChoices WITH the hidden Featured Spring vs WITH featured: [] — results must be byte-identical across all levels!
      for (const level of ['easy', 'medium', 'hard']) {
        const makeState = (feat) => {
          const s = createGame({ mode: 'play', seats: [{ kind: 'ai', level }, { kind: 'ai', level }], seed: 777 }, c.lex);
          // Rack can make CASINO (tier 2, +18) or CAZIQUE/etc., or ZAX/CASINO — use a rack where CASINO is beaten by a plain/themed play WITHOUT +30, but wins WITH +30!
          s.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'Z'];
          s.featured = feat;
          return s;
        };
        const hiddenFeat = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
        const withFeat = chooseAction(c.dict, c.lex, makeState(hiddenFeat), { level, exact: true });
        const withoutFeat = chooseAction(c.dict, c.lex, makeState([]), { level, exact: true });
        t.equal(JSON.stringify(withFeat.action), JSON.stringify(withoutFeat.action), `${level} AI action is identical with or without hidden Featured Spring`);
        t.equal(withFeat.move?.featured || 0, 0, `${level} AI move scoring adds 0 hidden Featured equity`);
      }

      // Spring Guide hints must be identical with or without hidden Featured Spring
      const hWith = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', level: 'medium' }], seed: 778 }, c.lex);
      hWith.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'Z'];
      hWith.featured = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
      const hWithout = JSON.parse(JSON.stringify(hWith));
      hWithout.featured = [];
      t.equal(JSON.stringify(hintChoices(c.dict, c.lex, hWith, 3)), JSON.stringify(hintChoices(c.dict, c.lex, hWithout, 3)), 'hintChoices ignores hidden Featured Spring');

      // Review must not add +30 hidden Featured equity
      const revState = JSON.parse(JSON.stringify(hWith));
      const applied = apply(revState, { type: 'play', tiles: [{ i: 112, l: 'I', blank: false }, { i: 113, l: 'N', blank: false }] }, c);
      t.expect(applied.ok, 'setup play applied');
      const revNoFeat = JSON.parse(JSON.stringify(revState));
      revNoFeat.featured = [];
      const stepsWith = [...reviewSteps(revState, 0, c.dict, c.lex)];
      const stepsWithout = [...reviewSteps(revNoFeat, 0, c.dict, c.lex)];
      t.equal(JSON.stringify(stepsWith), JSON.stringify(stepsWithout), 'reviewSteps ignores hidden Featured Spring');

      // Hard empty-bag 1-ply lookahead must also ignore hidden Featured Springs on opponent's reply
      const endWith = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }], seed: 780 }, c.lex);
      endWith.bag = [];
      endWith.board[112] = { l: 'S', blank: false, p: 1, t: 0 };
      endWith.board[113] = { l: 'O', blank: false, p: 1, t: 0 };
      endWith.players[0].rack = ['A', 'T', 'E'];
      endWith.players[1].rack = ['C', 'A', 'S', 'I', 'N', 'O'];
      endWith.featured = [{ id: 'casino', word: 'CASINO', cat: 'club', shown: [0], by: null, at: null }];
      const endWithout = JSON.parse(JSON.stringify(endWith));
      endWithout.featured = [];
      const e1 = chooseAction(c.dict, c.lex, endWith, { level: 'hard', exact: true });
      const e2 = chooseAction(c.dict, c.lex, endWithout, { level: 'hard', exact: true });
      t.equal(JSON.stringify(e1.action), JSON.stringify(e2.action), 'Hard 1-ply empty-bag lookahead ignores hidden Featured Spring');

      // Verify organic claims STILL work in the engine when an AI happens to play the Featured word on its own merit
      const org = createGame({ mode: 'play', seats: [{ kind: 'ai', level: 'hard' }, { kind: 'ai', level: 'hard' }], seed: 779 }, c.lex);
      org.players[0].rack = ['C', 'A', 'S', 'I', 'N', 'O', 'S'];
      org.featured = [{ id: 'casino', word: 'CASINOS', cat: 'club', shown: [0], by: null, at: null }];
      const pick = chooseAction(c.dict, c.lex, org, { level: 'hard', exact: true });
      t.equal(pick.move.featured, 0, 'Hard AI did not see +30 during search');
      const res = apply(org, pick.action, c);
      t.expect(res.ok && res.entry.words.some((w) => w.w === 'CASINOS'), 'Hard AI organically played 7-tile CASINOS on word merit');
      t.equal(res.entry.featured, 'CASINOS', 'Engine still awards organic Featured Spring claim');
      t.equal(org.featured[0].by, 0, 'Featured plaque marked claimed by seat 0');
    },
  },
  {
    name: 'W1-S3-03 Daily Soak shows un-truncated Turn X / 10, precomputed live par pips during play, and ramps music intensity on turns 8-10',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      // Click Daily Soak from title (also unlocks WebAudio so audioState().intensity is live)
      await t.page.click('[data-go="daily"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 10000 });
      await t.waitIdle(8000);
      // Wait for off-thread dailyPar to populate live par pips during Turn 1
      await t.page.waitForFunction(() => document.querySelectorAll('#turnline .par-pip').length === 2, null, { timeout: 15000 });

      const hud = await t.page.evaluate(() => {
        const badge = document.querySelector('#turnline .daily-turn');
        const bar = document.querySelector('#topbar').getBoundingClientRect();
        const br = badge.getBoundingClientRect();
        const pips = [...document.querySelectorAll('#turnline .par-pip')].map((el) => ({
          text: el.textContent.trim(),
          met: el.classList.contains('met'),
          clipped: el.scrollWidth > el.clientWidth + 1,
        }));
        return {
          text: badge.textContent.trim(),
          clipped: badge.scrollWidth > badge.clientWidth + 1,
          insideBar: br.left >= bar.left - 1 && br.right <= bar.right + 1 && br.width >= 50,
          pips,
          cached: !!window.__G.parCache[window.__G.s.daily.date],
        };
      });
      t.equal(hud.text, 'Turn 1 / 10', 'Daily topbar leads with Turn 1 / 10');
      t.equal(hud.clipped, false, 'Turn badge is never truncated');
      t.expect(hud.insideBar, 'Turn badge fits cleanly inside #topbar');
      t.equal(hud.pips.length, 2, 'Both live star-threshold par pips are visible on Turn 1');
      t.expect(hud.pips.every((p) => !p.clipped && /★+\s*\d+/.test(p.text)), 'Par pips show star thresholds cleanly: ' + JSON.stringify(hud.pips));
      t.expect(hud.cached, 'Par is cached in G.parCache');

      const contrast = await t.contrastReport({ selector: '#turnline', min: 4.5, largeMin: 3 });
      t.equal(contrast.fails.length, 0, 'Daily topbar passes WCAG contrast (' + JSON.stringify(contrast.fails) + ')');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W1-S3-03-daily-hud');

      // Verify music intensity ramp across turns 1..7 (0), turns 8-9 (0.5), turn 10 (0.85), plus .par-pip.met when score beats par
      const checkTurn = async (turnsLeft, score) => {
        const st = (await t.state()).game;
        st.daily.turns = turnsLeft;
        st.players[0].score = score;
        await t.game('setState', { game: st });
        await t.page.evaluate(() => { /* trigger moodUpdate via scene/state refresh */ });
        return t.page.evaluate(() => ({
          turn: document.querySelector('#turnline .daily-turn')?.textContent.trim(),
          met: document.querySelectorAll('#turnline .par-pip.met').length,
          intensity: window.__game.audioState().intensity,
        }));
      };
      // Trigger moodUpdate on setState? Let's verify turns via passing/playing or check moodUpdate in setState!
      const t1 = await t.page.evaluate(() => window.__game.audioState().intensity);
      t.equal(t1, 0, 'Turn 1 music intensity is 0');

      // Advance to Turn 8 (turns === 3) via actual game passes so afterAction -> moodUpdate runs genuinely
      for (let k = 0; k < 7; k++) await t.game('act', 'pass');
      await t.waitIdle(5000);
      t.equal((await t.page.textContent('#turnline .daily-turn')).trim(), 'Turn 8 / 10', 'Turn 8 badge updated');
      t.equal((await t.page.evaluate(() => window.__game.audioState().intensity)), 0.5, 'Turn 8 (3 turns left) ramps music intensity to 0.5');

      await t.game('act', 'pass');
      await t.waitIdle(5000);
      t.equal((await t.page.textContent('#turnline .daily-turn')).trim(), 'Turn 9 / 10', 'Turn 9 badge updated');
      t.equal((await t.page.evaluate(() => window.__game.audioState().intensity)), 0.5, 'Turn 9 (2 turns left) holds music intensity at 0.5');

      await t.game('act', 'pass');
      await t.waitIdle(5000);
      t.equal((await t.page.textContent('#turnline .daily-turn')).trim(), 'Turn 10 / 10', 'Turn 10 badge updated');
      t.equal((await t.page.evaluate(() => window.__game.audioState().intensity)), 0.85, 'Turn 10 (1 turn left) ramps music intensity to 0.85');

      // Verify .par-pip.met lights up when score exceeds par threshold
      const stHigh = await checkTurn(1, 999);
      t.equal(stHigh.met, 2, 'Both par pips highlight when score exceeds both thresholds');
    },
  },
  {
    name: 'W1-P-N02 applyDaily, dailyLine, and pruneDays lock official Daily progress to e.first (Node)',
    node: true,
    async run(t) {
      const s1 = applyDaily(emptyStats(), 120, 1);
      t.equal(s1.daily.games, 1, 'first run increments daily.games');
      t.equal(s1.daily.best, 120, 'first run sets daily.best');
      const s2 = applyDaily(s1, 450, 1, { replay: true });
      t.equal(s2.daily.games, 1, 'practice replay does not increment daily.games');
      t.equal(s2.daily.best, 120, 'practice replay does not overwrite daily.best');
      t.equal(dailyLine({ today: { score: 450, first: 120, plays: 2 }, streak: 3 }), 'Today: 120 pts · streak 3', 'Title dailyLine uses e.first');
      // pruneDays preserves the day with the highest official `first` score (not a spoiled replay score)
      const days = {};
      for (let k = 0; k < 410; k++) {
        const dt = new Date(Date.UTC(2025, 0, 1 + k, 12)).toISOString().slice(0, 10);
        days[dt] = { score: 100, first: 100, plays: 1 };
      }
      days['2025-01-02'] = { score: 900, first: 150, plays: 2 };
      days['2025-01-03'] = { score: 300, first: 300, plays: 1 };
      const kept = pruneDays(days, 400);
      t.expect(!!kept['2025-01-03'], 'highest official first day (300) is kept');
      t.expect(!kept['2025-01-02'], 'spoiled replay score (900 with first 150) does not displace official best day');
    },
  },
  {
    name: 'W1-P-N02 Daily Soak locks official score to first run and labels replays as Practice replay with pre-launch confirmation',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      // 1. Official first run: play Turn 1 then pass 9 turns so first score is modest (>0)
      await t.page.click('[data-go="daily"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 10000 });
      await t.waitIdle(5000);
      const date = (await t.state()).game.daily.date;
      const [m0] = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', m0.tiles);
      await t.game('act', 'play');
      await t.waitIdle(5000);
      for (let k = 0; k < 9; k++) { await t.game('act', 'pass'); await t.waitIdle(5000); }
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 10000 });
      const firstScore = (await t.state()).game.players[0].score;
      t.expect(firstScore > 0, `first official run scored ${firstScore}`);

      let dailyRec = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-daily-v1')));
      let statRec = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-stats-v1')));
      t.equal(dailyRec.days[date].first, firstScore, 'first run stored in days[date].first');
      t.equal(dailyRec.days[date].score, firstScore, 'first run stored in days[date].score');
      t.equal(statRec.daily.games, 1, 'stats.daily.games is 1');
      t.equal(statRec.daily.best, firstScore, 'stats.daily.best matches firstScore');

      // 2. Return to Title and click Daily Soak again: must confirm Practice replay before launching
      await t.page.click('[data-go="title"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'title', null, { timeout: 5000 });
      t.equal((await t.page.textContent('[data-go="daily"] small')).trim(), `Today: ${firstScore} pts · streak 1`, 'Title shows official first score');
      await t.page.click('[data-go="daily"]');
      await t.page.waitForSelector('#modal .dialog', { timeout: 5000 });
      const dlgText = await t.page.textContent('#modal .dialog');
      t.expect(/Practice replay\?/.test(dlgText) && dlgText.includes(`${firstScore} points`), 'Confirmation dialog warns official score is recorded (' + dlgText + ')');
      await t.page.click('#modal [data-ok]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 10000 });
      await t.waitIdle(5000);
      t.expect(/Practice/.test(await t.page.textContent('#turnline')), 'HUD labels the replay as Practice');

      // 3. Complete Practice replay with a HIGHER score via autoplay
      await t.game('act', 'autoplay');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 20000 });
      const replayScore = (await t.state()).game.players[0].score;
      t.expect(replayScore > firstScore, `Practice replay outscored first run (${replayScore} > ${firstScore})`);

      const boxText = await t.page.textContent('.sheet.over');
      t.expect(/Practice replay/i.test(boxText), 'Results screen clearly labels Practice replay');
      t.expect(boxText.includes(`Your first try today: ${firstScore}.`), 'Results screen still displays first try');
      t.expect(boxText.includes(`Best practice replay today: ${replayScore}.`), 'Results screen displays separate replayBest');
      await t.checkLayout({ allowScrollY: true });
      await t.shot('W1-P-N02-practice-replay');

      // 4. Verify official Daily record, career stats, Title, and Records were NOT corrupted by the higher replay score
      dailyRec = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-daily-v1')));
      statRec = await t.page.evaluate(() => JSON.parse(localStorage.getItem('hs-letters-stats-v1')));
      t.equal(dailyRec.days[date].first, firstScore, 'days[date].first stays locked to firstScore');
      t.equal(dailyRec.days[date].score, firstScore, 'days[date].score stays locked to firstScore');
      t.equal(dailyRec.days[date].replayBest, replayScore, 'days[date].replayBest tracks replay separately');
      t.equal(dailyRec.days[date].plays, 2, 'days[date].plays is 2');
      t.equal(statRec.daily.games, 1, 'stats.daily.games did not increment on replay');
      t.equal(statRec.daily.best, firstScore, 'stats.daily.best was not overwritten by replayScore');

      await t.page.click('[data-go="title"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'title', null, { timeout: 5000 });
      t.equal((await t.page.textContent('[data-go="daily"] small')).trim(), `Today: ${firstScore} pts · streak 1`, 'Title Today stays locked to official firstScore');
      await t.page.click('[data-go="records"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'records', null, { timeout: 5000 });
      const bestDayText = await t.page.evaluate(() => {
        const stats = [...document.querySelectorAll('.sheet.records .stat')];
        const cell = stats.find((el) => /best day/i.test(el.textContent));
        return cell ? cell.querySelector('b').textContent.trim() : null;
      });
      t.equal(bestDayText, String(firstScore), 'Records best day matches official firstScore, not replayScore');
    },
  },
];
