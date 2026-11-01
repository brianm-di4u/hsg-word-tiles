# Visual review rubric (Bathhouse Letters)

Adapted from the football campaign (`reviews/RUBRIC.md` there): eight categories, each 1–10, total /80.
**Benchmark:** Bathhouse Barons, the collection's visual bar (`benchmarks/barons-*.png`, git-ignored copies of
`repos/hsg-property-game/screenshots/latest`). A score of 7 means "as finished as Barons in this respect".

Anchors for every category: **3** = clearly unfinished or broken; **5** = works, looks like a prototype;
**7** = polished, consistent, on par with the benchmark; **9** = better than the benchmark, would pass as a commercial
release. Every score must cite at least two captures by name (e.g. `desktop/v04-midgame`).

| # | Category | What to judge |
|---|---|---|
| 1 | Board art and materials | Marble, stained-glass springs, bathhouse medallions, frame, counter, lighting and shadows (3D) |
| 2 | Tiles and type | Tile modelling, letter legibility at desktop and phone sizes, type hierarchy across the UI |
| 3 | Desktop layout | Use of space, hierarchy, alignment, the right panel, the rack and action bar |
| 4 | Phone layout and touch | Fit at 390×844, target sizes, zoom and loupe, nothing cramped or cut off |
| 5 | Hot Springs identity | Does it feel like a Hot Springs bathhouse game, tastefully (not kitsch)? Title art, plaques, cards, Register |
| 6 | Interface consistency | Buttons, panels, dialogs, sheets, icons: one design language, day and night |
| 7 | Feedback and delight | Live preview, toasts, fact cards, game-over screen, steam, score pops |
| 8 | Defects | Clipping, overlap, misalignment, contrast, stray artefacts (10 = none found) |

**Gates:** every category ≥ 7. **Stop rule:** gates met, or two loops in a row without a new best total, or six loops.
Each loop: Claude critic and Codex adversarial critic score independently from the same captures; the loop's score
is the mean per category; the top gaps (by impact) become that loop's fix list (`loop-N/CHANGES.md`).
