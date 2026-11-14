// What the town says over a game. Eight moments per character, six lines each: the first turn, a play over BIG_PLAY
// points, a Full Soak, a Hot Springs word, a pass or swap, going out, winning and losing. The lines carry no facts about
// the real world. No DOM.
export const BIG_PLAY = 30;
export const SHORT = { opal: 'Opal', hollis: 'Hollis', lucky: 'Lucky', julian: 'Julian' };
export const BARKS = {
  opal: {
    open: ["Fresh towels are out. Let's begin.", 'Warm water, warm tiles. Good luck, dear.', 'Mind the steam, it fogs the glasses.', 'Another busy morning on the Row.', "Take your time. The tubs aren't going anywhere.", "I'll keep the water hot. You bring the words."],
    big: ["Now that's a proper soak.", 'Hot towels all round for that one.', 'Filled the tub right to the brim.', 'That one rinsed clean off the board.', 'Not bad for a tired pair of hands.', 'Plenty of steam in that word.'],
    soak: ['Seven tiles! The whole tub at once.', 'Every towel off the shelf. A Full Soak!', "I've emptied the rack and my arms are tired.", 'A full tub, and not a drop spilled.', 'Seven at once. Bring me a cup of tea.', 'That one will be talked about at the front desk.'],
    themed: ['A word the springs would know.', 'That one smells of warm minerals.', 'Hot water in the tiles at last.', 'Steam and stone, just as it should be.', 'Now the bath is properly drawn.', 'That belongs on the Row.'],
    pass: ["Nothing fits. I'll fold some towels.", 'Not this turn. The kettle wants me.', 'No tub free for that rack.', "I'll wait a minute and let it steam.", 'Let me think it over with a warm cup.', 'Not this time, dear.'],
    out: ["That's my last tile. Towels down!", 'Out! Time to wipe the tubs.', 'All tiles gone. Closing time at last.', "Rack's empty. I'll put the kettle on.", 'Done and dried. Well played, all.', "That's the last of mine. Lovely game."],
    win: ['A good soak for me today. Thank you, dear.', 'Well played. Take a warm towel for the road.', 'I won! Mind, the water did most of it.', 'The tubs are mine this time. Come again.', 'That was a gentle one. Same again tomorrow?', 'Lucky me. Tea is on the house.'],
    lose: ["Well done. You've earned a long soak.", "You win, dear. I'll fetch the towels.", 'Oh, you were quick today. Lovely play.', 'Next time the tubs are mine.', 'Good game. The water was kind to you.', 'Beaten fair and square. Go and warm up.'],
  },
  hollis: {
    open: ["Trail's clear. Let's see what the board holds.", 'Good light today. A good day for words.', 'Quiet out there. I like a quiet board.', 'Short words, steady steps.', "Map's open. Your move whenever.", "I'll keep to the marked path."],
    big: ["That's a good view from the ridge.", 'Found a way over the hill.', 'Steep climb, worth it.', 'Sound footing on that one.', 'A long walk, and a fine word at the end.', 'That one blazed a new trail.'],
    soak: ["All seven. I'll be out here a while.", 'Seven tiles, one clean trail. Full Soak.', "Empty rack. Don't tell the other rangers.", 'The whole pack unloaded at the summit.', 'Every tile used, nothing left on the trail.', "That's a full day's hike in one go."],
    themed: ['A local word. The ground knows it.', 'That one belongs to the valley.', 'Warm springs, right where I left them.', "A word you'd find on a trail sign.", "Good to see the town's own words out.", "That came up from the ground, I'd say."],
    pass: ["No clear path. I'll hold here.", "I'll wait out the weather.", 'Nothing worth the climb this turn.', 'Pausing to check the map.', 'Still looking for a footing.', 'Not this turn.'],
    out: ["Last tile down. That's the trailhead.", 'Out. Back to camp.', "Rack's empty. Good hike, everyone.", "That's me done. Nice walking with you.", 'Out of tiles, out of daylight.', 'All set down. Thanks for the company.'],
    win: ['Good hike. I reached the top first.', 'Steady wins it. Thanks for the game.', 'Won by a short head. Good trail, friend.', "That's the summit. Well walked.", 'A fair game, and a fair finish.', "I'll take it. Back to the ranger hut."],
    lose: ['You took the high ground. Well played.', 'Good game. You read the trail better.', 'You beat me to the ridge. Nicely done.', "Fair finish. I'll walk it off.", 'You earned that one.', 'I lost the trail late. Well played.'],
  },
  lucky: {
    open: ["Folks, I've got a feeling about this one.", "Place your bets. I'm backing the Boiling Springs.", "The odds look sweet. Let's play.", 'Clean tiles, clean track. Off we go.', 'Ten to one I find a good square.', 'I never bet on a slow start.'],
    big: ['Pays at long odds, that one!', 'I told you. Money on the big square.', 'Down the stretch and over the line!', "That's a winner, folks, no photo needed.", 'Big square, big payout.', 'Put that in the books at a fine price.'],
    soak: ['Seven tiles! The whole card, every race!', 'Full Soak! Pay the man at the window.', "A clean sweep. I'll take the pot.", 'All seven home, and not a scratch.', "That's the long shot of the day, folks.", 'Never saw it coming, and I called it.'],
    themed: ['A sure thing from the springs, folks.', 'Hot tip, hot word. Both came in.', 'The town word paid at the window.', "That one's a local favourite.", 'I had that word at good odds.', "Steam rising. That's a good sign."],
    pass: ["No bet this race. I'll sit it out.", "The odds aren't right. Not this turn.", "I'm scratching this turn.", 'Even I know when to hold.', 'Waiting for a better price.', 'Nothing worth a wager yet.'],
    out: ['Last tile! Past the post!', "I'm out, folks. Collect your tickets.", "That's the final furlong. Done.", 'Rack empty, pockets full.', 'Out, and the crowd goes quiet.', "That's my last tile. Good racing."],
    win: ['A winner! Drinks are on someone else.', "Told you I'd pick it. Thanks for the race.", 'First past the post, friend. Good game.', 'The odds were with me this time.', 'Another ticket cashed. Same again?', 'Lucky? No, just well placed.'],
    lose: ["You won it fair. I'll take the loss.", 'Hats off. You rode that well.', 'Well, you took the purse. Good ride.', "Next race I'll pick better.", 'A good horse beat me. Good game.', 'You beat the odds, friend.'],
  },
  julian: {
    open: ['Downbeat, please. A gentle tempo to begin.', 'Count us in. One, two, three, four.', 'Let the first bar set the key.', "Keep time, friends, and we'll all play well.", 'A nice steady rhythm tonight.', 'Tune up. The house is waiting.'],
    big: ['A fine crescendo!', 'That one swings.', 'On the beat, and then some.', 'Brass up front for that word.', 'A bar to remember.', 'Syncopation, my friend. It scores.'],
    soak: ['All seven! A full orchestra on the board.', 'The whole band at once. Full Soak!', 'Every instrument plays. Encore!', "A grand finale, and it's only the middle.", 'Seven voices in perfect harmony.', 'Rack empty. Take a bow, Julian.'],
    themed: ['A local melody. The room hums it.', "That word has the town's rhythm.", 'A tune the whole valley knows.', 'Steam and strings, a lovely pairing.', "That's straight from the ballroom.", 'A theme worth repeating.'],
    pass: ['A rest. Even a band must breathe.', "I'll sit out this bar.", "Nothing to play, so I'll keep time.", 'A pause for the clarinets.', 'Holding the tempo. Not this turn.', 'Rests make the music, friends.'],
    out: ["Final bar! That's the last note.", 'Out. The band takes its bow.', 'Last tile down. Curtain, please.', 'The final chord, my friends.', 'Rack clear. Cue the applause.', 'And that is the last of my tiles.'],
    win: ["Applause, please. A fine evening's work.", 'The band wins. Thank you, thank you.', 'A rousing finish for the maestro.', 'Tempo kept, game won. Bravo, all.', "Encore? I'd be delighted.", 'Good game. The last note was mine.'],
    lose: ['You took the solo. Bravo.', 'A lovely finish. I tip my hat.', 'You kept better time tonight.', 'Well played. The encore is yours.', 'Applause for you, friend.', "I'll practise. You earned that bar."],
  },
};
const EVENTS = Object.keys(BARKS.opal);
const mix = (a, b) => { let h = (a ^ Math.imul(b + 0x9e3779b9, 0x85ebca6b)) >>> 0; h = Math.imul(h ^ (h >>> 15), 0xc2b2ae35) >>> 0; return (h ^ (h >>> 13)) >>> 0; };
const seedOf = (s) => (s.seed != null ? s.seed : s.rng.bag) >>> 0;
const base = (s, p, event) => mix(mix(seedOf(s), EVENTS.indexOf(event)), p.persona.length * 31 + p.persona.charCodeAt(0));
const kindOf = (s, e, last) => {
  if (e.kind !== 'play') return 'pass';
  if (last && s.over && s.result && s.result.why === 'out' && s.result.out === e.p) return 'out';
  if (e.full) return 'soak';
  if (e.themed || e.featured) return 'themed';
  return e.score > BIG_PLAY ? 'big' : null;
};
// The line a computer seat says after the move `entry` (an entry of s.log), or null when the seat is not a character or
// the move calls for nothing. It is picked from the game's seed, the character, the moment and how often that moment has
// come up for this seat: a replay says the same things, and no line comes back before all six have been heard.
export function barkFor(s, entry) {
  const p = s.players[entry.p], lines = p && p.persona && BARKS[p.persona];
  if (!lines) return null;
  const mine = s.log.filter((e) => e.p === entry.p && e.kind !== 'end');
  const at = mine.indexOf(entry);
  const earlier = at < 0 ? mine : mine.slice(0, at);
  let event = kindOf(s, entry, at < 0 || at === mine.length - 1);
  if (!event && !earlier.length) event = 'open';
  if (!event) return null;
  const prior = earlier.filter((e) => kindOf(s, e, false) === event).length;
  const list = lines[event];
  return { event, text: list[(base(s, p, event) + prior) % list.length] };
}
// What a computer seat says when the game is over: its 'win' line if it finished first (or tied), its 'lose' line otherwise.
export function endBark(s, seat) {
  const p = s.players[seat], lines = p && p.persona && BARKS[p.persona];
  if (!lines || !s.result) return null;
  const event = s.result.winners.includes(seat) ? 'win' : 'lose', list = lines[event];
  return { event, text: list[base(s, p, event) % list.length] };
}
