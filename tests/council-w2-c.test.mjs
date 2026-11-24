// Wave 2, batch C: S3-01 (records and personal bests), S2-01 (first-run tips) and S4-01 (the town's voices).
import { emptyStats, cleanStats, applyGame, applyDaily } from '../src/js/stats.js';
import { BARKS, BIG_PLAY, barkFor, endBark } from '../src/js/voices.js';
import { PERSONAS } from '../src/js/personas.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const SET = 'hs-letters-settings-v1', STATS = 'hs-letters-stats-v1', SAVE = 'hs-letters-save-v1';
const ls = (t, k) => t.page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), k);
const put = (t, k, v) => t.page.evaluate(([key, val]) => localStorage.setItem(key, JSON.stringify(val)), [k, v]);
const words = (s) => s.trim().split(/\s+/).length;
const withTips = () => { window.__TEST_TIPS__ = true; };
// a profile that already has a settings key (a pre-wave player): written once, never over a later change
const oldProfile = () => { window.__TEST_TIPS__ = true; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ sound: true, vol: 0.35, ai: 'instant' })); };
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };

// a finished game: the human (seat 0) with `me` points against the given computer seats
const finished = (me, bots, extra = {}) => {
  const { hints = 1, ...game } = extra;   // hints left to the person: one of three (two taken) unless a test says otherwise
  const players = [{ kind: 'human', name: 'You', score: me, best: { word: 'QUARTZ', score: 54 }, hints }, ...bots.map((b) => ({ kind: 'ai', name: b.persona, persona: b.persona, level: b.level, score: b.score, best: null, hints: null }))];
  const top = Math.max(...players.map((p) => p.score));
  return {
    mode: 'play', players, seed: 12345, rng: { bag: 1, ai: 2 }, over: true, featured: [{ word: 'SPRING', by: 0 }, { word: 'TUB', by: 1 }, { word: 'ROW', by: null }],
    log: [
      { p: 0, kind: 'play', n: 0, score: 22, full: 0, words: [{ w: 'QUARTZ', score: 22, bonus: 0 }] },
      { p: 0, kind: 'play', n: 2, score: 91, full: 40, words: [{ w: 'SPRING', score: 30, bonus: 10, themed: 'spring' }, { w: 'IN', score: 3, bonus: 0 }] },
      { p: 1, kind: 'play', n: 1, score: 70, full: 0, words: [{ w: 'TUBS', score: 70, bonus: 0 }] },
      { p: 0, kind: 'end' },
    ],
    result: { why: 'out', out: 0, adjust: [0, 0], winners: players.map((p, k) => (p.score === top ? k : -1)).filter((k) => k >= 0) },
    ...game,
  };
};

// play a game to its end as a person would: the best scoring play each turn, a pass when nothing fits
async function playOut(t, max = 120) {
  for (let n = 0; n < max; n++) {
    const s = (await t.state()).game;
    if (s.over) return s;
    if (s.players[s.cur].kind !== 'human') { await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.over || g.game.players[g.game.cur].kind === 'human'; }, null, { timeout: 20000 }); continue; }
    const mv = await t.game('act', 'moves', 1);
    if (mv && mv.length) {
      const st = await t.game('act', 'stage', mv[0].tiles);
      const r = st.ok ? await t.game('act', 'play') : { ok: false };
      if (!r.ok) { await t.game('act', 'recall'); await t.game('act', 'pass'); }
    } else await t.game('act', 'pass');
    await t.page.waitForTimeout(60);
  }
  return (await t.state()).game;
}

