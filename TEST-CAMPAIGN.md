# Bathhouse Letters: test campaign

Method from Bathhouse Mahjong's campaign: test every rule against an independent reference, walk the real UI with
seeded random steps against a shadow model, drive real pointer, touch and keyboard input, and leave a regression test
for every defect fixed (`DEV-PLAN.md` §5 is the defect log).

## What was built
| File | Kind | What it checks |
|---|---|---|
| `tests/01-dict` | Node | The packed dictionary decodes to exactly ENABLE minus the blocklist (168,295 words, hash-checked); common flags; lookups at the edges; blocked words absent |
| `tests/02-rules` | Node | Layout counts and symmetry; bag and deal; every placement error; premiums only on new squares; word premiums; Full Soak and blanks; Bathhouse Row doubling; Featured Spring once; swap and pass; going out and stalling; the Daily; plaque reveals |
| `tests/03-reference` | Node | 50,029 plays (generated, mutated and random) through the engine and through `tools/ref-validator.mjs`, an independent from-scratch scorer: 0 mismatches (26,870 legal) |
| `tests/04-movegen` | Node | ~25,000 generated moves re-scored by the engine (all equal); brute-force completeness for 3-tile racks on 12 positions (no missed or extra moves); greedy games finish |
| `tests/05-ai` | Node | 7,576 AI actions over 300 games (all pairings and 4-seat tables): all legal; Easy and Medium vocabularies hold (3,010 words checked); leave-table sanity |
| `tests/06-daily` | Node | 400 Daily deals hashed against `tests/golden-daily.json` in Chicago, Honolulu and Tokyo time |
| `tests/07-content` | Node | Lexicon check (96 entries, 267 forms, all in the dictionary); fact check (96/96 verified against the audited bank or a research quote); featured picks over 500 seeds |
| `tests/10-smoke` … `18-perf`, `20-board3d` | Browser | Boot, screens (and the whole game from file://), the core loop, modes, real input, Hot Springs UI, contrast, saves, performance, 3D and 2D boards |
| `tests/19-statefuzz` | Browser, slow | Seeded random walks (400 steps per viewport: staging junk, recall, play, swap, pass, shuffle, hint, `setState` round-trips, reload and Continue) checked after every step: tiles conserved (98), scores equal the ledger, turn order, staging consistent, refused plays change nothing, the save matches the board |
| `tests/15-visual` | Browser, GPU | The fixed capture set for the visual review loops |

## Coverage matrix
| Function | Engine (Node) | 2D | 3D | Desktop | Phone | Tests |
|---|---|---|---|---|---|---|
| Placement legality and every error | ✓ (+ reference) | ✓ | ✓ | ✓ | ✓ | 02, 03, 11, 19 |
| Scoring: premiums, Full Soak, blanks | ✓ (+ reference) | ✓ | ✓ | ✓ | ✓ | 02, 03, 04, 11 |
| Hot Springs bonus, Row doubling, Featured | ✓ (+ reference) | ✓ | — | ✓ | ✓ | 02, 03, 14 |
| Move generation and AI legality | ✓ | — | — | ✓ | ✓ | 04, 05, 11, 18 |
| Swap, pass, ending, rack penalties | ✓ | ✓ | — | ✓ | ✓ | 02, 11, 19 |
| Daily determinism and records | ✓ | ✓ | — | ✓ | ✓ | 02, 06, 12 |
| Saves, Continue, corrupt save, no storage | — | ✓ | — | ✓ | ✓ | 12, 17, 19 |
| Mouse drag, drag back, rack reorder | — | ✓ | — | ✓ | — | 13 |
| Touch: tap-zoom, drag with loupe, tap to place and recall | — | ✓ | ✓ (visual) | — | ✓ | 13, 15 |
| Keyboard play | — | ✓ | — | ✓ | ✓ | 13 |
| Picking through the 3D camera | — | — | ✓ | ✓ | ✓ | 20 |
| Offline (file://), 3D included | — | ✓ | ✓ | ✓ | ✓ | 10 (offline), `--file-url --gpu` run |
| Contrast day and night, live region, reduced motion, text size | — | ✓ | — | ✓ | ✓ | 16 |
| Size, frame cost, AI time at 4×, Worker fallback | — | ✓ | — | ✓ | ✓ | 18 |

## Results (latest runs)
- Full matrix (`--milestone final`, Node, browser and slow tests): 99/99. GPU and file:// runs: pass.
- Performance: `index.html` 1.15 MB; idle frame 0.15 ms, dragging 2.5 ms; dictionary 153 ms (864 ms at 4×);
  AI at 4× on the main thread (no Worker): Easy ≤ 33 ms, Medium ≤ 102 ms, Hard ≤ 42 ms per move in these games.
