# Loop 5: Claude critic

Captures: `screenshots/visual-5`. Benchmark: `benchmarks/barons-*` (7 = as finished as Barons).

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Board art and materials | 6.0 | `desktop/v02-board-start`: the marble is one flat cream with faint veins, no lamp falloff or vignette across the playfield, so it reads as a printed grid. Barons fills every square with painted art. At 37 px the gold line-art bathhouses on ink discs look like toasters or buses (row 4 col 2, right edge rows 9 and 13). The START disc is a teal blob whose cream label runs past its rim. `desktop/v04-midgame`: the frame and walnut counter are good. The props (tile bag top-left, brass bell top-right) are untextured CG primitives floating on the wood. |
| 2 | Tiles and type | 7.0 | `desktop/v04-midgame`: bevelled ivory tiles, crisp serif letters, legible point values, and the gold underline on WEEKLONG reads well. `mobile/v04-midgame`: letters stay readable at about 23 px squares. The weak spot is the letter-premium figures: `×2`/`×3` on cream discs are thin grey hairlines next to the bold word-premium figures (`desktop/v04-midgame`, lower right). The Deco display face's `H` has a hairline left stem that looks broken (`desktop/v07-help-squares`, "How to play"). |
| 3 | Desktop layout | 6.5 | `desktop/v02-board-start`: the rack is about 860 px wide but holds seven 50 px tiles, so roughly 70 % of it is empty brown. The Featured Springs plaques are left-aligned at three different widths, leaving a ragged dead zone on the right. `desktop/v03-staging`: the ledger card is about 250 px of empty cream at the start of a game. The board is well framed, and the right column's hierarchy (turn, scores, plaques, ledger, status, actions) is clear. |
| 4 | Phone layout and touch | 6.5 | `mobile/v02-board-start`: fits 390×844 with comfortable action buttons. `mobile/v04-midgame`: the ledger shows one entry (WEEKLONG) over about 100 px of blank card, although five plays exist. `mobile/v10-loupe`: the loupe and overview map work, but the TAKEN tag is cut off by the board viewport's top edge. The plaques take about 125 px above the board. |
| 5 | Hot Springs identity | 7.0 | `desktop/v01-title` and `mobile/v01-title`: the dusk promenade painting and gold Deco title match Barons' title. `desktop/v05-fact`: the Magnolia card with its NPS source is the strongest screen. `desktop/v08-register`: the guest-book idea is right, but the page is a plain form grid. In play the board itself carries almost no place identity (`desktop/v02-board-start`), and every dialog sits on an empty brown gradient (`desktop/v11-setup`, `desktop/v06-over`) where Barons uses its wood table. |
| 6 | Interface consistency | 6.5 | The help's Bathhouse Row key is still a "Row" text disc (`desktop/v07-help-squares`, `mobile/v07-help-squares`), while the board uses building line art; the loop-4 note says these match, and they don't. Setup uses a native OS `<select>` and a plain "P" letter avatar beside painted portraits (`desktop/v11-setup`). The disabled Play button is maroon by day (`desktop/v04-midgame`) and lavender at night (`desktop/v09-night`). Headings mix three faces (Deco, serif, sans) without a clear rule. |
| 7 | Feedback and delight | 6.5 | `desktop/v03-staging`: the SPRING 28 pts +15 preview chip and the teal staged outline are good. The `desktop/v04-midgame` toast ("TUB +20 · Row ×2 · Read the card") works. `desktop/v06-over` and `mobile/v06-over` are tidy but flat: no art and no steam, and "stayed hidden" appears as grey chips. Nothing in any capture shows steam, sparkle or a score pop on the board. |
| 8 | Defects | 6.0 | Clipped TAKEN tag (`mobile/v10-loupe`). START label overflows its disc (`desktop/v02-board-start`, `mobile/v02-board-start`). Help icon mismatch (`desktop/v07-help-squares`). Mobile ledger blank space (`mobile/v04-midgame`, `mobile/v09-night`). |

**Total: 52.0 / 80.** No gate is met except tiles and identity (7.0).

## Top 10 fixes (by impact)

1. **Board surface, `desktop/v02` board centre:** add a lamp pool (brighter centre, roughly 15 % darker toward the frame), visible marble veining at two scales and a soft inner shadow under the frame lip. The playfield should read as stone under light, not paper.
2. **Bathhouse Row squares, all board views:** replace the 8-building line art with one bold, simplified icon (arched bathhouse facade, 3 strokes) at 60 % of the disc, or the bathhouse's initial in Deco type. They currently read as toasters or buses.
3. **START square, board centre:** fit the label inside the disc (a smaller face, or a gold star or steam glyph with no text) and give it a brass ring and cream text with a dark stroke.
4. **Rack, `desktop/v02` bottom-left:** shrink the tray to about 7.5 tile widths and centre it, or grow the tiles to about 64 px. Add a wood-grain texture and a lip shadow to the tray.
5. **Featured Springs plaques, right column:** make all three the same full column width with the letters centred, so the block reads as a set of brass signs.
6. **Mobile ledger, `mobile/v04` bottom:** show the last 3 to 4 plays or collapse the card to its content. Never leave a single row above blank space.
7. **Loupe TAKEN tag, `mobile/v10` top of board:** move it inside the lens (bottom arc) or let it overflow the board's clipping container.
8. **Dialog backdrops (setup, help, register, game over):** blur the walnut table or the title painting behind them instead of a flat brown gradient.
9. **Final Soak, `desktop/v06` / `mobile/v06`:** add a header strip of painted art (a steam bath interior) and turn the featured words into small brass plaques that match the in-game ones. Animate or tint "stayed hidden" as steam.
10. **Letter-premium figures, board:** set `×2`/`×3` on cream discs in the same bold weight as the word discs, in dark ink.

## Outright defects

- TAKEN tag clipped at the top edge of the board viewport (`mobile/v10-loupe`). This regresses a loop-4 fix.
- START text wider than its disc and blurry on teal (`desktop/v02-board-start`, `mobile/v02-board-start`).
- The help's Bathhouse Row key shows a "Row" disc that does not match the board's building icons (`desktop/v07-help-squares`, `mobile/v07-help-squares`), contrary to loop-4 change 2.
- The mobile ledger shows one entry with about 100 px of empty card below it while more plays exist (`mobile/v04-midgame`, `mobile/v09-night`).
- The desktop board frame's bottom moulding is flush with, and slightly cropped by, the table panel's bottom edge (`desktop/v02-board-start`, y≈690).
- The disabled Play button changes hue between day (maroon) and night (lavender) (`desktop/v04-midgame` vs `desktop/v09-night`).
- The Deco `H` glyph renders with a hairline left stem that reads as broken ("How to play", `desktop/v07-help-squares`).
