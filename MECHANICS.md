# Bathhouse Letters: core mechanics

## 1. Game loop
Turn-based, no clock. A turn is one action by the current player: **play**, **swap** or **pass**.
Humans stage tiles on the board (staging is UI state, never in the engine), see a live preview of the
words and score, then play. AI turns are computed in a Web Worker and shown after a short "thinking"
pause (700 ms minimum, Fast/Instant settings shorten it). The renderer only draws when something changes
(render on demand); ambient steam runs its own light loop that `isIdle()` ignores.

## 2. State (one serializable object)
```js
{
  v: 1, mode: 'play' | 'daily', seed, rng: { bag, ai },           // mulberry32 states
  board: [225] null | { l: 'A'..'Z', blank: bool, p: seat, t: move# },
  bag: ['E', '?', ...],                                             // bag[0] is drawn next; '?' = blank
  players: [{ name, kind: 'human' | 'ai', level, persona, rack: [...], score, best: {word, score} }],
  cur: seat, move: n, scoreless: n, over: false, result: null | { winners: [seat], ... },
  featured: [{ id, word, cat, shown: [letter indexes], by: null | seat, at: move }],
  log: [{ p, kind: 'play' | 'swap' | 'pass' | 'end', tiles, words: [{ w, score, bonus, themed }], score,
          full, themed, featured, n }],
  daily: null | { date, turns: 10 },
}
```
Racks are arrays of letters, `'?'` for a blank. A placed blank stores the letter it stands for and
`blank: true`.

## 3. Rules engine (`src/js/engine.js`, pure, no DOM)
- `createGame(opts)` → state: shuffles the 98-tile bag with `rng.bag`, picks 3 Featured Springs with
  the same stream, deals 7 tiles to each seat in seat order.
- `evaluate(state, tiles, ctx)` → `{ ok, error, words, score, full, themed, featured }` without changing
  anything. `ctx` = `{ dict, lex }`.
- `apply(state, action, ctx)` → `{ ok, error, entry }` and mutates `state` on success.
  Actions: `{ type: 'play', tiles: [{ i, l, blank }] }`, `{ type: 'swap', letters: [...] }`,
  `{ type: 'pass' }`.

### Placement legality (in this order; the first failure is the error shown)
1. 1–7 tiles, each from the player's rack (blanks need a letter A–Z), each on an empty square, no square twice.
2. All in one row or one column.
3. No gaps: every square between the first and last new tile is filled (new or existing).
4. First play of the game: covers the Display Spring (centre) and places at least 2 tiles.
   Later plays: at least one new tile touches an existing tile (orthogonally).
5. Words formed: the main word (all contiguous tiles along the line through the new tiles, ≥ 2 letters)
   and one cross word per new tile (perpendicular, ≥ 2 letters). A single new tile forms its row word
   and/or column word. At least one word must be formed.
6. Every formed word is in the dictionary. The error names the first word that isn't.

### Scoring
- Word score = Σ(letter value × letter multiplier) × word multiplier, where multipliers count only for
  squares covered by **this** play: Warm ×2 letter, Hot ×3 letter, Steam ×2 word, Boiling Spring ×3 word.
  Blanks score 0. The Display Spring and Bathhouse Row squares have no multiplier.
- Play score = Σ word scores + **Full Soak** +40 when all 7 rack tiles are played.
- **Hot Springs bonus**: each formed word that is a form in `data/thermal-words.json` adds its tier
  bonus (+10 / +15 / +25). If that word covers a Bathhouse Row square with a tile from this play,
  its bonus is doubled.
- **Featured Spring**: forming the exact featured word adds +30 the first time anyone forms it in the game.
  It's then revealed and marked with the player's name.
- The log entry keeps each word's base score and bonus separately, so the UI can show the breakdown.

### Swaps and passes
- Swap 1–7 rack tiles while at least 7 tiles are in the bag: draw first, then the returned tiles go to the
  **bottom** of the bag in alphabetical order (no shuffle, so a seed fixes the whole draw sequence).
- Pass: nothing changes.
- A swap, a pass, or a play that scores 0 counts as scoreless.

### Drawing and ending
- After a play the player draws from `bag[0]` until 7 tiles or the bag is empty.
- The game ends when (a) a player plays out their last tile while the bag is empty, or (b) every seat has
  had 2 scoreless turns in a row (`scoreless ≥ 2 × seats`), or (c) in the Daily, after 10 turns or (a).
- End adjustment (a and b): each player loses the face value of tiles left on their rack; in (a) the
  player who went out gains the total of everyone else's. The Daily has no adjustment.
- Highest score wins; ties share the win.

### Featured Springs
3 lexicon forms per game, chosen by `rng.bag` from tier ≥ 2 forms of 4–8 letters, from 3 different
categories. Each plaque shows the category, the length and one letter; at the start of each full round
one more letter clears, never past `length − 2` letters shown. Once claimed, the whole word shows.

## 4. Input
- **Pointer (mouse and touch):** drag a rack tile onto a square; drag a staged tile to move it or back
  to the rack; tap a rack tile then tap a square; tap a staged tile to recall it. Drops act on
  `pointerup` (touch quirk in LESSONS). A blank asks for its letter in a small dialog; it stays on the rack
  until a letter is picked, so Cancel leaves it there.
