// Move generator: every generated move is legal and scored exactly as the engine scores it; on small
// racks it finds every legal move a brute-force search finds; greedy self-play games finish.
import { ctx } from './lib.mjs';
import { createGame, apply, evaluate } from '../src/js/engine.js';
import { generateMoves } from '../src/js/movegen.js';
import { findWords, connectError, N } from '../src/js/score.js';
import { has } from '../src/js/dict.js';
import { rand } from '../src/js/rng.js';

const twoAi = [{ kind: 'ai', level: 'hard', name: 'A' }, { kind: 'ai', level: 'hard', name: 'B' }];

// Play a game choosing moves with `pick`; calls check(state, moves) before each move.
async function playGame(seed, pick, check) {
  const c = await ctx();
  const s = createGame({ mode: 'play', seats: twoAi, seed }, c.lex);
  let guard = 0;
  while (!s.over && guard++ < 200) {
    const p = s.players[s.cur];
    const { moves } = generateMoves(c.dict, s.board, p.rack, { lex: c.lex, featured: s.featured });
    if (check) check(s, moves);
    const m = pick(s, moves);
    const r = m ? apply(s, { type: 'play', tiles: m.tiles }, c) : apply(s, { type: 'pass' }, c);
    if (!r.ok) throw new Error(`seed ${seed}: chosen move refused: ${r.error}`);
  }
  return s;
}

// Every legal placement of up to `maxTiles` rack tiles, by brute force (squares near tiles only).
function bruteForce(c, s, rack, maxTiles) {
  // anchors (empty squares touching a tile, or the centre), then every empty square within
  // maxTiles − 1 of an anchor along its row or column
  const empty = !s.board.some(Boolean);
  const isAnchor = (i) => {
    if (s.board[i]) return false;
    if (empty) return i === 112;
    const r = Math.floor(i / N), col = i % N;
    return (r > 0 && s.board[i - N]) || (r < N - 1 && s.board[i + N]) || (col > 0 && s.board[i - 1]) || (col < N - 1 && s.board[i + 1]);
  };
  const near = [];
  for (let i = 0; i < N * N; i++) {
    if (s.board[i]) continue;
    const r = Math.floor(i / N), col = i % N;
    let ok = false;
    for (let d = -(maxTiles - 1); d <= maxTiles - 1 && !ok; d++) {
      if (col + d >= 0 && col + d < N && isAnchor(r * N + col + d)) ok = true;
      if (r + d >= 0 && r + d < N && isAnchor((r + d) * N + col)) ok = true;
    }
    if (ok) near.push(i);
  }
  const found = new Set();
  const letters = rack.split('');
  const tryTiles = (tiles) => {
    const fw = findWords(s.board, tiles);
    if (fw.error || connectError(s.board, tiles)) return;
    if (fw.words.every((w) => has(c.dict, w.w))) found.add(tiles.map((t) => `${t.i}${t.l}`).sort().join(','));
  };
  // choose an ordered set of squares in one line and assign rack letters
  const rec = (tiles, usedIdx, sqs) => {
    if (tiles.length) tryTiles(tiles);
    if (tiles.length >= maxTiles) return;
    for (const i of near) {
      if (sqs.includes(i)) continue;
      if (sqs.length && sqs[sqs.length - 1] > i) continue; // increasing squares only
      if (sqs.length) {
        const r0 = Math.floor(sqs[0] / N), c0 = sqs[0] % N;
        if (Math.floor(i / N) !== r0 && i % N !== c0) continue;
        if (sqs.length >= 2) {
          const across = Math.floor(sqs[1] / N) === r0;
          if (across ? Math.floor(i / N) !== r0 : i % N !== c0) continue;
        }
      }
      const tried = new Set();
      for (let k = 0; k < letters.length; k++) {
        if (usedIdx.includes(k) || tried.has(letters[k])) continue;
        tried.add(letters[k]);
        rec([...tiles, { i, l: letters[k] }], [...usedIdx, k], [...sqs, i]);
      }
    }
  };
  rec([], [], []);
  return found;
}

export const tests = [
  {
    name: 'generated moves are legal and scored like the engine (20 games)', node: true, slow: false,
    async run(t) {
      let checked = 0, totalMoves = 0;
      for (let seed = 1; seed <= 20; seed++) {
        await playGame(seed, (s, moves) => moves[0], (s, moves) => {
          const c = ctxSync;
          totalMoves += moves.length;
          // check the top 40 and a deterministic sample of the rest
          const sample = moves.filter((m, k) => k < 40 || k % 37 === 0);
          for (const m of sample) {
            const ev = evaluate(s, m.tiles, c);
            checked++;
            if (!ev.ok) { t.fail(`seed ${seed}: illegal ${m.words[0]}: ${ev.error}`); continue; }
            if (ev.score !== m.score) t.fail(`seed ${seed}: ${m.words.join('/')} movegen ${m.score} vs engine ${ev.score}`);
          }
        });
      }
      t.log(`${checked} moves checked out of ${totalMoves} generated`);
    },
  },
  {
    name: 'movegen finds every brute-force move for 3-tile racks', node: true,
    async run(t) {
      const c = ctxSync;
      let positions = 0;
      for (let seed = 30; seed < 36; seed++) {
        await playGame(seed, (s, moves) => {
          if (s.move === 3 || s.move === 9) {
            positions++;
            const rack = s.players[s.cur].rack.filter((l) => l !== '?').slice(0, 3);
            const brute = bruteForce(c, s, rack.join(''), 3);
            const gen = generateMoves(c.dict, s.board, rack, {}).moves;
            const genKeys = new Set(gen.map((m) => m.tiles.map((x) => `${x.i}${x.l}`).sort().join(',')));
            for (const k of brute) if (!genKeys.has(k)) t.fail(`seed ${seed} move ${s.move}: missed ${k}`);
            for (const k of genKeys) if (!brute.has(k)) t.fail(`seed ${seed} move ${s.move}: extra ${k}`);
            if (s.move === 3) t.log(`seed ${seed}: rack ${rack.join('')} → ${brute.size} moves`);
          }
          return moves[0];
        });
      }
      t.equal(positions, 12, 'positions compared');
    },
  },
  {
    name: 'greedy games finish with legal moves', node: true,
    async run(t) {
      const ends = [];
      for (let seed = 100; seed < 110; seed++) {
        const s = await playGame(seed, (st, moves) => moves[Math.floor(rand(st, 'ai') * Math.min(5, moves.length))]);
        if (!s.over) t.fail(`seed ${seed}: did not finish`);
        ends.push(`${s.result.why}:${s.players.map((p) => p.score).join('-')}`);
      }
      t.log(ends.join(' '));
    },
  },
];

const ctxSync = await ctx();
