# Bathhouse Letters: visual report

## Method
Six scored review loops (`VISUAL-PLAN.md`, `reviews/RUBRIC.md`): each loop shot the same 21 captures on the real GPU
(`tests/15-visual.test.mjs`, desktop 1280×800 and phone 390×844, day and night), and two independent critics scored
them out of 80 against Bathhouse Barons' screenshots as the benchmark: a Claude critic and a Codex adversarial critic.
Their merged fix lists were applied between loops (`reviews/loop-N/CHANGES.md`); the history is in
`reviews/HISTORY.md`.

## Scores
| Loop | Claude | Codex | Mean |
|---|---|---|---|
| 1 | 43 | 43 | 43.0 |
| 2 | 48 | 49 | 48.5 |
| 3 | 48 | 51 | 49.5 |
| 4 | 52 | 52 | 52.0 |
| 5 | 52 | 53 | **52.5** (best) |
| 6 | 51 | 53 | 52.0 |

Category means at the best loop (gate 7): board art and materials 6 · tiles and type **7** · desktop layout 6.75 ·
phone layout and touch 6.25 · Hot Springs identity **7** · interface consistency 6.75 · feedback and delight 6.75 ·
defects 6. After loop 6, a final defect pass (`reviews/loop-6/CHANGES.md`) fixed the outright defects both critics
listed; it was verified by the test suite and a fresh capture (`screenshots/visual-final`) but not re-scored.

## What changed over the campaign
- **Board:** painted marble cut differently for every square, stained-glass springs with cream (letter) and ink (word)
  scoring discs, one gold emblem (a domed bathhouse front) for the Bathhouse Row squares, used everywhere the Row appears, a lamp pool and inner frame shadow baked into
  the face, a Blender walnut-and-brass frame on a walnut counter with towels and a desk bell.
- **Tiles:** Blender-modelled ceramic tiles with letter faces drawn at 512 px, dark ink and bold point values; the
  last move edged in gold; blanks in the same ivory with a teal letter.
- **Feedback:** bonus banners take over the strip under the board (never covering the board or scores); fact cards
  carry painted scenes; the results screen is a Steam Ledger masthead with a winner's medallion.
- **Phone:** a square 3D board that runs the frame off the edges, tap-to-zoom with a magnifying loupe and an overview
  map, scores in the top bar, compact Featured Springs plaques, one-line ledger entries.
- **Consistency:** one primary-button style per theme, a single gold focus ring, sticky sheet headers, a muted night
  palette for banners and plaques.

## Where it stands
The campaign improved the score by 9.5 points (43 → 52.5) and ended at its six-loop cap without meeting the gate:
both critics rate the title art, the fact cards and the town identity at the benchmark's level, and the remaining
categories sit between 6 and 6.75, one step short. By the rubric's anchors that is "polished in most respects,
not yet as finished as Bathhouse Barons everywhere". The last two loops moved the score by under a point each, so
further gains need new art rather than more tuning (see below).

## Remaining gaps (from the final critiques)
- **Board materials (6):** the critics compare the board with Barons' fully painted board. A painted board face (marble
  with hand-painted inlay and an illustrated border, generated as one image like Barons' centre map) is the
  likeliest step up; the procedural frame and counter read as competent rather than crafted.
- **Phone layout (6.25):** at 390 px the overview board's squares are 23–24 px; the zoom, loupe and overview map work,
  but the critics would trade the Featured Springs block's height for board space.
- **Defects (6):** each loop surfaced a few new small ones (alignment, a stale state, a mismatched icon); the final pass
  fixed the listed ones, but it has not had a fresh scored review.
