// Wave 1, batch C: S6-12 (tiny window board), S6-02 (small landscape phones), P-N04 (blocklist).
import { ctx } from './lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { has } from '../src/js/dict.js';
const ready = (t) => t.page.waitForFunction(() => window.__game && window.__game.getState().ready, null, { timeout: 15000 });

async function measure(t, w, h) {
  await t.page.setViewportSize({ width: w, height: h });
  for (let k = 0; k < 3; k++) { await t.page.evaluate(() => dispatchEvent(new Event('resize'))); await t.waitFrames(1); }
  return t.page.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height }; };
    const tiles = [...document.querySelectorAll('#rack .rtile')].map((e) => e.getBoundingClientRect());
    return { W: innerWidth, H: innerHeight, board: r('#boardwrap'), rack: r('#rack'), play: r('[data-act=play]'), pass: r('[data-act=pass]'), hint: r('[data-act=hint]'),
      tileL: Math.min(...tiles.map((x) => x.left)), tileR: Math.max(...tiles.map((x) => x.right)), tileB: Math.max(...tiles.map((x) => x.bottom)), n: tiles.length };
  });
}
async function live(t) {
  await ready(t);
  await t.game('newGame', { seed: 6 });
  await t.waitIdle(5000);
}
const inside = (t, m, name) => {
  for (const k of ['play', 'pass', 'hint']) t.expect(m[k] && m[k].b <= m.H + 0.5 && m[k].r <= m.W + 0.5 && m[k].t >= 0, `${m.W}x${m.H}: ${k} button inside the viewport (${m[k] && Math.round(m[k].b)} of ${m.H})`);
  t.expect(m.n === 7 && m.tileL >= 0 && m.tileR <= m.W + 0.5 && m.tileB <= m.H + 0.5, `${m.W}x${m.H}: all 7 rack tiles inside the viewport (${Math.round(m.tileL)}-${Math.round(m.tileR)} of ${m.W}, bottom ${Math.round(m.tileB)} of ${m.H})`);
};

export const tests = [
  {
    name: 'S6-12 a 320x480 window keeps a playable board',
    viewports: ['desktop'],
    async run(t) {
      await live(t);
      const m = await measure(t, 320, 480);
      t.expect(m.board.w >= 230 && m.board.h >= 230, `board at least 230 px across (${Math.round(m.board.w)}x${Math.round(m.board.h)})`);
      t.expect(m.rack.t >= m.board.b - 0.5, 'the rack does not overlap the board (rack top ' + Math.round(m.rack.t) + ', board bottom ' + Math.round(m.board.b) + ')');
      t.expect(m.rack.r <= m.W + 0.5 && m.play.r <= m.W + 0.5, 'rack and buttons inside the width');
      const sc = await t.page.evaluate(() => { const a = document.querySelector('#app'); a.scrollTop = a.scrollHeight; const p = document.querySelector('[data-act=play]').getBoundingClientRect(); return { top: a.scrollTop, b: p.bottom, H: innerHeight }; });
      t.expect(sc.b <= sc.H + 0.5, 'the buttons can be scrolled into view (' + Math.round(sc.b) + ' of ' + sc.H + ')');
    },
  },
  {
    name: 'P-N04 the stated-policy words are refused and never played by the computer', node: true,
    async run(t) {
      const c = await ctx();
      const banned = ['RETARD', 'RETARDS', 'RETARDED', 'SPASTIC', 'SPASTICS', 'WHITEY', 'MONGOLOID', 'JEWED', 'POOFTER', 'TURD', 'TURDS', 'PENIS', 'PENISES', 'VAGINA', 'VAGINAS', 'SEMEN'];
      for (const w of banned) t.expect(!has(c.dict, w), w + ' is not a word');
      t.expect(has(c.dict, 'RETARDANT') && has(c.dict, 'SPASTICITY') && has(c.dict, 'SEMINAL'), 'innocent neighbours stay');
      // the player: the engine refuses the play
      const s = createGame({ mode: 'play', seats: [{ kind: 'human', name: 'A' }, { kind: 'ai', level: 'hard', name: 'B' }], seed: 3 }, c.lex);
      s.players[0].rack = ['R', 'E', 'T', 'A', 'R', 'D', 'X'];
      const r = apply(s, { type: 'play', tiles: [...'RETARD'].map((l, k) => ({ i: 112 + k, l })) }, c);
      t.expect(!r.ok && /RETARD/.test(r.error), 'RETARD is refused for the player (' + r.error + ')');
      // the computer: no generated play forms one of them, at any level of word knowledge
      const racks = [['R', 'E', 'T', 'A', 'R', 'D', 'S'], ['S', 'P', 'A', 'S', 'T', 'I', 'C'], ['W', 'H', 'I', 'T', 'E', 'Y', 'S'], ['J', 'E', 'W', 'E', 'D', 'A', 'S'], ['T', 'U', 'R', 'D', 'S', 'A', 'E'], ['P', 'E', 'N', 'I', 'S', 'E', 'S'], ['P', 'O', 'O', 'F', 'T', 'E', 'R'], ['V', 'A', 'G', 'I', 'N', 'A', 'S'], ['S', 'E', 'M', 'E', 'N', 'A', 'T']];
      let total = 0;
      for (const rack of racks) for (const opts of [{}, { commonOnly: true }, { commonOnly: true, freeLen: 4, maxLen: 6 }]) {
        const { moves } = generateMoves(c.dict, Array(225).fill(null), rack, { lex: c.lex, ...opts });
        total += moves.length;
        const bad = moves.find((m) => m.words.some((w) => banned.includes(w)));
        t.expect(!bad, rack.join('') + ' ' + JSON.stringify(opts) + ': no generated play forms a banned word' + (bad ? ' (' + bad.words.join(',') + ')' : ''));
      }
      t.expect(total > 100, 'the generator still finds plays (' + total + ')');
    },
  },
];
