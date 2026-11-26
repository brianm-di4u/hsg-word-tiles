// Wave 4, batch W4-B02 (WF-1 emergent systems): what the earlier waves left of W1-S4-07. W1-P-N04 (a383b58, tests: wave3-b16) and W1-S4-03
// (458a235, tests: wave3-b06) were already built, and so were W1-S4-07's timers, Turn-2 skip and missing town beat (4bf89ec, tests: wave2-b09).
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const KEY = 'hs-letters-settings-v1';
const tips = () => { window.__TEST_TIPS__ = true; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false, tipsSeen: false })); };
const at = (r, c) => r * 15 + c;
const across = (r, c, word) => [...word].map((l, k) => ({ i: at(r, c + k), l, blank: false }));
const down = (r, c, word) => [...word].map((l, k) => ({ i: at(r + k, c), l, blank: false }));
const CAT = across(7, 6, 'CAT'), TUB = down(8, 8, 'UB'), SPA = across(7, 6, 'SPA');   // TUB runs down from CAT's T
const words = (s) => s.trim().split(/\s+/).length;
const tip = async (t) => ((await t.page.locator('#coach .coach-card').count()) ? t.page.textContent('#coach p') : '');
const kind = async (t) => {
  const s = await tip(t);
  return /discs/.test(s) ? 'discs' : /Plaques/.test(s) ? 'plaques' : /Hot Springs word/.test(s) ? 'town' : /Play|Enter/.test(s) ? 'play' : /center/.test(s) ? 'start' : s ? `? ${s}` : 'none';
};
// the rack to play from, and letters put straight on the board (no new game object, so the tips go on)
const hand = (t, rack, board = []) => t.page.evaluate(([r, b]) => {
  const s = window.__G.s;
  window.__game.act('recall');
  for (const p of s.players) p.rack = (p.kind === 'ai' ? 'VVVVVVV' : r).split('');   // the computer cannot play, so the board stays as it is
  for (const { i, l } of b) s.board[i] = { l, blank: false, p: 1, t: 0 };
}, [rack, board]);
const turn = (t, n) => t.page.waitForFunction((k) => {
  const g = window.__game.getState();
  return g.game.players[g.game.cur].kind === 'human' && !g.aiThinking && g.game.log.filter((e) => e.kind === 'play' && g.game.players[e.p].kind === 'human').length === k;
}, n, { timeout: 20000 });
const stage = async (t, tiles) => { await t.game('act', 'stage', tiles); await t.waitFrames(2); };
const recall = async (t) => { await t.game('act', 'recall'); await t.waitFrames(2); };
const play = async (t, tiles, n) => {
  await stage(t, tiles);
  const r = await t.game('act', 'play');
  if (!r.ok) t.fail(`play ${n} not made: ${r.error}`);
  await turn(t, n);
  await t.waitFrames(2);
};
const begin = async (t, first = CAT, rack = 'CATERIN') => {
  await t.game('newGame', { seed: 7, seats: [{ kind: 'human', name: 'You' }, { kind: 'ai', persona: 'opal', level: 'easy' }] });
  await t.waitIdle(8000);
  await hand(t, rack);
  if (first) await play(t, first, 1);
};
const saved = (t) => t.page.evaluate((k) => JSON.parse(localStorage.getItem(k)).tipsSeen, KEY);
const newcomer = async (t, more = {}) => {
  await t.page.evaluate(([k, o]) => { const s = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...s, ai: 'instant', sound: false, tipsSeen: false, ...o })); }, [KEY, more]);
  await t.reload();
  await ready(t);
};

