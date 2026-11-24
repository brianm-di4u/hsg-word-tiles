// Looking back over a finished game: for each turn the person took, the best score their rack could have made on the board as it
// stood. The racks come from the log (engine.js writes each turn's rack into its entry); a game saved before that was added is
// skipped turn by turn. The count is of points only: it knows nothing of what a play leaves on the rack.
import { generateMoves } from './movegen.js';
import { N } from './score.js';

export const MIN_MISS = 5;     // a shortfall smaller than this is not listed
export const MAX_LISTED = 3;   // how many of the biggest misses the results sheet lists

// the seat to review: the one person in a game against the computer (or a Daily Soak); null when there is not exactly one, or no turn can be read
export function reviewSeat(s) {
  const people = s.players.map((p, k) => (p.kind === 'human' ? k : -1)).filter((k) => k >= 0);
  if (people.length !== 1) return null;
  const k = people[0];
  return s.log.some((e) => e.kind !== 'end' && e.p === k && typeof e.rack === 'string' && e.rack) ? k : null;
}

// one result per turn of that seat, computed one at a time so the page can breathe between them
export function* reviewSteps(s, seat, dict, lex) {
  const board = new Array(N * N).fill(null);
  let turn = 0;
  for (const e of s.log) {
    if (e.kind === 'end') continue;
    if (e.p === seat) {
      turn++;
      if (typeof e.rack === 'string' && /^[A-Z?]{1,7}$/.test(e.rack)) {
        // W1-S3-02 / CD-WF1-06: post-game review never peeks at hidden Featured Spring words for +30 equity.
        const best = generateMoves(dict, board, [...e.rack], { lex, featured: [] }).moves[0] || null;
        yield { turn, kind: e.kind, word: e.kind === 'play' ? e.words[0].w : null, score: e.score, best: best ? { word: best.words[0], score: best.score } : null };
      } else yield { turn, skipped: true };
    }
    if (e.kind === 'play') for (const t of e.tiles) board[t.i] = { l: t.l, blank: !!t.blank };
  }
}

export function summarize(steps) {
  const read = steps.filter((x) => !x.skipped);
  const found = read.filter((x) => !x.best || x.score >= x.best.score).length;
  const misses = read.filter((x) => x.best && x.best.score - x.score >= MIN_MISS)
    .map((x) => ({ ...x, gap: x.best.score - x.score }))
    .sort((a, b) => b.gap - a.gap || a.turn - b.turn).slice(0, MAX_LISTED);
  return { total: read.length, found, misses, skipped: steps.length - read.length };
}
