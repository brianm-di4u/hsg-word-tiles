// The par for a Daily Soak: what a computer player scores on the same tiles. No DOM.
// Medium and Hard play their best move every turn from the seeded bag, so a date has one answer for each.
import { createGame, apply } from './engine.js';
import { chooseAction } from './ai.js';

// The characters whose scores stand as par: Hollis Crane (Medium) and Maestro Julian Fitch (Hard).
export const PAR_SEATS = [{ key: 'm', persona: 'hollis', level: 'medium' }, { key: 'h', persona: 'julian', level: 'hard' }];

// Plays the whole Daily for `date` as one computer seat and returns its score. `pause` (optional, async) runs between turns
// so a caller can let the screen paint.
export async function dailyScore(c, date, seat, pause) {
  const s = createGame({ mode: 'daily', date, seats: [{ kind: 'human', name: 'You' }] }, c.lex);
  s.players[0].level = seat.level;
  for (let n = 0; !s.over && n < 40; n++) {
    const { action } = chooseAction(c.dict, c.lex, s, { level: seat.level, persona: seat.persona });
    if (!apply(s, action, c).ok) apply(s, { type: 'pass' }, c);
    if (pause && !s.over) await pause();
  }
  return s.players[0].score;
}

export async function dailyPar(c, date, pause) {
  const par = {};
  for (const seat of PAR_SEATS) par[seat.key] = await dailyScore(c, date, seat, pause);
  return par;
}
