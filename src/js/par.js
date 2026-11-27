// The par for a Daily Soak: what a computer player scores on the same tiles. No DOM.
// Medium and Hard play their best move every turn from the seeded bag, so a date has one answer for each (exact: true keeps the
// tied plays in their fixed order: the computers on the board vary their choice among near ties, the par does not). When a computer
// swaps, its tiles still go to the end of the bag (swapToEnd, W1-S2-03), so the par of every date stays what it was.
import { createGame, apply } from './engine.js';
import { chooseAction } from './ai.js';

// The characters whose scores stand as par: Hollis Crane (Medium) and Maestro Julian Fitch (Hard). They play the tiers par was set
// with (`tier`, ai.js PAR_LEVELS), so the 2026-11 difficulty ladder leaves the par of every date as it was.
export const PAR_SEATS = [{ key: 'm', persona: 'hollis', level: 'medium', tier: 'parMedium' }, { key: 'h', persona: 'julian', level: 'hard', tier: 'parHard' }];

// Plays the whole Daily for `date` as one computer seat and returns its score. `pause` (optional, async) runs between turns
// so a caller can let the screen paint.
export async function dailyScore(c, date, seat, pause) {
  const s = createGame({ mode: 'daily', date, seats: [{ kind: 'human', name: 'You' }] }, c.lex);
  s.players[0].level = seat.level;
  const rules = { dict: c.dict, lex: c.lex, swapToEnd: true };
  for (let n = 0; !s.over && n < 40; n++) {
    const { action } = chooseAction(c.dict, c.lex, s, { level: seat.tier || seat.level, persona: seat.persona, exact: true, plaques: false });
    if (!apply(s, action, rules).ok) apply(s, { type: 'pass' }, rules);
    if (pause && !s.over) await pause();
  }
  return s.players[0].score;
}

export async function dailyPar(c, date, pause) {
  const par = {};
  for (const seat of PAR_SEATS) par[seat.key] = await dailyScore(c, date, seat, pause);
  return par;
}