- **A drag always ends with the tile somewhere.** A rack drag is captured on `#app` and the button it started
  on stays in the page (hidden) until the drop, because iOS WebKit aims the whole touch at that node. A drag that
  ends without a drop (a cancelled touch, lost capture, the page losing focus, a mouse released outside the
  window, a new turn, a dialog, another screen) puts the tile back in its rack slot or on its square. Extra
  fingers are ignored while a tile is held; a staged tile dropped on a taken square goes back to its own square.
- **Touch drag (after the block puzzle):** the board never zooms by itself. A dragged tile grows from its
  rack size to about a board square (1.15 squares, 32–64 px) in 120 ms and floats 1.6 squares (56–84 px)
  above the finger. It lands on the square under the tile's centre, not the finger, and that square shows
  the tile seated and translucent with a gold outline (red dashed outline when taken). The target holds
  until the tile is 0.62 of a square past that square's centre, so 25 px phone squares don't flicker, and
  a tile up to half a square outside the grid snaps to the edge square. Where the tile is decides, not the finger:
  with the finger on the rack a tile still over the grid lands on the board (short phones' bottom rows sit right
  above the rack), otherwise it reorders the rack. A missed drop flies back to its rack slot (200 ms). Tiles placed
  while the computer's tiles are still landing stay put. Pinch 1×–2.4× is optional;
  one finger pans when zoomed; auto-pan near edges while dragging when zoomed.
- **Keyboard:** arrow keys move a board cursor; letters place rack tiles at the cursor and advance it;
  Space flips direction (→ / ↓); Backspace recalls the last staged tile; Enter plays; Esc recalls all;
  S swap, P pass, H hint, ? help, M menu. Every button is reachable with Tab.

## 5. Rendering
- **Layers:** (1) WebGL canvas: the board slab on a bathhouse counter, placed and staged tiles as one
  `InstancedMesh` of the Blender tile with a letter atlas; (2) 2D overlay canvas: cursor, previews,
  snapped drop ghost, steam; (3) DOM: rack, HUD, dialogs.
- **2D fallback:** the same board texture drawn flat with tile sprites, used when WebGL is missing,
  with `?gl=0`, on software GL, or when the frame watchdog sees slow frames (Barons `probe()`).
- The board texture (`render2d.js`) is drawn once per theme/size: marble, terrazzo border, brass
  inlay grid, stained-glass premium medallions with a label and a pattern each, Bathhouse Row medallions.

## 6. AI (`movegen.js`, `ai.js`, run in a Web Worker)
- Move generation: Appel–Jacobson on the DAWG. Anchors = empty squares next to tiles (centre on an
  empty board). Cross-checks = 26-bit masks of letters legal in the perpendicular word, with the
  perpendicular score cached. LeftPart walks prefixes up to the anchor's free left extent, ExtendRight
  completes words; down moves use the same code on the transposed board.
- Every move is scored with the engine's own `score` function (bonuses included).
- Levels:
  - **Easy:** only common words, at most 6 letters; picks at random from the 50th–80th percentile of its 30 best plays.
  - **Medium:** common words plus every 2–3 letter word; maximises score + ½ × leave value.
  - **Hard:** maximises score + leave value − 0.5 × opened Boiling Spring lanes; with the bag empty in a
    2-player game it looks one reply ahead (the opponent's rack is known by then).
- Leave values (`leave-table.js`) are fitted by `tools/selfplay.mjs`.
- Determinism: no wall-clock cutoffs; a node budget caps the search. Ties break by a fixed key.

## 7. RNG
mulberry32, two streams stored in the state: `rng.bag` (bag order, featured picks) and `rng.ai`
(Easy's percentile pick). The Daily seed is a hash of the local date `YYYY-MM-DD`.

## 8. Saves (`localStorage`, every call in try/catch; the game works without storage)
| Key | Contents |
|---|---|
| `hs-letters-save-v1` | the engine state of the game in progress, written after every action |
| `hs-letters-settings-v1` | sound, volume, motion, text size, theme, 3D, AI speed, last setup |
| `hs-letters-register-v1` | Bathhouse Register: `{ [form]: { first, count, best } }` |
| `hs-letters-daily-v1` | `{ [date]: { score, words } , streak, lastDate }` |

## 9. `window.__game` hooks
| Method | Does |
|---|---|
| `seed(n)` | seeds the next `newGame` |
| `getState()` | `{ scene, dialog, game, staged, settings, view, aiThinking, ready }` |
| `setState(s)` | loads `{ game, scene?, staged? }` and redraws |
| `isIdle()` | false while the dictionary loads, tiles fly, a dialog animates, the camera eases, art loads, or the AI thinks |
| `scene(name)` | `title`, `setup`, `game`, `help`, `settings`, `register`, `about`, `over`, `daily` |
| `newGame(opts)` | `{ mode, seats: [{ kind, level, persona, name }], seed, date }` |
| `act('stage', [{i, l, blank}])` / `act('recall')` | stage tiles as a player would / recall all |
| `act('play')` / `act('swap', letters)` / `act('pass')` | perform the action for the current human |
| `act('ai')` | run the AI turn now (resolves when applied) |
| `act('autoplay', n)` | play up to n turns with every seat as AI |
| `act('eval', tiles)` | the engine's evaluation of a placement |
| `act('cell', i)` / `act('screen', i)` | screen point of a square / square under a screen point |
| `act('moves', limit)` | the AI's ranked move list for the current rack |
| `act('freezeFx', t)` | freeze ambient steam at time t (screenshots) |
| `act('open', name, arg)` / `act('close')` | dialogs: `pause`, `swap`, `blank`, `fact` (form), `score` |
