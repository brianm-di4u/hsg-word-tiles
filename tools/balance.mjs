#!/usr/bin/env node
// Runs AI-vs-AI games with the real engine and AI and reports the numbers PRD.md sets targets for:
// win rates between levels, average scores, the share of points from Hot Springs bonuses, Full Soak
// and Featured Spring rates, game length, and AI time per move. Every AI action goes through apply(),
// so an illegal AI move throws.
//   node tools/balance.mjs [--games 100] [--json out.json]
import fs from 'node:fs';
import { ctx } from '../tests/lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction } from '../src/js/ai.js';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('--games', 100);
const c = await ctx();

export async function playMatch(levels, seed, stats) {
  const seats = levels.map((level, k) => ({ kind: 'ai', level, name: `${level}${k}` }));
  const s = createGame({ mode: 'play', seats, seed }, c.lex);
  let guard = 0;
  while (!s.over && guard++ < 400) {
    const t0 = performance.now();
    const { action } = chooseAction(c.dict, c.lex, s, { level: s.players[s.cur].level });
    const ms = performance.now() - t0;
    const lvl = s.players[s.cur].level;
    stats.ms[lvl] = stats.ms[lvl] || [];
    stats.ms[lvl].push(ms);
    const r = apply(s, action, c);
    if (!r.ok) throw new Error(`seed ${seed}: ${lvl} made an illegal ${action.type}: ${r.error}`);
    const e = r.entry;
    if (e.kind === 'play') {
      stats.plays++;
      stats.points += e.score;
      stats.themed += e.themed;
      if (e.full) stats.full++;
      if (e.featured) stats.featured++;
      if (e.themed) stats.themedPlays++;
    } else stats[e.kind]++;
  }
  stats.moves += s.move;
  return s;
}

const pct = (a, q) => { const x = a.slice().sort((m, n) => m - n); return x[Math.min(x.length - 1, Math.floor(q * x.length))]; };

async function matchup(a, b) {
  const stats = { plays: 0, points: 0, themed: 0, full: 0, featured: 0, themedPlays: 0, swap: 0, pass: 0, moves: 0, ms: {} };
  let winsA = 0, ties = 0;
  const scores = [[], []];
  for (let g = 0; g < GAMES; g++) {
    // alternate who starts
    const flip = g % 2 === 1;
    const s = await playMatch(flip ? [b, a] : [a, b], 1000 + g, stats);
    const sa = s.players[flip ? 1 : 0].score, sb = s.players[flip ? 0 : 1].score;
    scores[0].push(sa); scores[1].push(sb);
    if (sa > sb) winsA++; else if (sa === sb) ties++;
  }
  const avg = (x) => Math.round(x.reduce((m, n) => m + n, 0) / x.length);
  const out = {
    matchup: `${a} vs ${b}`, games: GAMES, winRateA: +(winsA / GAMES).toFixed(3), ties,
    avgScore: [avg(scores[0]), avg(scores[1])], themedShare: +(stats.themed / stats.points).toFixed(3),
    themedPlaysPerGame: +(stats.themedPlays / GAMES).toFixed(2), fullSoakPerGame: +(stats.full / GAMES).toFixed(2),
    featuredPerGame: +(stats.featured / GAMES).toFixed(2), movesPerGame: +(stats.moves / GAMES).toFixed(1),
    swapsPerGame: +(stats.swap / GAMES).toFixed(2), passesPerGame: +(stats.pass / GAMES).toFixed(2),
    msPerMove: Object.fromEntries(Object.entries(stats.ms).map(([k, v]) => [k, { median: +pct(v, 0.5).toFixed(1), p95: +pct(v, 0.95).toFixed(1), max: +Math.max(...v).toFixed(1) }])),
  };
  console.log(JSON.stringify(out));
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('balance.mjs')) {
  const results = [];
  for (const [a, b] of [['hard', 'medium'], ['medium', 'easy'], ['hard', 'easy']]) results.push(await matchup(a, b));
  const json = arg('--json', null);
  if (json) fs.writeFileSync(json, JSON.stringify(results, null, 2));
}
