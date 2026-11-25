// Wave 4, batch W4-B03 (WF-1 core loop rules): W1-S1-06, W1-S2-03 and W1-S4-08, what the earlier waves left of them. W1-S2-02 (the Swap dialog's
// stall warning) was already built by 458a235 (tests: wave3-b06), the 2L/3L/2W/3W discs by 29fded3 and the preview note on a plain play over
// the Row by 27353a3 (tests: wave4-b01).
import fs from 'node:fs';
import path from 'node:path';
import { ctx, root } from './lib.mjs';
import { createGame, apply, DAILY_TURNS } from '../src/js/engine.js';
import { dailyPar } from '../src/js/par.js';
import { SUPPLEMENT } from '../src/js/supplement.js';

const doc = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\s+/g, ' ');
const json = JSON.stringify;
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });
const instant = () => { window.__TEST_TIPS__ = false; if (!localStorage.getItem('hs-letters-settings-v1')) localStorage.setItem('hs-letters-settings-v1', JSON.stringify({ ai: 'instant', sound: false })); };
const people = [{ kind: 'human', name: 'P1' }, { kind: 'human', name: 'P2' }];
// a two-player game whose bag is `bag` and whose racks hold `rack`
const table = (c, seed, rack, bag) => { const s = createGame({ mode: 'play', seats: people, seed }, c.lex); for (const p of s.players) p.rack = rack.split(''); s.bag = bag.slice(); return s; };
// par on dates where a computer swaps, written by the build before W1-S2-03 (44f6838)
const PAR = { '2026-01-16': { m: 426, h: 329 }, '2026-07-26': { m: 143, h: 187 }, '2026-11-25': { m: 412, h: 475 }, '2027-08-05': { m: 443, h: 451 } };

