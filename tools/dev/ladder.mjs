// Plays the difficulty ladder against itself and reports, per level: average score, longest words, how often Medium went past four
// letters (and whether it ever did so on two turns running or without a premium square), win rates between neighbouring levels
// and time per move.   node tools/dev/ladder.mjs [--games 40]
import { ctx } from '../../tests/lib.mjs';
import { createGame, apply } from '../../src/js/engine.js';
import { chooseAction, LEVEL_ORDER, usesPremium } from '../../src/js/ai.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('--games', 40);
const c = await ctx();
const rows = {};
const row = (l) => (rows[l] ||= { games: 0, score: 0, plays: 0, long: 0, maxLen: 0, longRun: 0, longNoPrem: 0, ms: 0, moves: 0, pts: 0 });

function play(levels, seed) {
  const s = createGame({ mode: 'play', seats: levels.map((level, k) => ({ kind: 'ai', level, name: level + k })), seed }, c.lex);
  const lastLong = levels.map(() => false);
  for (let guard = 0; !s.over && guard < 400; guard++) {
    const k = s.cur, lvl = levels[k], R = row(lvl);
    const t0 = performance.now();
    const { action, move } = chooseAction(c.dict, c.lex, s, { level: lvl });
    R.ms += performance.now() - t0; R.moves++;
    const r = apply(s, action, c);
    if (!r.ok) throw new Error(`seed ${seed}: ${lvl} illegal ${action.type}: ${r.error}`);
    R.pts += r.entry.score || 0;
    if (r.entry.kind === 'play') {
      const len = Math.max(...r.entry.words.map((w) => w.w.length));
      R.plays++; R.maxLen = Math.max(R.maxLen, len);
      const long = len > 4;
      if (long) { R.long++; if (lastLong[k]) R.longRun++; if (move && !usesPremium(move)) R.longNoPrem++; }
      lastLong[k] = long;
    } else lastLong[k] = false;
  }
  s.players.forEach((p, k) => { const R = row(levels[k]); R.games++; R.score += p.score; });
  return s;
}

const pair = {};
for (let g = 0; g < GAMES; g++) {
  for (const l of LEVEL_ORDER) play([l, l], 1000 + g);
  for (let i = 0; i + 1 < LEVEL_ORDER.length; i++) {
    const a = LEVEL_ORDER[i], b = LEVEL_ORDER[i + 1];
    const seats = g % 2 ? [b, a] : [a, b];
    const s = play(seats, 5000 + g);
    const kA = seats.indexOf(a), key = `${a} v ${b}`;
    pair[key] ||= { a: 0, n: 0, margin: 0 };
    pair[key].n++; if (s.players[kA].score > s.players[1 - kA].score) pair[key].a++;
    pair[key].margin += s.players[1 - kA].score - s.players[kA].score;
  }
}
console.log('level     pts/turn avg score  plays>4 letters  longest  long twice running  long w/o premium  ms/move');
for (const l of LEVEL_ORDER) {
  const R = rows[l];
  console.log(`${l.padEnd(9)} ${(R.pts / R.moves).toFixed(1).padStart(8)} ${(R.score / R.games).toFixed(0).padStart(9)}  ${(100 * R.long / R.plays).toFixed(1).padStart(14)}%  ${String(R.maxLen).padStart(7)}  ${String(R.longRun).padStart(18)}  ${String(R.longNoPrem).padStart(16)}  ${(R.ms / R.moves).toFixed(0).padStart(7)}`);
}
for (const [k, v] of Object.entries(pair)) console.log(`${k}: easier side wins ${(100 * v.a / v.n).toFixed(0)}%, harder side ahead by ${(v.margin / v.n).toFixed(0)} on average`);
