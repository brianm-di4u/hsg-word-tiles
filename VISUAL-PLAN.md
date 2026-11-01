# Bathhouse Letters: visual plan

## Bar and method
The bar is Bathhouse Barons (the user's stated benchmark): a board that reads as a crafted object on a table,
painted art in a consistent style, and an interface in one design language by day and night.

Method (adapted from Barons' benchmark reviews and Friday Night Spa City's scored loops):
1. A fixed capture set, `tests/15-visual.test.mjs`, run on the real GPU (`--gpu --milestone visual-N`), so each loop
   compares like with like: title, setup, help, Register, board at the start, staging with the live preview, mid-game,
   a fact card, the results screen, night theme, and the phone loupe.
2. `reviews/RUBRIC.md`: 8 categories × 10 = 80, anchors at 3/5/7/9, every score citing at least two captures, judged
   against `benchmarks/` (Barons screenshots, git-ignored).
3. Two independent critics per loop: a Claude critic and a Codex adversarial critic (`codex:codex-rescue`). The loop
   score is their mean per category; their fix lists merge into `reviews/loop-N/CHANGES.md`.
4. Gates: every category ≥ 7. Stop when gates are met, after two loops without a new best total, or after six loops.

## Art pipeline
| Asset | Source | Where it's used |
|---|---|---|
| Title painting, glass panes (Warm, Hot, Steam, Boiling), Display Spring pool, marble, terrazzo, walnut counter | Codex image generation, pilot-approved (`art-src/PROMPTS.md`) | title card; the board face (render2d → 2D and 3D) |
| 8 bathhouse medallions, 4 portraits | Codex, styled after the approved title painting | Bathhouse Row squares; opponent badges |
| Fact-card illustrations (6 categories + magnolia promenade) | Codex (loop 1 fix) | fact cards |
| 18 landmark vignettes | Bathhouse Barons (same collection, MIT) | fact cards for specific words |
| Tile, frame, towels, desk bell | Blender (`art-src/blender/pieces.py`), exported as quantized meshes | the 3D board |
| Letters, labels, overlays, fallback art | drawn in code | everywhere; the vector board is the fallback with `?art=0` |
