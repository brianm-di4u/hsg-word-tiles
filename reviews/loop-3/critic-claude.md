# Loop 3 critic (Claude)

Captures: `screenshots/visual-3/{desktop,mobile}`. Benchmark: `benchmarks/barons-*`. I judged the current captures on their own and zoomed into crops of the board, the rack and the right panel.

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Board art and materials | 6 | `desktop/v02-board-start`: the marble varies now and the sunburst premiums look good, but most of the board is an empty ivory field. The table around the frame is flat brown with no grain, much weaker than the wood in `barons-desktop-board3d`. The towel stack (top left) looks like plastic slabs. `desktop/v04-midgame`: the bathhouse medallions are 30 px photos with captions you can't read (LAMAR, OZARK). The START medallion is a blurry teal blob. |
| 2 | Tiles and type | 6 | `desktop/v04-midgame` (zoomed): board letters are crisp, but the point values are ~4 px grey smudges, and the "×2/×3" on letter premiums is thin grey on cream. `mobile/v04-midgame`: point values on the board can't be read at all. The rack tiles in `mobile/v02-board-start` are excellent. The display / serif / sans hierarchy works across `v06-over` and `v05-fact`. |
| 3 | Desktop layout | 6 | `desktop/v02-board-start`: about 110 px of dead table on each side of the board, used only by the towels and bell. The rack tray is half empty at both ends. `desktop/v04-midgame`: the right panel is well ordered, but the gold Featured Springs bars are the heaviest element on screen and outweigh the scores. The ledger's last row is cut through mid-line. |
| 4 | Phone layout and touch | 6 | `mobile/v04-midgame`: everything fits at 390 px, but board squares are ~24 css px and the Featured Springs chips touch each other and the plaque edges (FOUNTAIN, SKYLIGHT). `mobile/v10-loupe`: the loupe magnifies by about 1× (its tile is the same size as the board tiles) and its marble is cold grey. The minimap's content spills past its frame. |
| 5 | Hot Springs identity | 7 | `desktop/v01-title`: the dusk promenade art and Art Deco wordmark match Barons. `desktop/v05-fact` and `mobile/v05-fact`: the MAGNOLIA card with its NPS source is tasteful. `desktop/v08-register` names and language ("signed in", Steam ledger, Final Soak) are on theme without kitsch. |
| 6 | Interface consistency | 6 | `desktop/v07-help-squares`: the legend swatches are flat squares. They don't match the board's sunburst-and-disc premiums, and the text's "dark disc" never appears. `desktop/v11-setup`: Start has a hard 3D bottom shadow that no other button uses. `mobile/v10-loupe`: the minimap's royal-blue viewport box is off palette. `desktop/v09-night` holds together well. |
| 7 | Feedback and delight | 6 | `desktop/v03-staging`: the teal outline and the "SPRING 28 pts +15" strip are clear and good. `desktop/v04-midgame`: the bonus banner works. `desktop/v06-over`: plain card on an empty brown field, no art and no steam. Featured Springs show as grey "stayed hidden" chips, an anticlimax next to the Barons gazette. |
| 8 | Defects | 5 | Seven or more issues listed below, across `desktop/v04-midgame`, `mobile/v10-loupe`, `desktop/v07-help-squares` and `mobile/v04-midgame`. |

**Total: 48 / 80.** Gates are unmet in 7 of 8 categories.

## Top 10 fixes (ranked by impact)

1. **Point values on board tiles** (3D tile texture, every board capture): raise the subscript to about 28% of tile height, set it in full ink at weight 700, and bake it at 2× texture resolution so it stays readable at 24 px phone squares.
2. **Phone Featured Springs plaques** (`mobile/v04`, top strip): give the chips 2 px gaps and 6 px inner plaque padding. Drop the category icon on phone, or stack the plaques as three full-width rows of 28 px height.
3. **Help legend swatches** (`v07-help-squares`, left column): render the actual board premium art at 40 px (sunburst plus cream or ink disc, bold figure) and a real medallion for "Row".
4. **Loupe** (`mobile/v10`, circle at top): sample the same cream marble at 2× magnification and centre it on the target cell under the finger. Show validity as a green or rust ring on the target, not a red X drawn over an existing letter.
5. **Minimap** (`mobile/v10`, bottom left): clip the content to the panel's inner rect, and recolour the viewport box to brass. No board glyphs should show below its frame (the "2" peeking out under it).
6. **Desktop table surface** (`desktop/v02`, left and right of the frame): add a wood-grain or polished-counter texture with lamp falloff, and widen the board or tuck the bag and bell closer. Give the towels a soft cloth shape, or cut them.
7. **Steam ledger overflow** (`desktop/v04`/`v09`, right panel): snap the scroll to whole entries, or add a "more" affordance. Never cut a row in half.
8. **START medallion and bathhouse captions** (board centre and edge medallions): redraw at 4× resolution with one bold word, or move the bathhouse names into a tooltip or loupe. Unreadable micro-text reads as unfinished.
9. **Final Soak screen** (`desktop/v06`): add a header illustration or steam band, reveal the missed Featured Springs styled as the gold plaques, and fill the 200 px of dead space below the card.
10. **Last-move highlight** (`desktop/v04`, the G after WEEKLONG): highlight every tile of the last move and keep the letters in ink. The lone mint tile with a teal letter looks like a glitch.

## Outright defects

- `desktop/v04-midgame`, `desktop/v09-night`: the ledger's bottom row ("You ACME, TA 27") is clipped through the text.
- `mobile/v10-loupe`: minimap tile blocks run past the panel's bottom edge, and a stray "2" shows beneath the frame.
- `mobile/v10-loupe`: the loupe's marble is cold grey-white while the board is cream. A red X over the placed "R" reads as an error on a committed tile.
- `desktop/v07-help-squares`, `mobile/v07-help-squares`: the Steam and Boiling swatches show a small gold or red rectangle in a dark square with an unreadable figure, which contradicts the "dark disc" text.
- `mobile/v04-midgame`, `mobile/v09-night`: Featured Springs letter chips touch each other and the plaque's right edge.
- `desktop/v04-midgame`, `mobile/v04-midgame`: the last-move "G" is teal on mint, with low contrast.
- `desktop/v02-board-start`, `mobile/v02-board-start`: the "DISPLAY SPRING" caption on the START medallion is unreadable.
- `desktop/v02-board-start`, `mobile/v02-board-start`: the disabled Play button is a muddy mauve, and its white label has poor contrast.
- `mobile/v10-loupe`: the ledger's "Hot Springs +20" sits on the card's bottom edge.
- `mobile/v01-title`: the tagline wraps to leave the single word "springs." on its own line.