export const tests = [
  // ---------- S3-01 records: the data ----------
  {
    name: 'S3-01 a finished game is folded into the record: wins, bests, opponent rows, Full Soaks and Featured Springs (S3-06: played without a hint)', node: true,
    async run(t) {
      const g1 = finished(300, [{ persona: 'opal', level: 'easy', score: 200 }], { hints: 3 });
      const r1 = applyGame(emptyStats(), g1);
      const a = r1.stats;
      t.equal(a.games, 1, 'one game'); t.equal(a.wins, 1, 'one win'); t.equal(a.bestScore, 300, 'best score'); t.equal(a.totalScore, 300, 'total score');
      t.equal(a.bestPlay.score, 91, 'best turn is the 91-point play'); t.equal(a.bestPlay.word, 'SPRING', 'with its first word');
      t.equal(a.bestWord.word, 'QUARTZ', 'best word is the player\'s own best'); t.equal(a.bestWord.score, 54, 'with its points');
      t.equal(a.fullSoaks, 1, 'one Full Soak'); t.equal(a.themed, 1, 'one Hot Springs word'); t.equal(a.featured, 1, 'one Featured Spring was the player\'s');
      t.equal(a.hints, 0, 'no hint was taken'); t.equal(a.streak, 1, 'a one-game win streak');
      t.equal(JSON.stringify(a.opp['opal:easy']), JSON.stringify({ games: 1, wins: 1, best: 300, total: 300 }), 'a row for Opal on Easy');
      t.expect(r1.pb.first && !r1.pb.score, 'the first game is "first", not a personal best');
      const g2 = finished(320, [{ persona: 'opal', level: 'easy', score: 400 }, { persona: 'lucky', level: 'hard', score: 100 }], { hints: 3 });
      const r2 = applyGame(a, g2);
      t.equal(r2.stats.games, 2, 'two games'); t.equal(r2.stats.wins, 1, 'a loss does not add a win'); t.equal(r2.stats.streak, 0, 'a loss ends the streak'); t.equal(r2.stats.bestStreak, 1, 'the best streak stays');
      t.expect(r2.pb.score, 'a higher score is a personal best'); t.expect(!r2.pb.play && !r2.pb.word, 'the same best play and word are not new');
      t.equal(r2.stats.opp['opal:easy'].games, 2, 'Opal on Easy now has two games'); t.equal(r2.stats.opp['opal:easy'].wins, 1, 'one of them won');
      t.equal(r2.stats.opp['lucky:hard'].wins, 1, 'beating a lower-scoring opponent counts even when another seat won');
      t.equal(r2.stats.bestScore, 320, 'best score raised');
      const lower = applyGame(r2.stats, finished(10, [{ persona: 'opal', level: 'easy', score: 50 }], { hints: 3 })).stats;
      t.equal(lower.bestScore, 320, 'a worse game never lowers a best'); t.equal(lower.games, 3, 'but it is counted');
    },
  },
  {
    name: 'S3-01 games without exactly one person against the computer are left out; a damaged record is read field by field', node: true,
    async run(t) {
      const two = finished(300, [{ persona: 'opal', level: 'easy', score: 200 }]); two.players[1].kind = 'human';
      t.equal(applyGame(emptyStats(), two).pb, null, 'two people: not counted');
      const watch = finished(300, [{ persona: 'opal', level: 'easy', score: 200 }]); watch.players[0].kind = 'ai';
      t.equal(applyGame(emptyStats(), watch).pb, null, 'computers only: not counted');
      const daily = finished(300, [{ persona: 'opal', level: 'easy', score: 200 }]); daily.mode = 'daily';
      t.equal(applyGame(emptyStats(), daily).pb, null, 'the Daily Soak has its own line');
      const c = cleanStats({ v: 1, games: 'x', wins: 3, bestScore: -5, bestWord: { word: 5, score: 4 }, opp: { 'opal:easy': { games: 2, wins: 'q', best: 80, total: 150 }, 'bad key': { games: 9 } }, daily: { games: 4, best: 'z' }, extra: 1 });
      t.equal(c.games, 0, 'a text count becomes zero'); t.equal(c.wins, 3, 'the good field survives'); t.equal(c.bestScore, 0, 'a negative best becomes zero'); t.equal(c.bestWord, null, 'a malformed best is dropped');
      t.equal(c.opp['opal:easy'].best, 80, 'a good opponent field survives'); t.equal(c.opp['opal:easy'].wins, 0, 'its damaged field becomes zero'); t.expect(!c.opp['bad key'], 'an odd key is dropped');
      t.equal(c.daily.games, 4, 'daily games survive'); t.equal(c.daily.best, 0, 'a damaged daily best becomes zero'); t.expect(!('extra' in c), 'unknown fields are not carried');
      t.equal(JSON.stringify(cleanStats(null)), JSON.stringify(emptyStats()), 'null is an empty record'); t.equal(JSON.stringify(cleanStats([1])), JSON.stringify(emptyStats()), 'an array is an empty record');
      const d = applyDaily(emptyStats(), 140, 3); t.equal(d.daily.games, 1, 'a daily game'); t.equal(d.daily.best, 140, 'its best'); t.equal(d.daily.bestStreak, 3, 'its streak');
      t.equal(applyDaily(d, 90, 1).daily.best, 140, 'a lower daily never lowers the best');
    },
  },

  // ---------- S3-01 records: in the game ----------
  {
    name: 'S3-01 a game played to the end is written to the record, shown on the results screen and on the Records sheet, and survives a reload',
    initScript: instant,
    async run(t) {
      await ready(t);
      t.expect(await ls(t, STATS) === null, 'a new profile has no record yet');
      await put(t, STATS, { v: 1, games: 1, wins: 0, bestScore: 5, totalScore: 5, bestWord: { word: 'AT', score: 3 }, bestPlay: { word: 'AT', score: 3 }, opp: { 'opal:easy': { games: 1, wins: 0, best: 5, total: 5 } } });
      await t.seed(31);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      const s = await playOut(t);
      t.expect(s.over, 'the game finished');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      const rec = await ls(t, STATS);
      t.equal(rec.games, 2, 'the game was counted once, after the old one');
      t.expect(rec.bestScore >= s.players[0].score, 'the best score is at least this score');
      t.expect(rec.opp['opal:easy'].games === 2, 'Opal on Easy has two games');
      const over = await t.page.textContent('.sheet.over');
      t.expect(/New personal best/.test(over), 'the results screen says "New personal best"');
      t.expect(await t.page.locator('.over .pbs li').count() >= 1, 'as a chip');
      await t.shot('S3-01-results');
      await t.game('scene', 'title');
      await t.page.click('[data-go="records"]');
      const html = await t.page.textContent('.sheet.records');
      t.expect(/Games against the town/.test(html) && /By opponent/.test(html) && /Daily Soak/.test(html), 'the Records sheet has its three parts');
      t.expect(/Opal Vance/.test(html), 'and the opponent row');
      await t.shot('S3-01-records');
      await t.checkLayout({ allowScrollY: true });
      await t.reload(); await ready(t); await t.waitIdle();
      await t.page.click('[data-go="records"]');
      t.equal((await ls(t, STATS)).games, 2, 'the record survives a reload');
      t.expect(/2 games/.test(await t.page.textContent('.sheet.records')) || (await t.page.textContent('.sheet.records .stat b')) === '2', 'and shows two games');
    },
  },
  {
    name: 'S3-01 a game finishes once: leaving the results for the title is not undone, and the game is counted once',
    viewports: ['desktop'],
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(31);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      const s = await playOut(t);   // plays faster than the tiles land, so several start-of-turn timers are pending at the end
      t.expect(s.over, 'the game finished');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      await t.game('scene', 'title');
      await t.page.waitForTimeout(1600);   // longer than the 900 ms the results screen waits, plus the longest landing
      t.equal((await t.state()).scene, 'title', 'still on the title: the results screen did not come back');
      t.equal((await ls(t, STATS)).games, 1, 'and the game was counted once');
    },
  },
  {
    name: 'S3-01 the Records sheet fits both viewports with a full record, and an empty one explains itself',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('scene', 'title');
      await t.page.click('[data-go="records"]');
      t.expect(/No games on the record yet/.test(await t.page.textContent('.sheet.records')), 'an empty record says so');
      await t.page.click('[data-back]');
      const row = (g, w, b) => ({ games: g, wins: w, best: b, total: b * g });
      await put(t, STATS, { v: 1, games: 23, wins: 14, ties: 1, totalScore: 7480, bestScore: 512, bestWord: { word: 'JUXTAPOSE', score: 96 }, bestPlay: { word: 'MAGNOLIA', score: 131 }, fullSoaks: 4, featured: 9, themed: 37, hints: 11, streak: 2, bestStreak: 5,
        opp: { 'opal:easy': row(6, 6, 402), 'hollis:medium': row(7, 5, 430), 'lucky:medium': row(4, 2, 512), 'julian:hard': row(6, 1, 377) }, daily: { games: 12, best: 301, bestStreak: 6 } });
      await t.game('scene', 'title');
      await t.page.click('[data-go="records"]');
      await t.waitForStable();
      const text = await t.page.textContent('.sheet.records');
      t.expect(/61%/.test(text), 'the win rate is shown (14 of 23)'); t.expect(/325/.test(text), 'the average is shown (7480 / 23)');
      t.expect(/JUXTAPOSE/.test(text) && /MAGNOLIA/.test(text), 'the best word and best turn are shown');
      t.expect((await t.page.locator('.opp-table tbody tr').count()) === 4, 'four opponent rows');
      await t.shot('S3-01-records-full');
      await t.game('scene', 'title');
      await t.shot('S3-01-title');
      await t.checkLayout({ allowScrollY: true });
      const wide = await t.page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      t.expect(wide <= 0, 'no sideways scroll');
      const small = await t.page.evaluate(() => [...document.querySelectorAll('.sheet.records button')].filter((b) => b.getBoundingClientRect().height < 44).length);
      t.equal(small, 0, 'every control is at least 44 px tall');
    },
  },
  {
    name: 'S3-01 a pre-wave profile loads with no record and nothing lost, a damaged record reads field by field, a record from the title shows the totals',
    viewports: ['desktop'], initScript: oldProfile,
    async run(t) {
      await ready(t);
      await put(t, 'hs-letters-register-v1', { SPRING: { id: 'spring', first: '2026-11-01', count: 3, best: 40 } });
      await put(t, 'hs-letters-daily-v1', { days: { '2026-11-10': { score: 120, plays: 1 } }, streak: 1, last: '2026-11-10' });
      await t.reload(); await ready(t); await t.waitIdle();
      const st = await t.state();
      t.expect(await ls(t, STATS) === null, 'a pre-wave profile has no record until it finishes a game');
      t.expect((await ls(t, 'hs-letters-register-v1')).SPRING.count === 3, 'its register is untouched');
      await t.page.click('[data-go="records"]');
      let text = await t.page.textContent('.sheet.records');
      t.expect(/1\s*days played|days played/.test(text), 'the daily history it already had is counted');
      t.expect(/1 of \d+ Hot Springs words found/.test(text), 'and the register');
      await t.page.click('[data-back]');
      await put(t, STATS, { v: 1, games: 'many', wins: 4, bestScore: 77, opp: 7 });
      await t.reload(); await ready(t); await t.waitIdle();
      await t.page.click('[data-go="records"]');
      text = await t.page.textContent('.sheet.records .stats');
      t.expect(/77/.test(text) && /4/.test(text), 'good fields of a damaged record still show');
      t.equal(st.scene, 'title', 'the game booted to the title');
    },
  },
  {
    name: 'S3-01 a Daily Soak is counted in the record',
    viewports: ['desktop'], initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('newGame', { mode: 'daily', date: '2026-11-12' });
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      const s = await playOut(t);
      t.expect(s.over, 'the daily finished');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      const rec = await ls(t, STATS);
      t.equal(rec.daily.games, 1, 'one daily game'); t.expect(rec.daily.best > 0, 'with its score'); t.equal(rec.games, 0, 'and no game against the town');
    },
  },

  // ---------- S2-01 first-run tips ----------
  {
    name: 'S2-01 a newcomer gets four short tips in turn, each pointed at what it names, and a Skip control the whole time',
    initScript: withTips,
    async run(t) {
      await ready(t);
      t.equal((await t.state()).settings.tipsSeen, false, 'a new profile has not seen the tips');
      await t.seed(7);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitForStable();
      const card = t.page.locator('#coach .coach-card');
      t.expect(await card.isVisible(), 'the first tip shows on the first turn');
      const first = await t.page.textContent('#coach p');
      t.expect(words(first) <= 12, `tip one is ${words(first)} words: ${first}`);
      t.expect(/centre/i.test(first) && /Score the most/.test(first), 'it names the goal and the centre square');
      t.expect(await t.page.locator('#boardwrap.coach-target').count() === 1, 'the board is marked');
      t.expect(await t.page.locator('#coach [data-coach="skip"]').isVisible(), 'Skip tips is visible');
      t.expect((await t.page.locator('#live').textContent()).includes('Tip:'), 'the tip is announced');
      await t.shot('S2-01-tip-start');
      // stage a tile: the second tip points at Play
      const mv = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv[0].tiles);
      await t.waitForStable();
      const second = await t.page.textContent('#coach p');
      t.expect(/Play|Enter/.test(second) && words(second) <= 12, `tip two names Play: ${second}`);
      t.expect(await t.page.locator('#actions .play.coach-target').count() === 1, 'the Play button is marked');
      await t.shot('S2-01-tip-play');
      // play it: the AI answers, then tip three comes on the next turn
      await t.game('act', 'play');
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking; }, null, { timeout: 20000 });
      await t.waitForStable(400);
      const third = await t.page.textContent('#coach p');
      t.expect(/discs/i.test(third) && words(third) <= 12, `tip three is about the discs: ${third}`);
      await t.shot('S2-01-tip-discs');
      await t.page.click('#coach [data-coach="got"]');
      const fourth = await t.page.textContent('#coach p');
      t.expect(/Plaques/.test(fourth) && words(fourth) <= 12, `tip four is about the plaques: ${fourth}`);
      t.expect(await t.page.locator('#springs.coach-target').count() === 1, 'the plaques are marked');
      await t.shot('S2-01-tip-plaques');
      await t.checkLayout({ allowScrollY: true });
      await t.page.click('#coach [data-coach="got"]');
      t.expect(await t.page.locator('#coach .coach-card').count() === 0, 'Got it on the last tip ends them');
      t.equal((await ls(t, SET)).tipsSeen, true, 'and the flag is saved');
    },
  },
  {
    name: 'S2-01 tips never cover the board, the scores, the rack or the controls, at both sizes',
    initScript: withTips,
    async run(t) {
      await ready(t);
      await t.game('newGame', {});
      await t.waitForStable();
      const overlap = await t.page.evaluate(() => {
        const c = document.querySelector('#coach .coach-card').getBoundingClientRect();
        const hit = (sel) => [...document.querySelectorAll(sel)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && !(r.right <= c.left || r.left >= c.right || r.bottom <= c.top || r.top >= c.bottom); }).length;
        return { board: hit('#boardwrap'), rack: hit('#rackbar'), actions: hit('#actions'), scores: hit('#scores, #turnline'), springs: hit('#springs'), inside: c.left >= 0 && c.right <= innerWidth + 1 };
      });
      t.equal(overlap.board + overlap.rack + overlap.actions + overlap.scores + overlap.springs, 0, `the tip card overlaps none of the board, rack, controls, scores or plaques (${JSON.stringify(overlap)})`);
      t.expect(overlap.inside, 'and sits inside the screen');
      const small = await t.page.evaluate(() => [...document.querySelectorAll('#coach button')].filter((b) => b.getBoundingClientRect().height < 44).length);
      t.equal(small, 0, 'its buttons are at least 44 px tall');
      const ok = await t.contrastReport({ selector: '#coach', min: 4.5, largeMin: 3 });
      t.equal(ok.fails.length, 0, `its text is readable (${JSON.stringify(ok.fails)})`);
      await t.page.click('#coach [data-coach="skip"]');
      t.equal((await ls(t, SET)).tipsSeen, true, 'Skip tips saves the flag');
      t.expect(await t.page.locator('#coach .coach-card').count() === 0, 'and the card goes');
    },
  },
  {
    name: 'S2-01 the words follow the input: a key press brings the keyboard wording, a touch brings the touch wording',
    initScript: withTips,
    async run(t) {
      await ready(t);
      await t.game('newGame', {});
      await t.waitForStable();
      const mv = await t.game('act', 'moves', 1);
      if (t.viewport === 'mobile') await t.page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })));
      else await t.page.keyboard.press('ArrowRight');
      await t.page.keyboard.press(t.viewport === 'mobile' ? 'ArrowRight' : 'ArrowLeft');
      await t.game('act', 'stage', mv[0].tiles);
      await t.waitForStable();
      const s = await t.page.textContent('#coach p');
      if (t.viewport === 'mobile') t.expect(/Tap Play/.test(s) || /Press Enter/.test(s), `a phone sees: ${s}`);
      else t.expect(/Press Enter/.test(s), `after a key press the tip says Enter: ${s}`);
      await t.page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'touch', bubbles: true })));
      await t.game('act', 'recall'); await t.game('act', 'stage', mv[0].tiles);
      await t.waitForStable();
      t.expect(/Tap Play/.test(await t.page.textContent('#coach p')), 'after a touch it says Tap Play');
      await t.page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerdown', { pointerType: 'mouse', bubbles: true })));
      await t.game('act', 'recall'); await t.game('act', 'stage', mv[0].tiles);
      await t.waitForStable();
      t.expect(/Click Play/.test(await t.page.textContent('#coach p')), 'after a mouse click it says Click Play');
    },
  },
  {
    name: 'S2-01 a player with an existing save sees no tips, and Settings brings them back',
    initScript: oldProfile, viewports: ['desktop'],
    async run(t) {
      await ready(t);
      t.equal((await t.state()).settings.tipsSeen, true, 'a profile with settings is not a newcomer');
      await t.game('newGame', {});
      await t.waitForStable();
      t.expect(await t.page.locator('#coach .coach-card').count() === 0, 'no tip in the game');
      await t.game('scene', 'settings');
      await t.shot('S2-01-settings');
      await t.page.click('[data-tips]');
      t.equal((await ls(t, SET)).tipsSeen, false, 'Show tips again clears the flag');
      await t.game('scene', 'game');
      await t.waitForStable();
      t.expect(await t.page.locator('#coach .coach-card').isVisible(), 'and the tip shows in the game in progress');
      await t.reload(); await ready(t); await t.waitIdle();
      t.equal((await t.state()).settings.tipsSeen, false, 'the request survives a reload');
    },
  },
  {
    name: 'S2-01 tips are not shown to a profile that holds only a game save, and a tab closed mid-tips is still a newcomer next time',
    viewports: ['desktop'], initScript: withTips,
    async run(t) {
      await ready(t);
      t.equal((await t.state()).settings.tipsSeen, false, 'a clean profile is a newcomer');
      await t.game('newGame', {});
      await t.waitForStable();
      t.equal((await ls(t, SET)).tipsSeen, false, 'the newcomer flag is written when the first game starts');
      await t.reload(); await ready(t); await t.waitIdle();
      t.equal((await t.state()).settings.tipsSeen, false, 'a reload mid-tips is still a newcomer');
      const sv = await ls(t, SAVE);
      await t.page.evaluate(() => localStorage.removeItem('hs-letters-settings-v1'));
      await t.reload(); await ready(t); await t.waitIdle();
      t.equal((await t.state()).settings.tipsSeen, true, `with a game save and no settings, the profile counts as existing (${sv ? 'save found' : 'no save'})`);
    },
  },
  {
    name: 'S2-01 a pre-wave saved game (no settings, no record) resumes with no tips and the characters in place',
    viewports: ['desktop'], initScript: withTips,
    async run(t) {
      await ready(t);
      const fixture = await t.page.evaluate(() => fetch('test-fixtures/save-v1-earned-play.json').then((r) => r.text()));
      await t.page.evaluate(([k, raw]) => { localStorage.removeItem('hs-letters-settings-v1'); localStorage.setItem(k, raw); }, [SAVE, fixture]);
      await t.reload(); await ready(t); await t.waitIdle();
      t.equal((await t.state()).settings.tipsSeen, true, 'a profile holding a saved game is not a newcomer');
      await t.page.click('[data-go="continue"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.waitForStable();
      t.expect(await t.page.locator('#coach .coach-card').count() === 0, 'no tip over the resumed game');
      t.expect((await t.state()).game.log.length > 0, 'the game and its log came back');
      t.expect(await ls(t, STATS) === null, 'no record is invented for it');
    },
  },
  {
    name: 'S2-01 reduced motion stops the pulse and leaves a static marker',
    viewports: ['desktop'], initScript: withTips, reducedMotion: true,
    async run(t) {
      await ready(t);
      await t.game('newGame', {});
      await t.waitForStable();
      // W2-S5-01 replaced the coarse #boardwrap.coach-target::after full-frame inset border with the static
      // H8 spotlight halo; verify #boardwrap does not pulse, and staging a tile leaves a static .coach-target
      // outline on #actions .play with animationName === 'none'.
      const boardAnim = await t.page.evaluate(() => getComputedStyle(document.querySelector('#boardwrap')).animationName);
      t.equal(boardAnim, 'none', 'no animation on the board target');
      const mv = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv[0].tiles);
      await t.waitForStable();
      const playMark = await t.page.evaluate(() => {
        const b = document.querySelector('#actions .play.coach-target');
        const cs = b && getComputedStyle(b);
        return cs ? [cs.animationName, cs.outlineStyle] : ['missing', 'none'];
      });
      t.equal(playMark[0], 'none', 'no animation on the Play coach marker');
      t.expect(playMark[1] !== 'none', `the static marker is still drawn (${playMark[1]})`);
    },
  },
  {
    name: 'S2-01 the goal is on the setup sheet and at the top of Help, Help has a worked example, and Setup has a How to play button',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('scene', 'setup');
      const setup = await t.page.textContent('.sheet.setup');
      t.expect(/The goal:/.test(setup), 'the setup sheet states the goal');
      await t.shot('S2-01-setup');
      await t.page.click('.sheet.setup [data-go="help"]');
      t.equal((await t.state()).scene, 'help', 'How to play opens Help');
      const first = await t.page.textContent('.help-body > *:first-child');
      t.expect(/The goal:/.test(first), 'Help starts with the goal');
      const eg = await t.page.textContent('.example');
      t.expect(/FIND scores 4 \+ 2 \+ 2 \+ 2 = 10/.test(eg) && /20 points/.test(eg), `the worked example adds up (${eg.slice(0, 120)})`);
      t.expect(await t.page.locator('.example .eg-cell').count() === 4, 'drawn as four squares');
      await t.page.locator('.example').scrollIntoViewIfNeeded();
      await t.shot('S2-01-help-example');
      await t.checkLayout({ allowScrollY: true });
      await t.page.click('[data-back]');
      t.equal((await t.state()).scene, 'setup', 'back returns to Setup');
    },
  },
  {
    name: 'S2-01 every tip is twelve words or fewer', node: true,
    async run(t) {
      const fs = await import('node:fs');
      const src = fs.readFileSync(new URL('../src/js/main.js', import.meta.url), 'utf8');
      const block = src.slice(src.indexOf('function coachTip()'), src.indexOf('function coachRender()'));
      const lines = [...block.matchAll(/'([^']{12,})'|`([^`]{12,})`/g)].map((m) => (m[1] || m[2]).replace('${FEATURED_BONUS}', '30'));
      t.expect(lines.length >= 7, `found the tip lines (${lines.length})`);
      for (const l of lines) if (/ /.test(l) && !/^#/.test(l)) t.expect(words(l) <= 12, `"${l}" is ${words(l)} words`);
    },
  },

  // ---------- S4-01 the town's voices ----------
  {
    name: 'S4-01 every character has six lines for each of eight moments, short, distinct and clean', node: true,
    async run(t) {
      const moments = ['open', 'big', 'soak', 'themed', 'pass', 'out', 'win', 'lose'];
      for (const p of PERSONAS) {
        t.expect(!!BARKS[p.id], `${p.id} has a table`);
        for (const m of moments) {
          const list = BARKS[p.id][m];
          t.equal(list.length, 6, `${p.id} ${m}: six lines`);
          t.equal(new Set(list).size, 6, `${p.id} ${m}: six different lines`);
          for (const l of list) {
            t.expect(words(l) <= 12 && l.length <= 60, `${p.id} ${m} "${l}" is short`);
            t.expect(/^[A-Z"]/.test(l) && /[.!?]$/.test(l) && !/\s{2}|\s[.,!?]/.test(l), `${p.id} ${m} "${l}" is written like a sentence`);
          }
        }
      }
      const all = PERSONAS.flatMap((p) => moments.flatMap((m) => BARKS[p.id][m]));
      t.equal(new Set(all).size, all.length, 'no line is used twice across the cast');
      t.expect(BARKS.lucky.open.some((l) => /Boiling Springs/.test(l)), 'Lucky talks about the Boiling Springs');
      t.expect(BARKS.opal.big.some((l) => /soak|towel|tub/i.test(l)), 'Opal talks about towels and tubs');
      t.expect(BARKS.julian.pass.some((l) => /rest|tempo|bar/i.test(l)), 'Julian talks tempo');
    },
  },
  {
    name: 'S4-01 the line follows the move: Full Soak, Hot Springs word, big play, pass, going out, then the opening; none for a plain play', node: true,
    async run(t) {
      const mk = (log, over = {}) => ({ seed: 4242, rng: { bag: 9, ai: 9 }, over: false, result: null, players: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky', name: 'Lucky' }], log, ...over });
      const play = (o) => ({ p: 1, kind: 'play', n: 1, score: 12, full: 0, words: [], themed: 0, featured: null, ...o });
      const ev = (e, over) => { const s = mk([{ p: 0, kind: 'play', n: 0, score: 8, words: [] }, e, ...(over ? [{ kind: 'end' }] : [])], over ? { over: true, result: { why: 'out', out: 1, adjust: [0, 0], winners: [1] } } : {}); return barkFor(s, e); };
      t.equal(ev(play({ full: 40 })).event, 'soak', 'a Full Soak');
      t.equal(ev(play({ themed: 10 })).event, 'themed', 'a Hot Springs word');
      t.equal(ev(play({ featured: 'SPRING' })).event, 'themed', 'a Featured Spring');
      t.equal(ev(play({ score: BIG_PLAY + 1 })).event, 'big', 'a play over 30');
      t.equal(ev(play({ score: BIG_PLAY })).event, 'open', 'a plain play on its first turn is the opening line');
      t.equal(ev({ p: 1, kind: 'pass', n: 1 }).event, 'pass', 'a pass');
      t.equal(ev({ p: 1, kind: 'swap', n: 1, count: 3 }).event, 'pass', 'a swap');
      t.equal(ev(play({ score: 20 }), true).event, 'out', 'going out');
      const later = mk([{ p: 1, kind: 'play', n: 1, score: 9, words: [] }, { p: 0, kind: 'play', n: 2, score: 8, words: [] }, { p: 1, kind: 'play', n: 3, score: 9, full: 0, words: [] }]);
      t.equal(barkFor(later, later.log[2]), null, 'a plain play after the first turn says nothing');
      t.equal(barkFor({ ...later, players: [{ kind: 'human' }, { kind: 'ai', persona: null }] }, later.log[2]), null, 'a seat with no character says nothing');
      // determinism and no early repeats
      const a = ev(play({ score: 40 })), b = ev(play({ score: 40 }));
      t.equal(a.text, b.text, 'the same game and move give the same line');
      const heard = [];
      let log = [{ p: 0, kind: 'play', n: 0, score: 8, words: [] }];
      for (let k = 0; k < 6; k++) { const e = play({ n: 1 + k * 2, score: 40 + k }); log = [...log, e]; heard.push(barkFor(mk(log), e).text); log = [...log, { p: 0, kind: 'play', n: 2 + k * 2, score: 8, words: [] }]; }
      t.equal(new Set(heard).size, 6, `six big plays in a row use six different lines (${heard.length})`);
      const other = barkFor(mk([{ p: 0, kind: 'play', n: 0, score: 8, words: [] }, play({ score: 40 })], { seed: 999 }), play({ score: 40 }));
      t.expect(!!other && typeof other.text === 'string', 'another seed gives a line too');
      const done = mk([], { over: true, result: { why: 'out', out: 1, adjust: [0, 0], winners: [1] } });
      t.equal(endBark(done, 1).event, 'win', 'the winner says a winning line');
      t.equal(endBark({ ...done, result: { ...done.result, winners: [0] } }, 1).event, 'lose', 'a loser says a losing line');
      t.equal(endBark(done, 0), null, 'a person says nothing');
    },
  },
  {
    name: 'S4-01 in play the computer\'s turn shows its line in the strip while the live region stays plain',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(11);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'lucky', level: 'medium' }] });
      await t.waitForStable();
      const mv = await t.game('act', 'moves', 1);
      await t.game('act', 'stage', mv[0].tiles);
      await t.game('act', 'play');
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.log.length >= 2 && !g.aiThinking && g.game.players[g.game.cur].kind === 'human'; }, null, { timeout: 20000 });
      await t.waitForStable(300);
      const line = await t.page.textContent('#preview .bark');
      const open = BARKS.lucky.open.concat(BARKS.lucky.big, BARKS.lucky.soak, BARKS.lucky.themed, BARKS.lucky.pass, BARKS.lucky.out);
      t.expect(open.some((l) => line.includes(l)), `the strip carries one of Lucky's lines: ${line}`);
      t.expect(/^Lucky:/.test(line), 'with his name');
      const said = await t.page.textContent('#preview .said');
      t.expect(/Delmar played|passed|swapped/.test(said), `and the plain account beneath: ${said}`);
      const live = await t.page.locator('#live').textContent();
      t.expect(/played|passed|swapped/.test(live) && !live.includes('“') && !open.some((l) => live.includes(l)), `the live region has only the plain account: ${live}`);
      const st = await t.state();
      t.expect(!/“/.test(st.lastLine || ''), 'lastLine stays plain');
      await t.page.waitForFunction(() => !document.querySelector('#toast.on'), null, { timeout: 9000 });
      await t.shot('S4-01-strip');
      // the next human action replaces it
      await t.game('act', 'stage', (await t.game('act', 'moves', 1))[0].tiles);
      t.expect(await t.page.locator('#preview .bark').count() === 0, 'the strip goes back to the preview while the player builds a word');
    },
  },
  {
    name: 'S4-01 the results screen has each computer player\'s winning or losing line',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.seed(21);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'julian', level: 'hard' }] });
      const s = await playOut(t);
      await t.page.waitForFunction(() => window.__game.getState().scene === 'over', null, { timeout: 8000 });
      const win = s.result.winners.includes(1), list = BARKS.julian[win ? 'win' : 'lose'];
      const line = await t.page.textContent('.sheet.over .bark');
      t.expect(list.some((l) => line.includes(l)), `Julian says one of his ${win ? 'winning' : 'losing'} lines: ${line}`);
      await t.shot('S4-01-results');
    },
  },
  {
    name: 'S4-01 a Full Soak by a computer shows its own line and portrait in the toast, and fits both viewports',
    initScript: instant,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
      await t.waitForStable();
      const line = BARKS.opal.soak[2];
      await t.game('act', 'toast', { kind: 'soak', who: { p: { name: 'Opal Vance', persona: 'opal' }, k: 1 }, title: 'Full Soak! +40', sub: `“${line}”` });
      await t.page.waitForSelector('#toast.on');
      await t.waitForAnimations();
      const txt = await t.page.textContent('#toast');
      t.expect(txt.includes(line), 'the toast carries the line');
      t.expect(await t.page.locator('#toast .badge').count() === 1, 'with the character\'s badge');
      await t.shot('S4-01-toast');
      const clipped = await t.page.evaluate(() => { const b = document.querySelector('#toast button').getBoundingClientRect(); return b.right > innerWidth || b.left < 0; });
      t.expect(!clipped, 'the toast is inside the screen');
    },
  },
];
