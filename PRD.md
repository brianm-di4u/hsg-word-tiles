# Bathhouse Letters: product requirements

## 1. Vision and pillars
An original crossword word-tile game for 1–4 players, set among the hot springs of Hot Springs,
Arkansas. Players build crossing words on a marble bathhouse board whose premium squares are the
valley's springs, and earn extra points for Hot Springs words, each of which opens a sourced fact card.
1. **Our own game.** An original board (47 springs swirling from the Display Spring, 8 Bathhouse Row
   squares), a tile set computed from the dictionary, our own scoring bonuses and rules text. No
   commercial game's name, board, tile table, art or wording.
2. **Elegant, not kitsch.** Marble, brass, terrazzo and stained glass from the real bathhouses;
   Art Deco type; steam that drifts, never clutters. Bathhouse Barons is the quality bar.
3. **The town in every word.** Bonus words, plaques and the Register teach real, cited history.
4. **Plays well on a phone.** Portrait-first layout, 44 px targets, zoom and loupe for placing tiles.
5. **Fair, lively opponents.** Three AI levels that play real words at measured strength.

## 2. Target players
Casual word-game players (12+), families, local-history fans, daily-puzzle players.

## 3. Modes
- **Play:** 2–4 seats, each Human or AI (persona and level). One human with AI = solo. Two or more
  humans = pass-and-play with a privacy screen.
- **Daily Soak:** one player, 10 turns, the same tiles for everyone on a date; best score and streak.
- Options: AI speed (Normal / Fast / Instant), hints on/off (3 "Spring Guide" hints per game in Play).

## 4. Rules
As specified in `MECHANICS.md` §3 (placement, words, scoring, bonuses, swaps, ending), shown in the
help screen in our own words with diagrams.

## 5. Hot Springs content map
| Where | Content | Source |
|---|---|---|
| Board | 47 springs (46 premium squares + Display Spring); 8 Bathhouse Row squares with building motifs | `research/town-content.md` §1–2 |
| Bonus words | 70 entries / 184 forms in 6 categories, each with a fact card | `data/thermal-words.json`, §3 |
| Featured Springs | 3 bonus words per game on steam-fogged plaques | same |
| Register | every bonus word you've played, with its card | same |
| Opponents | 4 fictional town archetypes | §4 |
| Title, help, about | Valley of Vapors, Display Spring at 143°F, the sources list | §1, `SAMPLES.md` |

## 6. Screens and flow
Title → (Continue | New game → Setup | Daily Soak | Register | How to play | Settings | About) →
Game (pause menu: resume, how to play, settings, quit) → Game over (scores, best word, bonus words,
Featured Springs, new game / title). Daily → Daily results (score, words, streak, best).

## 7. Art direction
- Day theme from `gilded-spa`, night theme from `deco-neon`, springs from `thermal-water`.
- Board: polished white marble slab with gray veining, brass inlay grid, terrazzo border, set on a
  bathhouse counter (walnut and marble) in 3D, lit by a warm lamp.
- Premium squares: leaded stained-glass medallions (Warm/Hot turquoise-teal glass, Steam/Boiling amber-copper
  glass), each with its label and a distinct pattern (ring count) so colour is never the only cue.
- Bathhouse Row squares: one small medallion per building (motifs in town-content §2).
- Tiles: glazed ivory ceramic with a bevel, Fraunces letters in wrought-iron black-green, value in
  the corner; blanks are clear "steam glass" tiles with a ghosted letter.
- Painted art (Codex, pilot first): title painting, counter texture, persona portraits, Register
  ledger, steam sprites; 31 landmark vignettes reused from Barons for fact cards.
- Type: Limelight (display), Fraunces (tiles, headings), Josefin Sans (UI). All OFL, vendored.

## 8. Audio
WebAudio synthesis: ceramic tile clicks, rack shuffle, a soft steam hiss for bonus words, a brass chime
for Full Soak, a bell for a Featured Spring, an error thunk. Quiet by default, volume slider, mute.

## 9. Accessibility
Keyboard-only play; visible focus; text contrast ≥ 4.5:1; premium squares labelled and patterned;
`prefers-reduced-motion` honoured plus a Motion setting; text size setting (100 / 115 / 130 %); a live
region announcing each play ("Opal played SPRING for 24, Hot Springs bonus 15").