export const tests = [
  {
    name: 'W1-S4-07 the first Hot Springs word a newcomer lays brings the town tip then and there, and the disc tip takes its turn after it',
    viewports: ['desktop', 'mobile'],
    initScript: tips,
    async run(t) {
      await ready(t);
      await begin(t);
      t.equal(await kind(t), 'discs', 'turn 2 starts with the discs');
      await hand(t, 'UBENRSI');
      await stage(t, down(8, 8, 'EN'));   // TEN: plain, nowhere near the Row
      t.equal(await kind(t), 'discs', 'a plain word changes nothing');
      await recall(t);
      await stage(t, [TUB[0]]);   // TU is no word
      t.equal(await kind(t), 'discs', 'nor does a tile that makes no word yet');
      await recall(t);
      await stage(t, TUB);
      t.equal(await tip(t), 'TUB: a Hot Springs word! Bonus and card; Row +20.', 'TUB: the tip names it');
      t.expect(words(await tip(t)) <= 12, 'in twelve words');
      await t.page.waitForFunction(() => /Tip: TUB: a Hot Springs word/.test(document.querySelector('#live').textContent), null, { timeout: 5000 });
      t.expect(await t.page.locator('#coach .coach-card').isVisible(), 'and it can be seen');
      await t.shot('w4-b02-town-word');
      await t.checkLayout({ allowScrollY: true });
      await recall(t);
      t.equal(await kind(t), 'town', 'it stays with the tiles back on the rack');
      await play(t, TUB, 2);
      t.equal(await kind(t), 'discs', 'turn 3: the discs, not skipped');
      t.expect((await t.state()).game.log.some((e) => e.kind === 'play' && e.themed), 'TUB paid its bonus');
      await hand(t, 'ENRSIAA');
      await play(t, down(8, 6, 'AN'), 3);   // CAN
      t.equal(await kind(t), 'plaques', 'turn 4: the plaques');
      t.equal(await saved(t), false, 'not over yet');
      await hand(t, 'ENRSIAA');
      await play(t, [{ i: at(7, 9), l: 'S' }], 4);   // CATS
      t.equal(await kind(t), 'none', 'and that was the last');
      t.equal(await saved(t), true, 'each tip was seen once');
    },
  },
  {
    name: 'W1-S4-07 the first word laid beside or on an open Bathhouse Row square brings the Row tip, a taken square does not, and Got it goes back to the discs',
    viewports: ['desktop', 'mobile'],
    initScript: tips,
    async run(t) {
      await ready(t);
      for (const [what, put, tiles, row] of [
        ['beside', across(8, 11, 'OR'), [{ i: at(8, 13), l: 'E' }], true],
        ['on', across(8, 11, 'ORE'), [{ i: at(8, 14), l: 'S' }], true],
        ['beside, already covered', [...across(8, 11, 'OR'), { i: at(8, 14), l: 'S' }], [{ i: at(8, 13), l: 'E' }], false],
        ['two squares away', across(8, 10, 'OR'), [{ i: at(8, 12), l: 'E' }], false],
        ['across the edge of the board', across(9, 1, 'RE'), [{ i: at(9, 0), l: 'A' }], false],   // (8,14) is the square before it in the list, not beside it
      ]) {
        await newcomer(t);
        await begin(t);
        t.equal(await kind(t), 'discs', `${what}: turn 2 starts with the discs`);
        await hand(t, 'AESRNII', put);
        await stage(t, tiles);
        t.equal((await t.state()).preview.ok, true, `${what}: a word`);
        if (!row) { t.equal(await kind(t), 'discs', `${what}: still the discs`); continue; }
        t.equal(await tip(t), 'Bathhouse Row square: +20 for a Hot Springs word like SPA.', `${what}: the Row tip`);
        t.expect(words(await tip(t)) <= 12, 'in twelve words');
        if (what !== 'on') continue;
        await t.shot('w4-b02-town-row');
        await t.checkLayout({ allowScrollY: true });
        await t.page.click('#coach [data-coach="got"]');
        t.equal(await kind(t), 'discs', 'Got it: the discs are next');
        await t.page.click('#coach [data-coach="got"]');
        t.equal(await kind(t), 'plaques', 'then the plaques, and the town is not told twice');
        await t.page.click('#coach [data-coach="got"]');
        t.equal(await kind(t), 'none', 'then none');
        t.equal(await saved(t), true, 'and they are done');
      }
    },
  },
  {
    name: 'W1-S4-07 a Hot Springs word on Turn 1 leaves the Play tip and the approved order alone: discs on Turn 2, town on Turn 3, plaques on Turn 4',
    viewports: ['desktop', 'mobile'],
    initScript: tips,
    async run(t) {
      await ready(t);
      await begin(t, null, 'SPATERN');
      t.equal(await kind(t), 'start', 'turn 1');
      await stage(t, SPA);
      t.equal(await kind(t), 'play', 'how to play it comes first');
      await recall(t);
      await play(t, SPA, 1);
      t.equal(await kind(t), 'discs', 'turn 2: the discs');
      await hand(t, 'TERNSII');
      await play(t, [{ i: at(7, 9), l: 'T' }], 2);   // SPAT
      t.equal(await tip(t), 'Hot Springs words (SPA, STEAM, TUB) pay bonuses & cards; Row +20.', 'turn 3: the town');
      await hand(t, 'ERNSIIO');
      await play(t, [{ i: at(7, 10), l: 'S' }], 3);   // SPATS
      t.equal(await kind(t), 'plaques', 'turn 4: the plaques');
      await newcomer(t);
      await begin(t);
      const seen = [await kind(t)];
      for (const [k, l] of [[2, 'E'], [3, 'R']]) { await hand(t, 'ERNSIIO'); await play(t, [{ i: at(7, 7 + k), l }], k); seen.push(await kind(t)); }   // CATE, CATER
      t.equal(seen.join(' '), 'discs town plaques', 'plain words away from the Row: discs, town, plaques');
    },
  },
  {
    name: 'W1-S4-07 where the strip has no room for the tip beside a placed word (short phones), the tip it brought waits for the next turn instead of going unseen',
    viewports: ['mobile'],
    initScript: tips,
    async run(t) {
      await ready(t);
      await t.page.setViewportSize({ width: 390, height: 664 });
      await t.waitFrames(3);
      await begin(t);
      t.equal(await kind(t), 'discs', 'turn 2: the discs');
      await hand(t, 'UBENRSI');
      await stage(t, TUB);
      t.equal(await t.page.evaluate(() => getComputedStyle(document.querySelector('#coach')).visibility), 'hidden', 'the score of the word has the strip');
      await t.game('act', 'play');
      await turn(t, 2);
      await t.waitFrames(2);
      t.equal(await kind(t), 'town', 'turn 3: the town');
      await hand(t, 'ENRSIAA');
      await play(t, down(8, 6, 'AN'), 3);
      t.equal(await kind(t), 'plaques', 'turn 4: the plaques, the discs having had turn 2');
      // seen on turn 2 (the tiles went back), so it is not told again
      await newcomer(t);
      await begin(t);
      await hand(t, 'UBENRSI');
      await stage(t, TUB);
      await recall(t);
      t.equal(await kind(t), 'town', 'the tiles go back: the tip shows');
      await play(t, TUB, 2);
      t.equal(await kind(t), 'discs', 'turn 3: the discs');
    },
  },
  {
    name: "W1-S4-07 with two people the tip never names a word left on the other one's rack, and a game resumed after an early town tip still has its disc tip",
    viewports: ['desktop'],
    initScript: tips,
    async run(t) {
      await ready(t);
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      await hand(t, 'CATERIN');
      await stage(t, CAT);
      await t.game('act', 'play');
      await t.game('act', 'reveal');
      await hand(t, 'UBENRSI');
      await stage(t, TUB);
      t.expect(/^TUB: a Hot Springs word/.test(await tip(t)), 'the one laying it reads its name');
      await recall(t);
      await t.game('act', 'pass');
      await t.game('act', 'reveal');
      await t.waitFrames(2);
      t.equal(await tip(t), 'Hot Springs words (SPA, STEAM, TUB) pay bonuses & cards; Row +20.', 'the next player still gets the tip, without the word');
      // one person and a computer: an early town tip on turn 2, then closed and opened again
      await begin(t);
      await hand(t, 'UBENRSI');
      await play(t, TUB, 2);
      t.equal(await kind(t), 'discs', 'turn 3: the discs');
      await t.waitIdle(8000);
      await t.reload();
      await ready(t);
      await t.page.click('[data-go="continue"]');
      await t.page.waitForFunction(() => window.__game.getState().scene === 'game', null, { timeout: 8000 });
      await t.waitIdle(8000);
      t.equal(await kind(t), 'discs', 'opened again: the discs');
    },
  },
  {
    name: 'W1-S4-07 the longest town tip fits where the others do, and nothing moves when it comes, at every size and at 130% text',
    viewports: ['mobile'],
    initScript: tips,
    async run(t) {
      await ready(t);
      const plain = down(8, 8, 'EN');
      for (const text of [1, 1.3]) {
        await newcomer(t, { text });
        await begin(t);
        for (const [w, h] of [[390, 844], [360, 780], [320, 568], [390, 664], [844, 390], [568, 320], [768, 1024], [1024, 600], [1280, 800]]) {
          await t.page.setViewportSize({ width: w, height: h });
          await t.waitFrames(3);
          // TE with the disc tip up, then TEN, which brings the town tip (or, for the comparison, none)
          const look = (town) => t.page.evaluate(async ([tw, list]) => {
            const G = window.__G, act = window.__game.act;
            G.s.players[0].rack = 'UBENRSI'.split('');
            G.coach.town = null;
            await act('recall');
            await act('stage', list.slice(0, 1));
            G.coach.town = tw && { ...tw, move: G.s.move };
            await act('stage', list.slice(1));
            await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
            const box = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.top, r.bottom, r.left].map(Math.round).join(); };
            const card = document.querySelector('#coach .coach-card'), p = card.querySelector('p'), r = card.getBoundingClientRect();
            return { text: p.textContent, board: box('#boardwrap'), rack: box('#rackbar'), actions: box('#actions'), h: r.height, l: r.left, r: r.right, cut: Math.max(p.scrollWidth - p.clientWidth, card.scrollHeight - card.clientHeight, card.scrollWidth - card.clientWidth) };
          }, [town, plain]);
          const discs = await look(null), long = await look({ w: 'THOROUGHBREDS' }), row = await look({ row: true });
          const what = `${w}x${h} ${text * 100}%`;
          t.expect(/discs/.test(discs.text) && /^THOROUGHBREDS:/.test(long.text) && /^Bathhouse Row/.test(row.text), `${what}: the three tips (${[discs, long, row].map((x) => x.text).join(' | ')})`);
          for (const [n, m] of [['word', long], ['row', row]]) {
            for (const part of ['board', 'rack', 'actions']) t.equal(m[part], discs[part], `${what}: the ${n} tip leaves the ${part} where it was`);
            t.expect(m.cut <= 1 && m.l >= -0.5 && m.r <= w + 0.5, `${what}: the ${n} tip is not cut off (${JSON.stringify(m)})`);
            t.expect(Math.abs(m.h - discs.h) <= 1, `${what}: the ${n} tip is as tall as the discs tip (${m.h}, ${discs.h})`);
          }
        }
      }
      await t.page.setViewportSize({ width: 390, height: 844 });
      for (const theme of ['light', 'dark']) {
        await t.page.evaluate((th) => document.body.classList.toggle('theme-dark', th === 'dark'), theme);
        t.equal((await t.contrastReport({ selector: '#coach', min: 4.5, largeMin: 4.5 })).fails.length, 0, `contrast, ${theme}`);
      }
    },
  },
];
