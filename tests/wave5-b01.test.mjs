// Wave 5, batch W5-B01:
// - W6-P-N01: Challenge Mode live preview hides Hot Springs dictionary validity, bonuses, category reveals, and hidden Featured Springs until Play is committed.
import { ctx } from './lib.mjs';
import { createGame, evaluate, apply } from '../src/js/engine.js';
import { CENTER, FULL_SOAK, FEATURED_BONUS, ROW_BONUS, VALUE } from '../src/js/score.js';

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => {
  window.__TEST_TIPS__ = false;
  if (!localStorage.getItem('hs-letters-settings-v1')) {
    localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false }));
  }
};
const across = (word, at = CENTER - 1) => [...word].map((l, k) => ({ i: at + k, l }));
const baseSum = (word) => [...word].reduce((a, l) => a + VALUE[l], 0);

export const tests = [
  // ---------- W6-P-N01 ----------
  {
    name: 'W6-P-N01 evaluate() with skipDict hides Hot Springs, Bathhouse Row, and Featured Spring bonuses while preserving base + Full Soak scores and full commit scoring (Node)',
    node: true,
    async run(t) {
      const c = await ctx();
      const seats = [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }];
      const s = createGame({ mode: 'play', seats, seed: 7, challenge: true }, c.lex);
      s.featured = [
        { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'oaklawn', word: 'OAKLAWN', cat: 'track', shown: [0], by: null, at: null },
      ];
      s.players[0].rack = 'SPASXYZ'.split('');

      const spasTiles = across('SPAS', CENTER - 1);
      const pvSpas = evaluate(s, spasTiles, { ...c, skipDict: true });
      const realSpas = evaluate(s, spasTiles, c);
      t.equal(pvSpas.ok, true, 'SPAS preview evaluates cleanly under skipDict');
      t.equal(pvSpas.score, baseSum('SPAS'), `skipDict SPAS scores base letters only (${pvSpas.score} === ${baseSum('SPAS')})`);
      t.equal(pvSpas.themed, 0, 'skipDict SPAS hides Hot Springs themed bonus');
      t.equal(pvSpas.words[0].themed, null, 'skipDict SPAS hides word.themed entry id');
      t.equal(pvSpas.words[0].bonus, 0, 'skipDict SPAS hides word.bonus');
      t.equal(pvSpas.words[0].bath, false, 'skipDict SPAS hides word.bath');
      t.expect(realSpas.themed > 0 && realSpas.score > pvSpas.score, `full evaluate awards Hot Springs bonus (${realSpas.score} > ${pvSpas.score})`);

      // Unclaimed Featured Spring (STEAM): skipDict hides both Hot Springs and Featured +30
      s.players[0].rack = 'STEAMXQ'.split('');
      const steamTiles = across('STEAM', CENTER - 2);
      const pvSteam = evaluate(s, steamTiles, { ...c, skipDict: true });
      const realSteam = evaluate(s, steamTiles, c);
      t.equal(pvSteam.score, baseSum('STEAM'), `skipDict STEAM scores base letters only (${pvSteam.score})`);
      t.equal(pvSteam.themed, 0, 'skipDict STEAM hides themed bonus');
      t.equal(pvSteam.featured, null, 'skipDict STEAM hides featured word');
      t.equal(pvSteam.featuredAll.length, 0, 'skipDict STEAM hides featuredAll');
      t.equal(pvSteam.featuredBonus, 0, 'skipDict STEAM hides featuredBonus');
      t.equal(realSteam.featured, 'STEAM', 'full evaluate identifies Featured Spring STEAM');
      t.equal(realSteam.featuredBonus, FEATURED_BONUS, 'full evaluate awards +30 Featured bonus');

      // 7-tile play (Full Soak) still counts +40 Full Soak under skipDict while hiding themed/featured
      s.players[0].rack = 'SPRINGS'.split('');
      const soakTiles = across('SPRINGS', CENTER - 3);
      const pvSoak = evaluate(s, soakTiles, { ...c, skipDict: true });
      t.equal(pvSoak.full, FULL_SOAK, 'skipDict preserves Full Soak +40');
      t.equal(pvSoak.themed, 0, 'skipDict still hides themed bonus on 7-tile Hot Springs word');
      t.equal(pvSoak.score, baseSum('SPRINGS') + FULL_SOAK, 'skipDict 7-tile score equals base + Full Soak only');

      // Committing STEAM via apply() in Challenge mode awards the full score and claims the Featured Spring
      s.players[0].rack = 'STEAMXQ'.split('');
      const applied = apply(s, { type: 'play', tiles: steamTiles }, c);
      t.equal(applied.ok, true, 'Challenge commit succeeds for STEAM');
      t.equal(applied.entry.score, realSteam.score, `committed Challenge play awards full score (${applied.entry.score})`);
      t.equal(applied.entry.featured, 'STEAM', 'committed Challenge play claims Featured Spring');
      t.equal(s.featured[0].by, 0, 'Featured Spring plaque marked claimed after commit');
    },
  },
  {
    name: 'W6-P-N01 Challenge-mode staging of SPAS (center & Row) and an unclaimed Featured Spring hides themed, featured, and catReveal signals until Play commits',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await ready(t);
      await t.game('newGame', {
        seed: 7,
        challenge: true,
        seats: [{ kind: 'human', name: 'Ann' }, { kind: 'human', name: 'Bo' }],
      });
      await t.waitIdle(6000);
      await t.game('act', 'reveal');

      const s = await t.state();
      t.equal(s.game.challenge, true, 'Challenge mode is active');
      s.game.featured = [
        { id: 'steam', word: 'STEAM', cat: 'springs', shown: [0], by: null, at: null },
        { id: 'quapaw', word: 'QUAPAW', cat: 'baths', shown: [0], by: null, at: null },
        { id: 'oaklawn', word: 'OAKLAWN', cat: 'track', shown: [0], by: null, at: null },
      ];
      s.game.players[0].rack = 'SPASXYZ'.split('');
      await t.game('setState', { game: s.game });
      await t.waitIdle(4000);

      // 1) Stage SPAS on center (H8): must NOT leak .themed, steam icon, +10, or 'Row · clears 1 plaque letter'
      await t.game('act', 'stage', across('SPAS', CENTER - 1));
      await t.waitFrames(2);
      const spasUi = await t.page.evaluate(() => {
        const pv = document.querySelector('#preview');
        const playBtn = document.querySelector('#actions .abtn.play');
        return {
          preview: window.__G.preview,
          text: pv.textContent.replace(/\s+/g, ' ').trim(),
          themedCount: pv.querySelectorAll('.words b.themed').length,
          steamCount: pv.querySelectorAll('.words svg, .extra svg').length,
          playText: playBtn.textContent.replace(/\s+/g, ' ').trim(),
        };
      });
      const spasBase = baseSum('SPAS');
      t.equal(spasUi.preview.ok, true, 'SPAS preview is ok');
      t.equal(spasUi.preview.score, spasBase, `SPAS preview score is base only (${spasUi.preview.score} === ${spasBase})`);
      t.equal(spasUi.preview.themed, 0, 'SPAS preview themed bonus is 0');
      t.equal(spasUi.themedCount, 0, 'SPAS has no .themed styling in Challenge preview');
      t.equal(spasUi.steamCount, 0, 'SPAS has no steam icons in Challenge preview');
      t.expect(spasUi.text.includes('words checked when you play'), `Challenge notice remains visible (${spasUi.text})`);
      t.expect(!/\+10|clears 1 plaque letter|Featured/i.test(spasUi.text), `SPAS Challenge preview leaks zero Hot Springs / category-reveal cues (${spasUi.text})`);
      t.expect(spasUi.playText.includes(`+${spasBase}`), `Play button shows base +${spasBase} only (${spasUi.playText})`);

      // Open How it scores: zero Hot Springs bonus row leaked
      await t.page.click('#preview .bdbtn');
      await t.waitFrames(2);
      const spasBd = await t.page.textContent('#preview .bd');
      t.expect(!/Hot Springs|Featured Spring/i.test(spasBd) && spasBd.includes(`${spasBase} points`), `SPAS breakdown leaks zero Hot Springs bonus (${spasBd.trim()})`);
      await t.game('act', 'recall');

      // 2) Stage SPAS across a Bathhouse Row square (cell 8): rowPlain ('+20 with a Hot Springs word') stays suppressed in #preview
      const sRow = await t.state();
      sRow.game.board[CENTER] = { l: 'A', blank: false, p: 1, t: 0 };
      sRow.game.board[23] = { l: 'A', blank: false, p: 1, t: 0 }; // (row 1, col 8) directly below Bathhouse Row square 8 (row 0, col 8)
      sRow.game.move = 1;
      sRow.game.cur = 0;
      sRow.game.players[0].rack = 'SPASXYZ'.split('');
      await t.game('setState', { game: sRow.game });
      await t.waitIdle(3000);
      await t.game('act', 'stage', [
        { i: 6, l: 'S' },
        { i: 7, l: 'P' },
        { i: 8, l: 'A' }, // Bathhouse Row square (Superior)
        { i: 9, l: 'S' },
      ]);
      await t.waitFrames(2);
      const rowText = (await t.page.textContent('#preview')).replace(/\s+/g, ' ').trim();
      t.expect(!/\+20 with a Hot Springs word|\+30|\+10/.test(rowText), `Bathhouse Row Challenge preview suppresses rowPlain and Hot Springs bonuses (${rowText})`);
      t.expect(rowText.includes('words checked when you play'), `Bathhouse Row Challenge preview keeps check notice (${rowText})`);
      await t.game('act', 'recall');

      // 3) Stage unclaimed Featured Spring STEAM on center H8: hides Featured +30 and Hot Springs +18 until Play commits
      const sFeat = await t.state();
      sFeat.game.board = sFeat.game.board.map(() => null);
      sFeat.game.move = 0;
      sFeat.game.cur = 0;
      sFeat.game.players[0].rack = 'STEAMXQ'.split('');
      await t.game('setState', { game: sFeat.game });
      await t.waitIdle(3000);
      await t.game('act', 'stage', across('STEAM', CENTER - 2));
      await t.waitFrames(2);
      const steamBase = baseSum('STEAM');
      const steamUi = await t.page.evaluate(() => {
        const pv = document.querySelector('#preview');
        return {
          preview: window.__G.preview,
          text: pv.textContent.replace(/\s+/g, ' ').trim(),
          themedCount: pv.querySelectorAll('.words b.themed').length,
          playText: document.querySelector('#actions .abtn.play').textContent.replace(/\s+/g, ' ').trim(),
        };
      });
      t.equal(steamUi.preview.score, steamBase, `STEAM preview score is base only (${steamUi.preview.score} === ${steamBase})`);
      t.equal(steamUi.preview.featured, null, 'STEAM preview hides unclaimed Featured Spring');
      t.equal(steamUi.preview.themed, 0, 'STEAM preview hides Hot Springs bonus');
      t.equal(steamUi.themedCount, 0, 'STEAM has no .themed styling in Challenge preview');
      t.expect(!/Featured|\+30|\+18|clears 1 plaque letter/i.test(steamUi.text), `STEAM Challenge preview leaks zero Featured/themed cues (${steamUi.text})`);
      t.expect(steamUi.playText.includes(`+${steamBase}`), `Play button shows base +${steamBase} (${steamUi.playText})`);
      if (t.viewport === 'desktop') await t.shot('w5-b01-challenge-preview');

      // Open breakdown on STEAM: zero Featured Spring or Hot Springs rows
      await t.page.click('#preview .bdbtn');
      await t.waitFrames(2);
      const steamBd = await t.page.textContent('#preview .bd');
      t.expect(!/Featured Spring|Hot Springs/i.test(steamBd) && steamBd.includes(`${steamBase} points`), `STEAM breakdown hides Featured and Hot Springs rows (${steamBd.trim()})`);

      // Commit Play: full Hot Springs + Featured Spring bonuses now apply!
      const playRes = await t.game('act', 'play');
      t.equal(playRes.ok, true, 'STEAM commits legally in Challenge mode');
      const after = await t.state();
      const entry = after.game.log[0];
      t.expect(entry.themed > 0 && entry.featured === 'STEAM', `committed entry awards Hot Springs (+${entry.themed}) and Featured Spring (${entry.featured})`);
      t.equal(entry.score, steamBase + entry.themed + FEATURED_BONUS, `committed score includes full bonuses (${entry.score})`);
      t.equal(after.game.featured[0].by, 0, 'Featured Spring plaque claimed on commit');
      t.expect(after.toast.includes('Featured Spring: STEAM'), `post-commit toast celebrates claimed Featured Spring (${after.toast})`);
    },
  },
];
