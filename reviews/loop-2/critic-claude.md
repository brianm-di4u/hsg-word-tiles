# Loop 2 – Claude critic

Captures: `screenshots/visual-2` (desktop 1280×800, mobile 390×844 @2x). Benchmark: `benchmarks/barons-*`.

## Scores

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Board art and materials | 6 | Marble, terrazzo border and sunburst premium squares are coherent (desktop/v02-board-start), but the board is still a plain cream grid inside a plain walnut trapezoid. It has nothing like the illustrated perimeter in barons-desktop-board3d. The towel prop is a blocky, untextured box with a detached shadow, and about 30% of the stage is a dark void with a stray hotspot glow at left (desktop/v02-board-start, desktop/v04-midgame). Night marble turns cold blue-grey (desktop/v09-night). |
| 2 | Tiles and type | 6 | Rack tiles are excellent (desktop/v04-midgame, mobile/v04-midgame). Placed-tile letters are now readable (about 15px desktop, about 12 CSS px phone). Their point values are about 4px and illegible, and so are the LETTER/WORD captions and medallion names (LAMAR, QUAPAW) (desktop/v04-midgame, mobile/v02-board-start). The deco/serif/sans hierarchy is good (desktop/v06-over, desktop/v08-register). |
| 3 | Desktop layout | 6 | The board/panel split is clear (desktop/v02-board-start). At start the Steam ledger is still a 230px empty cream slab. The rack bar spans 865px for 7 tiles. The three full-saturation gold plaques are the loudest element on screen, louder than the board (desktop/v02-board-start, desktop/v04-midgame). |
| 4 | Phone layout and touch | 6 | Everything fits at 390. The rack (40 CSS px) and action buttons are good targets, and the loupe is clear (mobile/v10-loupe). Board cells are about 23 CSS px. The plaques lose their icons and the slots touch ("SKY" has no gaps) (mobile/v04-midgame). Game-over wraps badly (mobile/v06-over). The ledger only peeks above the fold (mobile/v02-board-start). |
| 5 | Hot Springs identity | 7 | The title art is at benchmark level (desktop/v01-title, mobile/v01-title). The painted Magnolia fact card is at or above Barons' fact card (desktop/v05-fact, mobile/v05-fact). The naming is consistent: Steam ledger, Featured Springs, Final Soak, Bathhouse Register. The Register is a wall of dashed placeholders with no art (desktop/v08-register), and setup is a generic form (desktop/v11-setup). |
| 6 | Interface consistency | 6 | Dialogs share one cream/gold-rim/deco-heading shell (desktop/v11-setup, desktop/v07-help-squares). The primary colour still splits three ways: rust for New game, Start and Close; teal for Play by day; gold for Play at night (desktop/v04-midgame, desktop/v09-night). The toast banner stays day-gold at night (desktop/v09-night). The help swatches are flat chips, and "Row" is a beige text chip, unlike the board's sunburst and medallion art (desktop/v07-help-squares). |
| 7 | Feedback and delight | 6 | The preview strip "SPRING 28 pts +15" with the teal staging outline works well (desktop/v03-staging, mobile/v03-staging). The winner medallion card is an improvement (desktop/v06-over). The toast teaser is cut mid-word ("was buil…"), there are no score pops or steam in any capture, and the game-over screen has no art or celebration (mobile/v04-midgame, desktop/v06-over). |
| 8 | Defects | 5 | See the list below (mobile/v09-night, mobile/v06-over, desktop/v04-midgame). |

**Total: 48 / 80.** Only identity meets the ≥7 gate.

## Top 10 fixes (by impact)

1. **Board surround (desktop stage).** Scale the board until it fills about 90% of the stage height and remove the left hotspot. Replace the towel block with a modelled, textured prop, or cut it. Give the frame brass corner bosses and a lit bevel so it reads as furniture.
2. **Premium squares (whole board).** Drop the unreadable LETTER/WORD micro-captions. Encode letter vs word by shape or by a ≥10px suffix ("2L", "3W"), and darken the ×N ink on the cream disc to full contrast. Show medallion names only in the loupe or on hover.
3. **Status/toast strip (above the rack).** Clear the previous status before the banner animates in (fixes the overlap). Replace the truncated teaser with a complete line of 40 characters or fewer, such as the fact's headline.
4. **Night theme (right panel and actions).** Add night variants for the toast banner and the plaques, and use one primary colour for Play in both themes and across all dialogs.
5. **Steam ledger (right panel).** Make the empty state compact (content height, or a small illustrated "first move" card). Order entries newest-first so the fade never sits on top of a live row.
6. **Plaques (right panel / phone top).** Desaturate them to a brass bar with cream slots so they rank below the board. On phone, restore the category icons and keep a 3px or wider gap between slots.
7. **Game-over on phone (mobile/v06-over).** Put the portrait above the name and score. Show each stat on its own line, not as "·"-joined text that wraps. Stack the two buttons full-width. Add a painted header vignette on both sizes.
8. **Placed-tile point values (board).** Render them at ≥8 CSS px or omit them on the board.
9. **Register (dialog).** Make found and locked cells the same height and add a painted banner per category so the grid is not just dashed boxes.
10. **Help swatches (desktop/v07-help-squares).** Use the actual board renders (sunburst discs, building medallion) as the swatches, with dark ink on gold.

## Outright defects

1. mobile/v09-night: two messages render on top of each other in the strip. White "Maestro Julian Fitch played GRUB and BRUSHER for 44." ghost text sits over the "TUB +20 · Row ×2" banner.
2. desktop/v04-midgame, desktop/v09-night: the last ledger row ("You ACME, TA 27") is half-hidden under the fade and reads as clipped text.
3. Toast teaser truncated mid-sentence or mid-word: "was built…" (desktop/v04-midgame), "was buil…" (mobile/v04-midgame, mobile/v10-loupe).
4. mobile/v06-over: the winner's name wraps to three lines, the meta line starts with an orphan "· went out +7", and "· tiles / left −7" splits.
5. mobile/v06-over: the button row is off-centre (Play again starts about 90 CSS px in, Title screen sits flush right).
6. LETTER/WORD captions, medallion names and placed-tile point values render at about 3–4px (desktop/v02-board-start, mobile/v02-board-start).
7. mobile/v04-midgame: the left plaque's slots touch each other, and the icons are missing on phone.
8. desktop/v07-help-squares: the white "×2" on the gold Steam swatch has low contrast.
9. desktop/v02-board-start: the towel prop is untextured placeholder geometry with an offset floating shadow.
10. desktop/v08-register: found cells (about 60px) and locked cells (about 34px) mix in the same grid, so the row rhythm is ragged.
