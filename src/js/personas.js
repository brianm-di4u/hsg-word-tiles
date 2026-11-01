// Computer opponents: fictional town archetypes (research/town-content.md §4), labelled fictional on screen.
export const PERSONAS = [
  { id: 'opal', name: 'Opal Vance', role: 'Bath attendant on the Row', level: 'easy', color: '#2A9D8F', line: 'Plays the plain, everyday words.' },
  { id: 'hollis', name: 'Hollis Crane', role: 'Park ranger', level: 'medium', color: '#4E7D5B', line: 'Knows the common words and every short one.' },
  { id: 'lucky', name: '"Lucky" Delmar', role: 'Racetrack tout', level: 'medium', color: '#A9432C', line: 'Bets on the big squares.' },
  { id: 'julian', name: 'Maestro Julian Fitch', role: '1920s hotel bandleader', level: 'hard', color: '#2B4C9B', line: 'Knows every word in the book and keeps a tidy rack.' },
];
export const persona = (id) => PERSONAS.find((p) => p.id === id) || null;
export const LEVEL_NAME = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };
// Seat colours for humans (Okabe-Ito, colour-blind safe), always shown with a monogram and seat number.
export const HUMAN_COLORS = ['#B07A12', '#8E3622', '#6A4C93', '#355E41'];
