// Wave 3, batch D: S4-19, S1-04, S1-07, S2-02, S2-06, S2-09, S4-05, S4-09, S2-14 and S3-15 (feedback, teaching, help and records).

const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const quiet = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const CENTER = 112;
const REGISTER = 'hs-letters-register-v1';
async function start(t, rack, extra = {}) {
  await ready(t);
  await t.game('newGame', { seed: 3, ...extra });
  await t.waitIdle(5000);
  const s = await t.state();
  if (rack) { s.game.players[0].rack = rack.split(''); await t.game('setState', { game: s.game }); await t.waitIdle(); }
}
const across = (word, at = CENTER - 2) => [...word].map((l, k) => ({ i: at + k, l }));
// stage and play in one go inside the page and read what the play showed in the same turn of the event loop, before any reply or timer can change it
const playNow = (t, tiles) => t.page.evaluate(async (tl) => {
  await window.__game.act('stage', tl);
  const r = await window.__game.act('play');
  return { ok: r.ok, longPops: document.querySelectorAll('.pop.themed').length, pops: document.querySelectorAll('.pop').length, toast: document.querySelector('#toast').textContent, sweeps: window.__game.getState().sweeps };
}, tiles);
const geom = (t) => t.page.evaluate(() => { const r = (s) => document.querySelector(s).getBoundingClientRect(); return { prev: Math.round(r('#preview').height), rack: Math.round(r('#rack').top), play: Math.round(r('#actions .play').top) }; });

// a finished two-seat game: seat 0 is a person; `plays` are the log entries of both seats
function finished(o) {
  return {
    mode: 'play', seed: 1, rng: { bag: 1, ai: 2 }, over: true, scoreless: 0, round: 5, move: 12, cur: 0, bag: [], board: Array(225).fill(null),
    featured: o.featured || [],
    players: [{ kind: 'human', name: 'You', score: o.you, best: { word: 'QUARTZ', score: 54 }, hints: 3, rack: [] }, { kind: 'ai', name: 'Opal', persona: 'opal', level: 'easy', score: o.opal, best: null, hints: null, rack: [] }],
    log: [...(o.log || []), { kind: 'end' }],
    result: { why: 'out', out: 0, adjust: o.adjust || [0, 0], winners: o.winners },
  };
}
const play = (p, score, extra = {}) => ({ p, kind: 'play', n: 0, score, full: 0, themed: 0, words: [{ w: 'WORD', score, bonus: 0 }], tiles: [], ...extra });

