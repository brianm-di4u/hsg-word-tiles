#!/usr/bin/env node
// Runs AI-vs-AI games with the real engine and AI and reports the numbers PRD.md sets targets for:
// win rates between levels, average scores, the share of points from Hot Springs bonuses, Full Soak
// and Featured Spring rates, game length, common-word rates, and AI time per move. Every AI action goes through apply(),
// so an illegal AI move throws.
//   node tools/balance.mjs [--games 100] [--daily-par 60] [--start-date 2026-01-01] [--json out.json]
// A side is a level ('hard') or a level with a character's style ('medium:lucky'). Besides the three level
// pairings it plays all four town personas (Lucky vs Hollis, Opal vs Julian) and optionally checks Daily par inversions.
import fs from 'node:fs';
import { ctx } from '../tests/lib.mjs';
import { createGame, apply } from '../src/js/engine.js';
import { chooseAction, premiumPoints, EASY_TWO } from '../src/js/ai.js';
import { isCommon } from '../src/js/dict.js';
import { dailyPar } from '../src/js/par.js';
import { SQUARE } from '../src/js/score.js';

const hasFlag = (k) => process.argv.includes(k);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const GAMES = +arg('--games', 100);
const DAILY_PAR = hasFlag('--daily-par') ? +arg('--daily-par', 60) : 0;
const c = await ctx();

export async function playMatch(levels, seed, stats) {
  const seats = levels.map((spec, k) => { const [level, persona] = spec.split(':'); return { kind: 'ai', level, persona: persona || null, name: `${spec}${k}` }; });
  const s = createGame({ mode: 'play', seats, seed }, c.lex);
  let guard = 0;
  while (!s.over && guard++ < 400) {
    const t0 = performance.now();
    const { action } = chooseAction(c.dict, c.lex, s, { level: s.players[s.cur].level });
    const ms = performance.now() - t0;
    const lvl = s.players[s.cur].level;
    const who = s.players[s.cur].persona || lvl;
    stats.ms[lvl] = stats.ms[lvl] || [];
    stats.ms[lvl].push(ms);
    const before = s.board.slice();
    const r = apply(s, action, c);
    if (!r.ok) throw new Error(`seed ${seed}: ${lvl} made an illegal ${action.type}: ${r.error}`);
    const e = r.entry;
    if (e.kind === 'play') {
      stats.prem = stats.prem || {};
      stats.prem[who] = (stats.prem[who] || 0) + premiumPoints(e, before);
      stats.pts = stats.pts || {};
      stats.pts[who] = (stats.pts[who] || 0) + e.score;
      stats.byWho = stats.byWho || {};
      const bw = stats.byWho[who] || (stats.byWho[who] = { plays: 0, words: 0, commonWords: 0, teachableWords: 0, rowSq: 0, bathSprings: 0, park: 0, crossPlays: 0, longPlays: 0 });
      bw.plays++;
      bw.rowSq += e.tiles.filter((t) => SQUARE[t.i] === 'B').length;
      for (const w of e.words) {
        bw.words++;
        const common = isCommon(c.dict, w.w);
        if (common) bw.commonWords++;
        if (common || (w.w.length === 2 && EASY_TWO.has(w.w)) || c.lex.byForm.has(w.w)) bw.teachableWords++;
        const en = c.lex.entry(w.w);
        if (en && (en.cat === 'baths' || en.cat === 'springs')) bw.bathSprings++;
        if (en && en.cat === 'park') bw.park++;
      }
      if (e.words.length > 1) bw.crossPlays++;
      if (e.words[0] && e.words[0].w.length >= 5) bw.longPlays++;
      stats.plays++;
      stats.points += e.score;
      stats.themed += e.themed;
      if (e.full) stats.full++;
      if (e.featured) stats.featured += Array.isArray(e.featuredAll) ? e.featuredAll.length : 1;
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
    premiumShare: Object.fromEntries(Object.keys(stats.prem || {}).map((k) => [k, +(stats.prem[k] / stats.pts[k]).toFixed(3)])),
    commonWordShare: Object.fromEntries(Object.entries(stats.byWho || {}).map(([k, v]) => [k, v.words ? +(v.commonWords / v.words).toFixed(3) : 0])),
    teachableWordShare: Object.fromEntries(Object.entries(stats.byWho || {}).map(([k, v]) => [k, v.words ? +(v.teachableWords / v.words).toFixed(3) : 0])),
    msPerMove: Object.fromEntries(Object.entries(stats.ms).map(([k, v]) => [k, { median: +pct(v, 0.5).toFixed(1), p95: +pct(v, 0.95).toFixed(1), max: +Math.max(...v).toFixed(1) }])),
  };
  console.log(JSON.stringify(out));
  return out;
}

export async function checkDailyPar(days = 60, startDate = '2026-01-01') {
  const [y, m, d] = startDate.split('-').map(Number);
  let sumM = 0, sumH = 0, inversions = 0, ties = 0;
  const invertedDates = [];
  for (let k = 0; k < days; k++) {
    const date = new Date(Date.UTC(y, m - 1, d + k)).toISOString().slice(0, 10);
    const par = await dailyPar(c, date);
    sumM += par.m; sumH += par.h;
    if (par.m > par.h) { inversions++; invertedDates.push({ date, ...par }); }
    else if (par.m === par.h) ties++;
  }
  const out = {
    kind: 'daily-par', days, startDate,
    avgMedium: Math.round(sumM / days), avgHard: Math.round(sumH / days),
    inversions, inversionRate: +(inversions / days).toFixed(4), ties, invertedDates,
  };
  console.log(JSON.stringify(out));
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('balance.mjs')) {
  const results = [];
  if (!DAILY_PAR || hasFlag('--games')) {
    for (const [a, b] of [
      ['hard', 'medium'], ['medium', 'easy'], ['hard', 'easy'],
      ['medium:lucky', 'medium:hollis'], ['medium:opal', 'medium:julian'],
    ]) results.push(await matchup(a, b));
  }
  if (DAILY_PAR > 0) results.push(await checkDailyPar(DAILY_PAR, arg('--start-date', '2026-01-01')));
  const json = arg('--json', null);
  if (json) fs.writeFileSync(json, JSON.stringify(results, null, 2));
}
