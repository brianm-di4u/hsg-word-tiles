// Computer opponents: fictional town archetypes (research/town-content.md §4), labelled fictional on screen.
export const PERSONAS = [
  { id: 'opal', name: 'Opal Vance', role: 'Bath attendant on the Row', level: 'easy', color: '#2A9D8F', line: 'Has a soft spot for bathhouse and spring words, and likes to land on Bathhouse Row.' },
  { id: 'hollis', name: 'Hollis Crane', role: 'Park ranger', level: 'medium', color: '#4E7D5B', line: 'Builds tight cross-plays along the board, favors park words, and watches the open springs.' },
  { id: 'lucky', name: '"Lucky" Delmar', role: 'Racetrack tout', level: 'medium', color: '#A9432C', line: 'Bets on the big squares and takes risks with the tiles he keeps.' },
  { id: 'julian', name: 'Maestro Julian Fitch', role: '1920s hotel orchestra leader', level: 'hard', color: '#2B4C9B', line: 'Reaches for long, sweeping words and keeps a balanced rack between turns.' },
];
// Declarative AI placement choreography keyed by persona id (W4-S1-02, WF-4 §1.2):
// scaled by G.settings.ai (Normal 1.0x, Fast 0.45x, Instant 0x) and bypassed under reduced().
export const PERSONA_MOTION = Object.freeze({
  opal:   Object.freeze({ stagger: 105, lift: 1.6, roll: 0,    crescendo: 0 }),
  hollis: Object.freeze({ stagger: 95,  lift: 2.0, roll: 0,    crescendo: 0 }),
  lucky:  Object.freeze({ stagger: 68,  lift: 2.1, roll: 0.08, crescendo: 0 }),
  julian: Object.freeze({ stagger: 80,  lift: 2.5, roll: 0,    crescendo: 110 }),
});
export const personaMotion = (id) => PERSONA_MOTION[id] || PERSONA_MOTION.hollis;
export const persona = (id) => PERSONAS.find((p) => p.id === id) || null;
export const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
// What each level means, shown under the Difficulty choice in the setup sheet. A seat's level is its own
// choice: it starts at the character's usual level and can be set to any of the three.
export const LEVEL_BLURB = {
  easy: 'Plays everyday words, and now and then misses a better one. A gentle game.',
  medium: 'Knows the common words and all the short ones, and plays its best. A fair game.',
  hard: 'Knows every word in the book, keeps a good rack and guards the Boiling Springs. A hard game.',
};
export const seatLevel = (seat) => (seat.level && LEVEL_NAME[seat.level] ? seat.level : persona(seat.persona).level);
// Seat colours for humans (Okabe-Ito, colour-blind safe), always shown with a monogram and seat number.
export const HUMAN_COLORS = ['#B07A12', '#8E3622', '#6A4C93', '#355E41'];
