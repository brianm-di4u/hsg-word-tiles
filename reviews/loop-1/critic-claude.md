# Loop 1 – Claude critic

Captures: desktop 1280×800, mobile 390×844 @2x. Benchmark: Bathhouse Barons (`benchmarks/barons-*`).

## Scores

| # | Category | Score | Evidence |
|---|---|---|---|
| 1 | Board art and materials | 6 | Marble, terrazzo border and wood frame are real materials (desktop/v02-board-start), but at play zoom the 46 stained-glass squares read as confetti with unreadable labels; the sunburst art only shows in mobile/v10-loupe. Plain brown bevel frame, flat lighting. Night marble goes cold grey (desktop/v09-night). |
| 2 | Tiles and type | 5 | Rack tiles are good (≈50px serif, bevel, desktop/v04-midgame). Placed tiles are not: letters ≈14px desktop, ≈10 CSS px phone, point values ≈5px, illegible (desktop/v04-midgame, mobile/v04-midgame). Display deco face and serif/sans pairing are a sound hierarchy (desktop/v01-title, desktop/v06-over). |
| 3 | Desktop layout | 6 | Clear board-left/panel-right split like Barons (desktop/v02-board-start). But tilt wastes ~25% of the 865px stage, the towel stack is cut off by the left edge, the empty Steam ledger is a 250px blank cream slab at start (desktop/v02-board-start), and the gold plaques are the loudest thing on screen. |
| 4 | Phone layout and touch | 5 | Fits 390 wide; rack tiles (40 CSS px) and action buttons (≈70px) are good targets (mobile/v02-board-start). Board cells ≈23 CSS px, the ledger sits below the fold and is clipped mid-line (mobile/v04-midgame), the toast swallows the top third (mobile/v09-night). Loupe works and is the best view in the game (mobile/v10-loupe). |
| 5 | Hot Springs identity | 6 | Title art is benchmark-level (desktop/v01-title). Register and named medallions are on-theme (desktop/v08-register). The fact card is a white arch glyph on a teal gradient, not art (desktop/v05-fact, unlike Barons' Fordyce photo card); game-over and setup are generic forms (desktop/v06-over, desktop/v11-setup). |
| 6 | Interface consistency | 6 | One cream/rust/gold palette across dialogs (desktop/v11-setup, desktop/v07-help-squares). Breaks: primary is rust (New game, Start, Play again) but teal for Play, gold at night (desktop/v02-board-start, desktop/v09-night); browser-blue focus ring (desktop/v05-fact); help swatches are flat chips, not the board's sunburst art (desktop/v07-help-squares); toast stays day-gold at night (desktop/v09-night). |
| 7 | Feedback and delight | 5 | Live preview pill "SPRING 28 pts +15" and teal staging outline are good (desktop/v03-staging, mobile/v03-staging). Toast and fact card exist but are plain. Game-over has no portrait hero, no art, no celebration; it is weaker than the Barons Gazette (desktop/v06-over, mobile/v06-over). |
| 8 | Defects | 4 | Several clear ones; see below (mobile/v04-midgame, mobile/v11-setup, desktop/v07-help-squares). |

**Total: 43 / 80.** No category meets the ≥7 gate.

## Defects (outright)

1. **Toast covers the game on phone** (mobile/v04-midgame, mobile/v09-night). A ~190 CSS px column wraps to 9 lines and covers the "You to play" header, all three Featured Spring plaques and the top four board rows. On desktop it overlaps the board frame's top edge (desktop/v04-midgame).
2. **Opponent select truncated** to "Park ranger · I" (mobile/v11-setup).
3. **Help definition grid broken**: "Bathhouse Row" text starts with an orphan ": eight squares…" in a separate column. "Boiling Spring" description floats with a ~130px gap (mobile/v07-help-squares, desktop/v07-help-squares).
4. **Tile/cell misregistration**: 3D tile tops sit up-left of their cells. The "T" of TUB overhangs the board's left edge (desktop/v04-midgame).
5. **Ledger last row clipped mid-glyph** (desktop/v04-midgame "You ACME, TA"; mobile/v04-midgame "GRUB, BRUSHER 44").
6. **Stray towel sliver** at the phone's left edge, y≈215–235 CSS px (mobile/v02-board-start, mobile/v09-night). Towel cut by the viewport edge on desktop.
7. **Browser-default sky-blue focus ring** on Close (desktop/v05-fact, mobile/v05-fact).
8. **Kicker wrap** "BATHHOUSE ROW · HOT SPRINGS / WORD +25" leaves "WORD +25" orphaned (desktop/v05-fact).

## Top 10 fixes (by impact)

1. **Re-place the toast.** On phone, use a full-width (16px gutters) sheet docked directly above the rack, with a one-line title (15px) and a 2-line body max. On desktop, dock it inside the right panel above the ledger, never over the board. (mobile/v04-midgame, desktop/v04-midgame)
2. **Make placed tiles legible.** Letter ≥55% of cell height (≈20px desktop, ≥13 CSS px phone) and point value ≥9px. Cut the camera tilt to ≤10° so far rows aren't shrunk. (desktop/v04-midgame, mobile/v04-midgame)
3. **Fix tile registration.** Lower tile height or centre the camera so each tile's top face sits inside its cell. No overhang past the board edge. (desktop/v04-midgame)
4. **Premium squares readable at play zoom.** One bold "×2"/"×3" at ≥45% of cell height, with letter/word shown by shape or border rather than 4px text. Hide "WARM/LETTER" micro-labels until loupe zoom. Push Warm teal and Hot blue further apart. Medallions need a legible 3–4 letter name strip. (desktop/v02-board-start, mobile/v02-board-start)
5. **Fact card art.** Replace the gradient and arch glyph with per-category postcard illustrations in the title-art style. Split the kicker into category and bonus chip. Swap the blue focus ring for a 3px gold ring. (desktop/v05-fact, mobile/v05-fact)
6. **One primary colour.** Make Play rust like New game, Start and Play again (gold-on-dark at night is fine if used for every primary). Restyle the tiny 7px "⇧R" key hints at ≥10px or drop them. (desktop/v02-board-start, desktop/v11-setup)
7. **Calm the Featured Springs plaques.** Desaturate the gold gradient by ~30%. Draw hidden slots as frosted steam, not grey-white bubbles. Keep the category icons on phone (they vanish), and use 3px slot gaps. (desktop/v02-board-start, mobile/v02-board-start)
8. **Game-over as a moment.** Add a 96px winner portrait hero over a postcard-art header strip, plus a final board thumbnail. Style "stayed hidden" as steamed plaques, not grey chips. (desktop/v06-over, mobile/v06-over vs barons-desktop-over)
9. **Repair dialogs.** Help: fixed 150px term column, no leading colon, swatches rendered from the real board art. Setup: a custom opponent picker with name on line 1 and role · level on line 2. (desktop/v07-help-squares, mobile/v11-setup)
10. **Tidy the edges.** Remove the phone towel sliver and show the whole towel stack or none on desktop. Collapse the empty ledger at start. Thin the phone frame (~20 CSS px per side) to grow cells. Fade, don't clip, the ledger's last row. (mobile/v02-board-start, desktop/v02-board-start)
