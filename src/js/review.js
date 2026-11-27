// Looking back over a finished game: for each turn the person took, the best score their rack could have made on the board as it
// stood. The racks come from the log (engine.js writes each turn's rack into its entry); a game saved before that was added is
// skipped turn by turn. The count is of points only: it knows nothing of what a play leaves on the rack.
import { generateMoves } from './movegen.js';
import { N, findWords } from './score.js';
import { casualAudience, isTeachableWord } from './ai.js';

export const MIN_MISS = 5;     // a shortfall smaller than this is not listed
export const MAX_LISTED = 3;   // how many of the biggest misses the results sheet lists
// How far one turn's search may go: in the worker well past any turn met (two blanks on an open board, about 720,000), on the page itself
// (no worker) far enough for every turn with one blank and short enough not to hold the screen. A search that was cut is `partial`.
export const REVIEW_NODES = 2e6;
export const REVIEW_NODES_MAIN = 300000;

// the seat to review: the one person in a game against the computer (or a Daily Soak); null when there is not exactly one, or no turn can be read
export function reviewSeat(s) {
  const people = s.players.map((p, k) => (p.kind === 'human' ? k : -1)).filter((k) => k >= 0);
  if (people.length !== 1) return null;
  const k = people[0];
  return s.log.some((e) => e.kind !== 'end' && e.p === k && typeof e.rack === 'string' && e.rack) ? k : null;
}

// where a play goes: the square its main word starts on and which way the word runs
const placeOf = (board, tiles) => { const w = findWords(board, tiles).words[0]; return { at: w.cells[0], dir: w.cells[1] - w.cells[0] === 1 ? 'across' : 'down' }; };

// the turns of that seat, one at a time: what was done, and the board, rack and readable plaques it was done with (plain data, for the worker)
export function* reviewTurns(s, seat) {
  const board = new Array(N * N).fill(null);
  const casual = casualAudience(s);
  let turn = 0;
  for (const e of s.log) {
    if (e.kind === 'end') continue;
    if (e.p === seat) {
      turn++;
      if (typeof e.rack === 'string' && /^[A-Z?]{1,7}$/.test(e.rack)) {
        // W1-S3-02, W6-S3-02 / CD-WF1-06: a Featured Spring counts only on the turns its plaque could be worked out (engine.js writes those
        // into the entry as `known`; a game saved before that has none), never one that was still hidden.
        // W1-S3-06 / CD-WF1-05: Easy/Medium games prefer teachable everyday and Hot Springs misses over obscure ENABLE words.
        const featured = Array.isArray(e.known) ? s.featured.filter((f) => e.known.includes(f.word)).map((f) => ({ ...f, by: null })) : [];
        const did = { turn, kind: e.kind, word: e.kind === 'play' ? e.words[0].w : null, score: e.score, casual };
        if (e.kind === 'pass' && typeof e.challenge === 'string' && e.challenge) did.challenge = e.challenge;   // a Challenge turn lost to a word that is not one
        yield { did, board, rack: [...e.rack], featured, casual };
      } else yield { turn, skipped: true };
    }
    if (e.kind === 'play') for (const t of e.tiles) board[t.i] = { l: t.l, blank: !!t.blank };
  }
}

// the best play of one of those turns: { best: { word, score, at, dir } or null, and partial when the search was cut short }
export function bestOf(dict, lex, q, budget = REVIEW_NODES) {
  const { moves, stopped } = generateMoves(dict, q.board, q.rack, { lex, featured: q.featured, budget });
  const m = (q.casual && moves.find((x) => x.words.every((w) => isTeachableWord(dict, lex, w)))) || moves[0] || null;
  return { best: m ? { word: m.words[0], score: m.score, ...placeOf(q.board, m.tiles) } : null, ...(stopped ? { partial: true } : {}) };
}

// one result per turn of that seat, all here (the page asks the worker turn by turn instead: aiclient.js aiReview)
export function* reviewSteps(s, seat, dict, lex, budget) {
  for (const q of reviewTurns(s, seat)) yield q.skipped ? q : { ...q.did, ...bestOf(dict, lex, q, budget) };
}

export function summarize(steps) {
  // a search that was cut short can show that a better play was there, never that there was none
  const unsure = (x) => !x.skipped && x.partial && !(x.best && x.best.score > x.score);
  const read = steps.filter((x) => !x.skipped && !unsure(x));
  const found = read.filter((x) => !x.best || x.score >= x.best.score).length;
  const misses = read.filter((x) => x.best && x.best.score - x.score >= MIN_MISS)
    .map((x) => ({ ...x, gap: x.best.score - x.score }))
    .sort((a, b) => b.gap - a.gap || a.turn - b.turn).slice(0, MAX_LISTED);
  return { total: read.length, found, misses, skipped: steps.filter((x) => x.skipped).length, cut: steps.filter(unsure).length, casual: read.some((x) => x.casual) };
}