export const tests = [
  // ---------- W1-S1-06 ----------
  {
    name: 'W1-S1-06 the rules documents say what the game does: the Row adds a flat +20, Challenge mode is in it, and QI and ZA are playable (Node)',
    node: true,
    run(t) {
      for (const f of ['MECHANICS.md', 'PRD.md', 'README.md', 'REPORT.md', 'TEST-CAMPAIGN.md', 'src/js/layout.js', 'tools/build-layout.mjs']) t.expect(!/Row (squares? )?doubl|doubles? (the|its) (tier )?bonus|double the bonus/i.test(doc(f)), `${f}: no doubling on the Row`);
      t.expect(/adds a flat \+20 to a Hot Springs word/.test(doc('src/js/layout.js')) && /adds a flat \+20 to a Hot Springs word/.test(doc('tools/build-layout.mjs')), 'layout.js and its generator');
      t.expect(/add a flat \+20 to a Hot Springs word/.test(doc('REPORT.md')), 'REPORT.md');
      const out = doc('PRD.md').split('## 12. Out of scope')[1];
      t.expect(!!out && /word definitions/.test(out), 'PRD.md still lists what is out of scope');
      t.expect(/data-challenge/.test(doc('src/js/ui.js')) && !/challenge/i.test(out), 'Setup offers Challenge mode, so it is not out of scope');
      const gaps = doc('REPORT.md').split('## Known gaps')[1].split('## ')[0];
      t.expect(SUPPLEMENT.includes('QI') && SUPPLEMENT.includes('ZA') && gaps.includes(`the ${SUPPLEMENT.length}-word supplement (\`src/js/supplement.js\`) adds them`), 'REPORT.md says the supplement adds QI and ZA');
    },
  },
  // ---------- W1-S2-03 ----------
  {
    name: 'W1-S2-03 swapped tiles are mixed back into the bag: anywhere in it, the same for a seed, whatever order they were picked in (Node)',
    node: true,
    async run(t) {
      const c = await ctx();
      const bag = Array.from({ length: 60 }, () => 'E');   // only the returned Q, X and Z stand out
      const spots = [], tail = [];
      for (let seed = 1; seed <= 60; seed++) {
        const s = table(c, seed, 'QXZAAAA', bag), rng = s.rng.bag;
        t.expect(apply(s, { type: 'swap', letters: ['Q', 'X', 'Z'] }, c).ok, 'swap');
        t.equal(s.players[0].rack.join(''), 'AAAAEEE', `seed ${seed}: the new tiles are drawn before the old ones go back`);
        t.equal(s.bag.slice().sort().join(''), 'E'.repeat(57) + 'QXZ', `seed ${seed}: 60 tiles, the returned ones among them`);
        t.equal(s.rng.bag, rng, `seed ${seed}: rng.bag is left alone`);
        const at = ['Q', 'X', 'Z'].map((l) => s.bag.indexOf(l));
        spots.push(...at); tail.push(at.every((k) => k >= 57));
        const again = table(c, seed, 'QXZAAAA', bag);
        apply(again, { type: 'swap', letters: ['Z', 'Q', 'X'] }, c);
        t.equal(json(again.bag), json(s.bag), `seed ${seed}: the same bag, picked in another order`);
        const back = JSON.parse(json(table(c, seed, 'QXZAAAA', bag)));
        apply(back, { type: 'swap', letters: ['Q', 'X', 'Z'] }, c);
        t.equal(json(back.bag), json(s.bag), `seed ${seed}: the same bag from a saved game`);
        t.equal(Object.keys(back).sort().join(), Object.keys(createGame({ mode: 'play', seats: people, seed }, c.lex)).sort().join(), `seed ${seed}: nothing new in the save`);
      }
      const mean = spots.reduce((a, b) => a + b, 0) / spots.length;   // 180 spots of 0 to 59, seeded: no luck in it
      t.log(`mean spot ${mean.toFixed(1)} of 0 to 59, ${spots.filter((k) => k < 20).length} of ${spots.length} in the first third`);
      t.expect(mean > 24 && mean < 35, `the returned tiles lie all through the bag (mean spot ${mean.toFixed(1)}; the bottom three would be 58)`);
      t.expect(spots.filter((k) => k < 20).length >= 40, 'about a third of them in the first third');
      t.equal(tail.filter(Boolean).length, 0, 'in no game all three at the bottom');
      // two swaps running, with nothing drawn from rng.bag in between, are two different shuffles
      const shuffled = (move) => { const s = table(c, 5, 'QXZAAAA', Array.from({ length: 60 }, (_, k) => 't' + k)); s.move = move; apply(s, { type: 'swap', letters: ['Q'] }, c); return s.bag; };
      const a = shuffled(0), b = shuffled(1), same = a.filter((l, k) => b[k] === l).length;
      t.expect(same < 10, `the move number is part of the shuffle (${same} of 60 tiles in one place on both moves)`);
      // seven tiles for a bag of seven: still drawn first
      const last = table(c, 9, 'QXZJKVW', [...'ABCDEFG']);
      t.expect(apply(last, { type: 'swap', letters: [...'QXZJKVW'] }, c).ok, 'a swap with exactly seven in the bag');
      t.equal(last.players[0].rack.join('') + '/' + last.bag.slice().sort().join(''), 'ABCDEFG/JKQVWXZ', 'the seven are drawn, the old seven are the bag');
    },
  },
  {
    name: 'W1-S2-03 in the Daily a swapped tile can come back, and the deal, the fog and the par of a date stay what they were (Node)',
    node: true,
    async run(t) {
      const c = await ctx();
      // a marked tile is swapped on Turn 1 and three others on each turn after: is it seen again within the ten turns?
      let back = 0;
      for (let k = 0; k < 60; k++) {
        const date = new Date(Date.UTC(2026, 0, 1 + k)).toISOString().slice(0, 10);
        const s = createGame({ mode: 'daily', date }, c.lex);
        s.players[0].rack[0] = '!';
        apply(s, { type: 'swap', letters: ['!'] }, c);
        for (let n = 1; n < DAILY_TURNS && !s.players[0].rack.includes('!'); n++) apply(s, { type: 'swap', letters: s.players[0].rack.slice(0, 3) }, c);
        if (s.players[0].rack.includes('!')) back++;
      }
      t.log(`the swapped tile came back on ${back} of 60 dates`);
      t.expect(back >= 8, `a swapped tile is not gone from the run (came back on ${back} of 60 dates; from the bottom of the bag, 0)`);
      // fog: the letters shown after nine turns, written by a452cbe for nine passes (wave3-b16); a swap must not move them
      const was = { '2026-01-15': '7361520 1326457 3042', '2026-07-04': '4572013 154032 532401', '2026-11-24': '405361 1243 4710523' };
      for (const [date, want] of Object.entries(was)) {
        const s = createGame({ mode: 'daily', date }, c.lex);
        for (let k = 1; k < DAILY_TURNS; k++) apply(s, k % 2 ? { type: 'swap', letters: s.players[0].rack.slice(0, k % 7 || 1) } : { type: 'pass' }, c);
        t.equal(s.featured.map((f) => f.shown.join('')).join(' '), want, `${date}: the same letters with swaps as without`);
      }
      for (const [date, want] of Object.entries(PAR)) t.equal(json(await dailyPar(c, date)), json(want), 'par for ' + date);
    },
  },
  {
    name: 'W1-S2-03 a swap made in the Swap dialog mixes the bag as the rules engine does, and the game goes on from it after a reload',
    viewports: ['desktop', 'mobile'],
    initScript: instant,
    async run(t) {
      const c = await ctx();
      await ready(t);
      await t.game('newGame', { seed: 61, seats: people });
      await t.waitIdle(8000);
      await t.game('act', 'reveal');
      const before = (await t.state()).game;
      const letters = [before.players[0].rack[4], before.players[0].rack[1]];
      await t.page.click('#actions [data-act="swap"]');
      await t.page.click('[data-sw="4"]'); await t.page.click('[data-sw="1"]');
      await t.page.click('[data-swap-go]');
      await t.page.waitForFunction(() => window.__game.getState().game.move === 1);
      const now = (await t.state()).game, want = JSON.parse(json(before));
      t.expect(apply(want, { type: 'swap', letters }, c).ok, 'the same swap in Node');
      t.equal(json(now.bag), json(want.bag), 'the same bag in the page as in Node');
      t.equal(json(now.players[0].rack), json(want.players[0].rack), 'and the same rack');
      t.expect(json(now.bag) !== json([...before.bag.slice(2), ...letters.slice().sort()]), 'not the old bottom of the bag');
      await t.reload();
      await ready(t);
      await t.page.click('#screen [data-go="continue"]');
      await t.waitIdle(8000);
      t.equal(json((await t.state()).game.bag), json(now.bag), 'the bag is kept over a reload');
    },
  },
];
