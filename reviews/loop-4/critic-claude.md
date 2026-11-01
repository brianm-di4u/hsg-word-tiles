# Loop 4: Claude critic

Captures: `screenshots/visual-4/{desktop,mobile}`. Benchmark: `benchmarks/barons-*`.

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Board art and materials | 6 | `desktop/v02-board-start`: marble, terrazzo border and stained-glass premiums read well, but the board sits in a flat brown void. There is no wood grain, no contact shadow, and the board has no visible light source. Barons' table has rich grain. `desktop/v02` (top-left): the towel prop is an untextured cream box with a teal band, and the brass bell on the right is unexplained. `mobile/v02`: Bathhouse Row medallions shrink to muddy brown circles. |
| 2 | Tiles and type | 7 | `desktop/v04-midgame`: board letters are crisp, near-black serif, and the rack tiles are strong. Point values on board tiles render at about 5 px, so they can't be read. `mobile/v04`: the same subscripts are about 6 px. Type hierarchy (deco display, serif headings, geometric sans) holds across `desktop/v06-over` and `mobile/v08-register`. |
| 3 | Desktop layout | 7 | `desktop/v04-midgame`: the right column is orderly: scores, then plaques, ledger, info strip and actions. `desktop/v02-board-start`: the ledger is about 250 px of empty cream with one italic line, and each plaque is half-empty gold. `desktop/v11-setup`: a small left-aligned Start button and dead space below the dialog. |
| 4 | Phone layout and touch | 6 | `mobile/v02` and `mobile/v04`: the three plaques take about 230 px (y 135–360) while the letters fill only the left half. This pushes the ledger to a single visible entry. `mobile/v10-loupe`: zoom, minimap and loupe all work, but the dragged tile hides the loupe's TAKEN tag. `mobile/v05-fact`: the card's top edge cuts through plaque 3. |
| 5 | Hot Springs identity | 7 | `desktop/v01-title`: the dusk Bathhouse Row art and deco wordmark are on par with Barons. `desktop/v05-fact`: the MAGNOLIA card has a painting and a source. `desktop/v08-register` is in keeping. The board itself, `desktop/v02`, still reads as a generic word-game grid on marble, and `desktop/v06-over` has no Hot Springs imagery. |
| 6 | Interface consistency | 7 | `desktop/v11-setup`, `v07-help-squares` and `v08-register` share one dialog language: cream panel, gold rule, rust heading, boxed X. Two breaks: human players get a "Y"/"P" initial disc beside painted AI portraits (`desktop/v06-over`, `mobile/v02`). In `mobile/v09-night` the plaques stay day-gold while everything else goes navy, and Play turns muddy olive. |
| 7 | Feedback and delight | 6 | `desktop/v03-staging`: the "SPRING 28 pts +15" preview and teal staged outline are good. In `desktop/v04` the "TUB +20 · Row ×2 / Read the card" strip is good. `desktop/v06-over` and `mobile/v06-over` are a plain table of text: no art and no celebration, and the three hidden Featured Springs appear as flat grey chips. No steam or score pop is visible in any capture. |
| 8 | Defects | 6 | See the list below. Mostly overlaps, dead space and contrast slips; nothing is broken. |

**Total: 52 / 80.** Every category below 7 fails its gate (1, 4, 7, 8).

## Top 10 fixes (by impact)

1. **Featured Springs plaques (right panel on desktop; band at y 135–360 on phone).** The gold bars are twice as wide as their letters, and on a phone they cost 230 px. On phones, combine them into one compact plaque strip (three short plaques side by side, or one bar that expands on tap). On desktop, size each bar to its content, or centre the cells and add a "3 / 8" count at the right.
2. **Board-tile point values (every board tile, both renderers).** Raise them to about 9 px on screen at 1280 and phone widths, bold, tucked into the bottom-right corner with a little more inset. Right now they disappear (`desktop/v04`, `mobile/v04`).
3. **Table surround and props (desktop canvas outside the frame).** Add a wood or marble counter texture with a warm lamp pool and a contact shadow under the frame. Replace the blank towel box with a folded, monogrammed bathhouse towel, and either give the bell a purpose (turn signal) or remove it.
4. **Bathhouse Row squares (8 medallions, 3D and 2D).** Painted photo-circles at 25–30 px read as brown blobs. Use a gold line-art facade icon on an ink disc with a stained-glass rim, like the other premiums. Enlarge the "START" lettering on the centre disc.
5. **Loupe tag (phone drag, `v10`).** The dragged tile sits on top of the TAKEN tag. Move the tag above the ring, or offset the drag ghost further below the finger.
6. **Empty ledger (desktop right panel at game start; phone ledger card).** Shrink the panel while it's empty, or fill it with a small illustrated steam vignette. On phones, move the ledger into a pull-up drawer so it shows more than one entry.
7. **Final Soak (`v06`, both sizes).** Add a header vignette (the bathhouse facade with steam). Show the hidden Featured Springs as gold plaques with their letters revealed instead of grey chips, add a short per-turn sparkline or best-play tile row, and animate the winner's score.
8. **Human avatar (score cards, setup, results).** Replace the "Y"/"P" initial disc with a choice of painted guest portraits or an illustrated monogram token in the portrait frame style.
9. **Night palette (`v09`).** Change the plaques from bright gold to brass-on-navy. Give Play a proper night primary (bright brass with dark ink) instead of muddy olive. Add warm light falling on the 3D board.
10. **Title stack (`v01`).** On phones, balance the tagline wrap (no lone "springs.") and add a soft scrim behind it over the steam, then centre the menu vertically to remove about 170 px of dead space. On desktop, "About & sources" sits 20 px from the bottom edge; tighten the art height or the gaps.

## Outright defects

- `mobile/v10-loupe`: the dragged "A" covers the loupe's TAKEN tag; only a rust sliver shows.
- `mobile/v10-loupe`: a stray tile subscript "2" shows beneath the minimap frame at bottom-left.
- `mobile/v05-fact`: the fact card's top edge slices through plaque 3, leaving half-letters "C A S" visible above it.
- `mobile/v01-title`: the tagline wraps to an orphan "springs." over busy steam, so contrast is poor.
- `mobile/v08-register`: the title wraps to two lines and the close button floats between them, misaligned with the first line.
- `desktop/v04-midgame`, `mobile/v04`: the blank "G" has a mint fill and teal letter, which reads as a selection or highlight state, not a blank tile.
- `desktop/v02`, `mobile/v02`: Featured Springs bars are about 45% empty gold on the right.
- `mobile/v09-night`: the plaques keep the day-gold palette, and disabled Play is olive on navy (low contrast).
- `desktop/v11-setup`: the Start button is under-sized and left-aligned, inconsistent with the full-width primary on the title screen.
- `desktop/v01-title`: the "About & sources" link sits about 20 px from the viewport bottom.
