// The player's records (key hs-letters-stats-v1): games, wins, bests and streaks for games against the computer,
// and a line for the Daily Soak. Pure data, no DOM. A record is read field by field, so one damaged number never
// costs the others, and nothing here ever lowers a stored figure.
const plain = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
const count = (x) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
const best = (x) => (plain(x) && typeof x.word === 'string' && x.word.length <= 20 && typeof x.score === 'number' && Number.isFinite(x.score) && x.score > 0
  ? { word: x.word, score: Math.floor(x.score) } : null);
const oppRow = (x) => (plain(x) ? { games: count(x.games), wins: count(x.wins), best: count(x.best), total: count(x.total) } : { games: 0, wins: 0, best: 0, total: 0 });

export const emptyStats = () => ({
  v: 1, games: 0, wins: 0, ties: 0, totalScore: 0, bestScore: 0, bestWord: null, bestPlay: null,
  fullSoaks: 0, featured: 0, themed: 0, hints: 0, streak: 0, bestStreak: 0, opp: {}, daily: { games: 0, best: 0, bestStreak: 0 },
});

// Anything stored becomes a clean record: wrong types fall back to zero, an unknown shape to an empty record.
export function cleanStats(raw) {
  const out = emptyStats();
  if (!plain(raw)) return out;
  for (const k of ['games', 'wins', 'ties', 'totalScore', 'bestScore', 'fullSoaks', 'featured', 'themed', 'hints', 'streak', 'bestStreak']) out[k] = count(raw[k]);
  out.bestWord = best(raw.bestWord); out.bestPlay = best(raw.bestPlay);
  if (plain(raw.opp)) for (const [k, v] of Object.entries(raw.opp)) if (/^[a-z]+:[a-z]+$/.test(k)) out.opp[k] = oppRow(v);
  if (plain(raw.daily)) out.daily = { games: count(raw.daily.games), best: count(raw.daily.best), bestStreak: count(raw.daily.bestStreak) };
  return out;
}

// How many Spring Guide hints a seat has taken: its allowance of three less what is left (none where hints were off).
// A seat with unlimited hints (`unl`) counts them as it goes in `taken`.
export const hintsUsed = (p) => (p.unl ? Math.max(0, Math.floor(p.taken) || 0) : p.hints == null ? 0 : Math.max(0, 3 - p.hints));

// The Daily Soak streak. Playing the day after the last one adds a day. One missed day is forgiven by a rest day, which can
// be used once in any seven days (`rest` holds the date it was last used, so it is saved with the daily record).
// Returns { streak, rest, rested } for playing on `date` with `d` = { streak, last, rest }.
export const REST_EVERY = 7;   // days that must pass before another rest day can be used
const dayNumber = (date) => { const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(date || ''); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) / 86400000 : NaN; };
export function nextStreak(d, date) {
  const gap = dayNumber(date) - dayNumber(d.last), rest = typeof d.rest === 'string' ? d.rest : null;
  const spare = rest == null || !(dayNumber(date) - dayNumber(rest) < REST_EVERY);
  if (gap === 1) return { streak: (d.streak || 0) + 1, rest, rested: false };
  if (gap === 2 && spare && (d.streak || 0) > 0) return { streak: d.streak + 1, rest: date, rested: true };
  return { streak: 1, rest, rested: false };
}

export const oppKey = (p) => `${p.persona}:${p.level || 'medium'}`;

// Folds one finished game into the record. Returns { stats, pb } where pb says what the game set:
// { first, score, play, word, held } (booleans), the first four's records true only when beaten in a game that is not the first.
// A game in which the player took a hint counts as a game and a win but sets no best (`held` says it would have set one).
// Games with no computer opponent or with two or more people are left out: the record is the player's own against the town.
export function applyGame(prev, s) {
  const humans = s.players.filter((p) => p.kind === 'human');
  const bots = s.players.filter((p) => p.kind === 'ai' && p.persona);
  const st = cleanStats(prev);
  if (s.mode !== 'play' || humans.length !== 1 || !bots.length || !s.result) return { stats: st, pb: null };
  const k = s.players.indexOf(humans[0]), me = humans[0];
  const won = s.result.winners.includes(k), tied = won && s.result.winners.length > 1;
  const pb = { first: st.games === 0, score: false, play: false, word: false, held: false };
  const aided = hintsUsed(me) > 0 || !!me.unl;   // unlimited hints keep a game out of the bests whether or not one was taken
  st.games++; st.totalScore += me.score;
  if (won && !tied) { st.wins++; st.streak++; st.bestStreak = Math.max(st.bestStreak, st.streak); }
  else { if (tied) st.ties++; st.streak = 0; }
  if (me.score > st.bestScore) { if (aided) pb.held = !pb.first; else { pb.score = !pb.first; st.bestScore = me.score; } }
  const plays = s.log.filter((e) => e.kind === 'play' && e.p === k);
  const top = plays.reduce((a, e) => (!a || e.score > a.score ? e : a), null);
  if (top && top.score > (st.bestPlay ? st.bestPlay.score : 0)) { if (aided) pb.held = !pb.first; else { pb.play = !pb.first; st.bestPlay = { word: top.words[0].w, score: top.score }; } }
  if (me.best && me.best.score > (st.bestWord ? st.bestWord.score : 0)) { if (aided) pb.held = !pb.first; else { pb.word = !pb.first; st.bestWord = { word: String(me.best.word).slice(0, 20), score: me.best.score }; } }
  st.fullSoaks += plays.filter((e) => e.full).length;
  st.themed += plays.reduce((a, e) => a + e.words.filter((w) => w.themed).length, 0);
  st.featured += s.featured.filter((f) => f.by === k).length;
  st.hints += hintsUsed(me);
  for (const b of bots) {
    const row = st.opp[oppKey(b)] || oppRow(null);
    row.games++; row.total += me.score;
    if (me.score > b.score) row.wins++;
    row.best = Math.max(row.best, me.score);
    st.opp[oppKey(b)] = row;
  }
  return { stats: st, pb };
}

// The Daily Soak: one line, fed from the daily record's own totals.
export function applyDaily(prev, score, streak) {
  const st = cleanStats(prev);
  st.daily.games++; st.daily.best = Math.max(st.daily.best, score); st.daily.bestStreak = Math.max(st.daily.bestStreak, streak);
  return st;
}
