# Loop 6, Claude critic

Captures: `screenshots/visual-6`. Benchmark: `benchmarks/barons-*`.

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Board art and materials | 6 | `desktop/v02-board-start`: walnut frame, gold moulding, terrazzo border and lamp pool now read as a real object, but about 180 blank marble squares make a large, flat, empty field next to Barons' illustrated board (`barons-desktop-board3d`). The START disc in the centre is smaller than a square and its white "START" lettering is a blur. `desktop/v09-night`: the marble turns a cold grey-blue while the frame stays warm day-walnut, so it looks like a recolour rather than night lighting. |
| 2 | Tiles and type | 7 | `desktop/v04-midgame` and `mobile/v04-midgame`: rack tiles are chunky, bevelled and sharp, with clean value subscripts, and board tiles stay legible at 390 px. Faults: the grey "×2/×3" on the cream letter discs is faint at desktop size (`desktop/v04-midgame`, near the centre). "Steam ledger" and "Featured Springs" use the Limelight display face, which goes against change 9. Ledger rows set the player name and the word in the same weight ("Maestro Julian Fitch WEEKLONG"). |
| 3 | Desktop layout | 6 | `desktop/v02-board-start` vs `desktop/v03-staging`: the rack tray jumps from 400 px (tiles only) to 500 px (seven slot wells) as soon as a tile leaves it. `desktop/v02-board-start`: three full-width gold plaques are the loudest thing on screen and pull focus from the board, and the ledger is 260 px of empty cream. About 25% of the left pane is bare table, with only the towel stack and the bell as props. |
| 4 | Phone layout and touch | 7 | `mobile/v02-board-start`: everything fits at 390×844 and the action buttons are thumb-sized. `mobile/v10-loupe`: the loupe, the TAKEN tag beside the lens, the minimap and the zoom-out button all work. Weaknesses: the Featured Springs plaques sit in an uneven 1-over-2 stack, and only two ledger rows show (`mobile/v04-midgame`). |
| 5 | Hot Springs identity | 7 | `desktop/v01-title` and `mobile/v05-fact`: the painted dusk Bathhouse Row and the Magnolia card art are on par with Barons. In play (`desktop/v04-midgame`), though, the board says "word game on marble": no bathhouse names, no visible steam, and the Featured plaques are plain white blanks rather than "hidden in steam". `desktop/v08-register` is a sea of dashed placeholders with no art. |
| 6 | Interface consistency | 6 | The Bathhouse Row emblem on the board is a tented house (`desktop/v02-board-start`). The help (`desktop/v07-help-squares`), plaques, register and fact card all use an arch ∩ instead. `desktop/v09-night` and `mobile/v09-night`: the disabled Play is a khaki-gold slab that looks more "primary" than the enabled buttons. Buttons use three styles: cream gradient (`desktop/v01-title`), outline, and raised cream (`desktop/v06-over`). Dialogs are otherwise consistent. |
| 7 | Feedback and delight | 6 | `desktop/v03-staging`: the live chip "SPRING 28 pts +15" and the teal staging outline are good. `desktop/v05-fact` is a delight. But `desktop/v06-over` is a plain form: no art, no steam, no portrait celebration beyond a gold gradient, and the lower 25% of the screen is empty. The last-move highlight on WEEKLONG is a faint yellow edge (`mobile/v04-midgame`). |
| 8 | Defects | 6 | See the defect list below: START illegible, emblem mismatch, night disabled Play, rack jump, the blank G rendered as an unlit flat tile. |

**Total: 51 / 80**

## Top 10 fixes (ranked by impact)

1. **Board, every Bathhouse Row square** (`v02`, `v04`, both sizes): replace the tented-house glyph with the arch ∩ mark already used in help, plaques, register and the fact card, or put the domed façade in all five places. One mark, everywhere.
2. **Board centre, Display Spring**: make it a full-square medallion, larger than the premiums, with a steam-swirl ring. Use a short label such as "SPRING" or an icon at ≥10 px, in crisp dark-on-light. The current white-on-teal "START" is unreadable.
3. **Right column, Featured Springs plaques** (desktop `v02`/`v04`): tone the plaques down to dark enamel with gold edging (as in night mode) and frost the hidden cells with a steam texture, so they read as "hidden in steam" and stop out-shouting the board.
4. **Rack tray** (desktop `v02` → `v03`): give the tray a fixed width for seven slots in every state, so it doesn't jump.
5. **Game-over card** (`v06-over`, both sizes): add a painted header strip (the dusk title art cropped), steam wisps behind the winner score, and a mini board thumbnail or a best-word tile row. Centre the card vertically on desktop.
6. **Night disabled Play** (`v09-night`, action bar right): use the same disabled treatment as day, a dim outline with muted text and no gold fill.
7. **Board field** (`v02`): add per-square bathhouse names under the Row emblems, a faint compass or steam-vent pattern in the empty marble quadrants, or a stronger vignette and lamp falloff, so the field isn't 80% identical blank squares.
8. **Ledger rows** (right panel and mobile bottom sheet): names in small caps, muted and on their own line or column; words in bold display. Keep Fraunces for "Steam ledger" and "Featured Springs" to honour change 9.
9. **Letter-premium discs** (cream ×2/×3): darken the numeral to ink and enlarge it about 20%, to match the dark word discs' legibility.
10. **Register** (`v08-register`): add a small engraved illustration per section header, and show locked words as embossed blank tiles rather than dashed boxes, so the page feels like a guest book and not an empty form.

## Outright defects

- The Display Spring "START" lettering is blurred and illegible at 1× (`desktop/v02-board-start`, centre; `mobile/v02-board-start`).
- The Bathhouse Row icon on the board (house) does not match the help, plaque, register and fact-card icon (arch). This contradicts change 2's claim that "help uses the same mark".
- The disabled Play in night mode looks active, in gold-khaki (`desktop/v09-night`, `mobile/v09-night`).
- The rack tray resizes and shifts horizontally between `desktop/v02-board-start` and `desktop/v03-staging`.
- The blank tile "G" at the end of WEEKLONG renders flat, with no bevel or shadow and a teal letter, so it looks like a different material from its neighbours (`desktop/v04-midgame`, `mobile/v09-night`).
- "Steam ledger" and "Featured Springs" still use the Limelight face during play, against change 9.
- The ledger runs the name and the word together at the same weight ("Maestro Julian Fitch GRUB, BRUSHER"), which is hard to scan (`mobile/v10-loupe`).
- The game-over card leaves about 25% of the desktop viewport empty below it and is not vertically centred (`desktop/v06-over`).