## 10. Performance
60 fps on a mid-range laptop; idle frame cost ≤ 8 ms, drag ≤ 12 ms; `index.html` ≤ 2 MB; interactive
(title buttons) ≤ 2 s; dictionary ready ≤ 1.5 s at 4× CPU throttle; AI move ≤ 250 ms (Easy/Medium)
and ≤ 1.2 s (Hard) at 4× throttle.

## 11. Acceptance criteria
### Board and tiles
1. The board is 15×15 with 46 premium squares (4 Boiling, 12 Steam, 8 Hot, 22 Warm), the Display Spring at the centre and 8 Bathhouse Row squares, each labelled.
2. The bag holds 98 tiles: the counts in `tiles.js` and 2 blanks; tile values show on every tile.
3. Each player starts with 7 tiles; racks refill to 7 after a play while tiles remain.

### Placement and validation
4. A play must be in one line, without gaps, connected (or covering the centre with ≥ 2 tiles first); each illegal case is refused with a specific message and the player keeps the turn.
5. Every word formed (main and cross words) must be in the dictionary; an invalid play is refused, naming the word.
6. Blanks ask for a letter, show it ghosted, and score 0.
7. While staging, a live preview shows the words formed, the score, and whether the play is valid.

### Scoring
8. Letter and word premiums apply only to squares covered in that play.
9. Playing all 7 tiles adds 40 (Full Soak).
10. Each Hot Springs bonus word formed adds its tier bonus (10/15/25), doubled when a new tile in it covers a Bathhouse Row square.
11. Forming a Featured Spring adds 30 once per game and reveals it.
12. Engine scores match an independent reference scorer on 50,000 random plays.

### Turns and ending
13. Swap 1–7 tiles when the bag has ≥ 7; the turn passes; swapped tiles go to the bag bottom.
14. Pass ends the turn.
15. The game ends when a player goes out on an empty bag or after two scoreless rounds; rack penalties and the go-out bonus apply.
16. The game-over screen shows final scores, winner(s), each player's best word and the bonus words played.

### Modes
17. Setup offers 2–4 seats, each Human or AI with level and persona; names are editable.
18. With two or more humans, a privacy screen hides the next player's rack until they tap.
19. Daily Soak deals the same tiles for the same date on any device, lasts 10 turns, and stores the best score and streak.
20. Continue resumes the saved game exactly after a reload.

### AI
21. AI plays only legal moves (every AI move in 2,000 self-play games passes the engine check).
22. Easy plays only common words; Hard beats Medium in ≥ 70 % and Medium beats Easy in ≥ 75 % of 2-player games.
23. AI turns never block the UI (Web Worker; in-thread fallback works when Workers are unavailable).
24. Hints (3 per game in Play) show a strong legal move on the board.

### Hot Springs content
25. Every bonus word opens a fact card with its source; every card passes `check-facts`.
26. Featured Spring plaques show category, length and one letter, and clear one more letter each round.
27. The Bathhouse Register lists every bonus word played, with date, best score and the card.
28. All bonus forms are dictionary words; no blocklisted word is playable.

### Presentation
29. Title, setup, game, help, settings, register, about, pause, game over and daily screens exist and look finished at 1280×800 and 390×844 with no overlap, clipping or horizontal scroll.
30. The 3D board renders with lighting and shadows on a GPU, and the 2D fallback renders the same board when WebGL is unavailable or `?gl=0`.
31. Day and night themes; every text passes contrast in both.
32. Tiles animate into place, scores roll up, bonus words release steam and a toast; reduced motion removes the motion but keeps the feedback.
33. Sound effects play on the listed events and respect mute and volume.

### Input and accessibility
34. Mouse drag-and-drop, touch drag-and-drop, and tap-to-place all work; touch targets are ≥ 44 px on mobile.
35. On a phone the board zooms for placement and a loupe shows the target square; pinch and pan work.
36. The whole game is playable with the keyboard alone.
37. A live region announces each play.
38. The game works with `localStorage` unavailable (no crash; nothing saved).

### Technical
39. No network requests; no console errors; works from `file://` (3D included).
40. `index.html` ≤ 2 MB; performance budgets in §10 are met (or the gap is reported).

## 12. Out of scope
Online multiplayer, accounts, leaderboards, word definitions, challenge mode, timed games,
languages other than English, custom dictionaries.