export const tests = [
  // ---------- S4-19 ----------
  {
    name: 'S4-19 a Hot Springs word sweeps gold over its tiles, its pop stays longer and a first find says it is new in the Register; an everyday word does none of it',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'freezeFx', 0);   // the sweep is not removed while the clock is frozen, so its start can be read
      const r = await playNow(t, across('SPRING'));
      t.expect(r.ok, 'SPRING is played');
      t.expect(r.sweeps >= 1, 'a gold sweep was started for the Hot Springs word (' + r.sweeps + ')');
      t.expect(/New in your Register/.test(r.toast), 'the first find says it is new in the Register (' + r.toast + ')');
      t.equal(r.longPops, 1, 'the score pop is the long one');
      let s = await t.state();
      // freeze the overlay half way through the sweep and look at its pixels: gold light over the word
      await t.game('act', 'freezeFx', s.sweepAt + 450);
      await t.page.waitForFunction(() => { const c = document.querySelector('#fx'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let k = 0; k < d.length; k += 4) if (d[k + 3] > 40 && d[k] >= 250 && d[k + 1] >= 215 && d[k + 2] <= 135) n++; return n > 200; }, null, { timeout: 5000 });
      await t.shot('S4-19-gold-sweep');
      await t.shot('S4-19-themed-word');
      // the same word again is no longer new
      await t.page.waitForFunction((k) => !!localStorage.getItem(k), REGISTER, { timeout: 5000 });
      await t.reload();
      await t.game('act', 'freezeFx', 0);
      await t.game('newGame', { seed: 3 }); await t.waitIdle(5000);
      s = await t.state(); s.game.players[0].rack = 'SPRINGE'.split(''); await t.game('setState', { game: s.game });
      const again = await playNow(t, across('SPRING'));
      t.expect(/SPRING/.test(again.toast) && !/New in your Register/.test(again.toast), 'a word already signed in is not new (' + again.toast + ')');
      // an everyday word: no sweep and the short pop
      await t.game('newGame', { seed: 3, seats: [{ kind: 'human', name: 'A' }, { kind: 'human', name: 'B' }] }); await t.waitIdle(5000);   // two people, so no computer reply adds a pop of its own
      await t.game('act', 'reveal');
      await t.page.waitForFunction(() => !document.querySelector('.pop.themed'), null, { timeout: 5000 });   // the first game's long pop has gone
      s = await t.state(); s.game.players[0].rack = 'QIXXXXX'.split(''); await t.game('setState', { game: s.game });
      const before = (await t.state()).sweeps;
      const q = await playNow(t, [{ i: CENTER, l: 'Q' }, { i: CENTER + 1, l: 'I' }]);
      t.expect(q.ok, 'QI is played');
      t.equal(q.sweeps, before, 'an everyday word starts no sweep');
      t.equal(q.longPops, 0, 'and has no long pop');
      t.equal(q.pops, 1, 'only the ordinary one');
    },
  },
  {
    name: 'S4-19 under reduced motion there is no sweep and no long pop, but the Register note stays',
    viewports: ['desktop'],
    reducedMotion: true,
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      await t.game('act', 'stage', across('SPRING')); await t.game('act', 'play');
      const s = await t.state();
      t.equal(s.sweeps, 0, 'no sweep');
      t.equal(await t.page.locator('.pop').count(), 0, 'no pop');
      t.expect(/New in your Register/.test(s.toast), 'the text is still there');
    },
  },
  // ---------- S1-04 ----------
  {
    name: 'S1-04 placing a tile puts a waiting toast away so the strip shows the play again, and clears the ones queued behind it',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      for (const n of [1, 2, 3]) await t.game('act', 'toast', { kind: 'themed', title: 'SPRING +10 ' + n, sub: 'Place' });
      t.expect(await t.page.locator('#toast.on').count() === 1 && await t.page.locator('#app.toasting').count() === 1, 'a toast is up and the strip is covered');
      await t.game('act', 'stage', across('SPRING'));
      t.equal(await t.page.locator('#toast.on').count(), 0, 'staging a tile puts the toast away');
      t.equal(await t.page.locator('#app.toasting').count(), 0, 'and uncovers the strip');
      await t.page.waitForFunction(() => /SPRING/.test(document.querySelector('#preview').textContent) && /pts/.test(document.querySelector('#preview').textContent), null, { timeout: 3000 });
      const col = await t.page.evaluate(() => getComputedStyle(document.querySelector('#preview .pts')).color);
      t.expect(col !== 'rgba(0, 0, 0, 0)', 'the score is readable (' + col + ')');
      // the queued toasts do not come back after the 200 ms the old code waited
      await t.page.waitForTimeout(600);
      t.equal(await t.page.locator('#toast.on').count(), 0, 'nothing queued behind it comes up');
    },
  },
  // ---------- S1-07 ----------
  {
    name: 'S1-07 the rack and the buttons stay where they are whether the strip shows nothing, a score, a refusal or a long message',
    viewports: ['desktop', 'mobile'],
    initScript: quiet,
    async run(t) {
      await start(t, 'SPRINGE');
      const base = await geom(t);
      const seen = [['empty', base]];
      await t.game('act', 'play');   // "Place tiles on the board first."
      seen.push(['refusal', await geom(t)]);
      await t.game('act', 'stage', [{ i: CENTER, l: 'S' }]);
      seen.push(['one tile', await geom(t)]);
      await t.game('act', 'stage', [{ i: CENTER + 1, l: 'P' }]);
      seen.push(['not a word', await geom(t)]);
      await t.game('act', 'recall');
      await t.game('act', 'stage', across('SPRING'));
      seen.push(['a word', await geom(t)]);
      await t.game('act', 'stage', [{ i: 20, l: 'S' }]);   // a tile far from the Display Spring: the opening rule is the refusal
      seen.push(['a refusal on the board', await geom(t)]);
      await t.game('act', 'recall');
      // after the computer has played the strip holds its quote and the last play, two lines
      await t.game('act', 'stage', across('SPRING')); await t.game('act', 'play');
      await t.page.waitForFunction(() => { const g = window.__game.getState(); return g.game.cur === 0 && !g.aiThinking && g.game.move >= 2; }, null, { timeout: 20000 });
      await t.game('act', 'recall');
      seen.push(['after the computer played', await geom(t)]);
      for (const [name, g] of seen) t.equal(g.rack + ',' + g.play, base.rack + ',' + base.play, name + ': the rack and Play stay put (' + JSON.stringify(g) + ')');
      if (t.viewport === 'mobile') t.expect(base.prev >= 52, 'the strip is two lines high on a phone (' + base.prev + ' px, was 40)');
      await t.shot('S1-07-strip');
    },
  },
];
