# Bathhouse Letters: report

## What was built
An original crossword word-tile game for 1–4 players set among the hot springs of Hot Springs, Arkansas.
- **Board:** 15×15 marble on a walnut-and-brass frame, one square for each of the valley's 47 springs as Wikipedia
  counts them: the Display Spring at the centre and 46 premium squares (Warm ×2 letter, Hot ×3 letter, Steam ×2 word,
  Boiling Spring ×3 word) in stained glass, swirling out in a pinwheel. Eight Bathhouse Row squares, each a painted
  medallion of one historic bathhouse, double the bonus of a Hot Springs word laid over them.
- **Tiles:** 98 (2 blank "Steam tiles"), with counts and values computed from the dictionary's letter frequencies
  (`tools/build-tiles.mjs`), not taken from any commercial table.
- **Words:** ENABLE (public domain) minus a curated blocklist of slurs and crude words: 168,271 words (168,295 before
  the P-N04 blocklist additions were rebuilt into the data on 2026-11-22), plus the owner's 28-word supplement.
- **Hot Springs words:** 107 entries, 290 playable forms, each paying +10 / +18 / +30 (by the word's tier) and opening a fact card with
  its source (59 from the audited trivia bank, 11 quoting the research corpus, all verified by `tools/check-facts.mjs`).
  Three Featured Springs per game hide in steam on brass plaques (+30, a letter clears every round). The Bathhouse
  Register collects every Hot Springs word you play.
- **Modes:** against 1–3 computer opponents (four fictional town characters at three levels), pass-and-play for
  2–4 people with a privacy screen, and the Daily Soak (10 turns, the same tiles for everyone on a date, best score
  and streak).
- **Presentation:** a three.js board on a bathhouse counter (Blender tiles, frame, towels and desk bell), with a 2D
  fallback; painted art made for the game (title, glass, marble, terrazzo, counter, bathhouse medallions, portraits,
  fact-card paintings) plus 18 Barons vignettes; day and night themes; synthesized sound.
- **Input:** mouse drag-and-drop, touch with a floating tile and a lit target square, pinch zoom with an overview map, tap-to-place, and full
  keyboard play.

## Acceptance criteria (PRD §11)
| # | Status | Evidence |
|---|---|---|
| 1–3 Board and tiles | met | 02-rules |
| 4–7 Placement, validation, blanks, live preview | met | 02, 03 (50,029 plays vs the reference), 11, 13 |
| 8–12 Scoring and bonuses | met | 02, 03 (0 mismatches), 14 |
| 13–16 Turns and ending | met | 02, 11, 12, 19 |
| 17–20 Modes, privacy, Daily, Continue | met | 06 (golden hashes, 3 time zones), 12, 17 |
| 21 AI legality | met | 05: 7,576 AI actions in 300 games, all legal; 04 |
| 22 AI strength | met | Hard beats Medium 71 % (69 % over 100g, 70.7 % over 150g), Medium beats Easy 100 % (Easy ~209–215 pts vs Medium/Hard, 0 % obscure words, 0 Full Soaks; `tools/balance.mjs`, 150 games each) |
| 23 AI off the main thread | met | Worker; fallback tested (`?worker=0`) |
| 24 Hints | met | 11-play |
| 25–28 Hot Springs content | met | 07 (lexicon, facts), 14 (cards open; toast, Register, Featured); first built with 96 entries, 107 now (96/96 facts and all 96 cards were the count then) |
| 29 Every screen finished at both sizes | partial | every screen renders cleanly at both sizes (10-smoke, 15-visual, `checkLayout`); the visual review's gate (all categories ≥ 7) was not met: best 52.5/80 |
| 30 3D and 2D boards | met | 20-board3d (`--gpu`), `?gl=0` |
| 31 Day and night contrast | met | 16-a11y: no failures on any screen in either theme |
| 32 Animation and reduced motion | met | tile drops, score pops, steam, banners; 16-a11y reduced motion |
| 33 Sound | met (not listened to) | 21-audio renders every sound offline: audible, unclipped, short |
| 34–35 Mouse, touch, zoom, floating tile | met | 13-input |
| 36–37 Keyboard, live region | met | 13-input, 16-a11y |
| 38 No storage | met | 17-save |
| 39 Offline, no network, no console errors | met | every test; `--file-url --gpu` run |
| 40 Size and performance | met | 18-perf |

## Tests
- Node: dictionary, rules, reference (50,029 plays), move generator (exact against brute force), AI legality and
  vocabularies, Daily golden hashes, content and facts.
- Browser: the full matrix (`--milestone final`, slow tests included) passed 99/99 at 1280×800 and 390×844, plus
  GPU and file:// runs (state fuzz: 800 seeded steps; 4× CPU timings). See `TEST-CAMPAIGN.md`.

## Performance
| Measure | Result | Budget |
|---|---|---|
| `index.html` | 1.15 MB (three.js 530 KB, dictionary 330 KB) | ≤ 2 MB |
| Dictionary ready | 153 ms; 864 ms at 4× throttle | ≤ 1.5 s at 4× |
| Frame cost, 2D | idle 0.15 ms, dragging 2.5 ms | ≤ 8 / ≤ 12 ms |
| Frame cost, 3D (GPU) | idle 0.36 ms, dragging 1.1 ms, 60 fps | ≤ 8 / ≤ 12 ms |
| AI move at 4×, main thread | Easy ≤ 33 ms, Medium ≤ 102 ms, Hard ≤ 42 ms (sampled games) | ≤ 250 ms / ≤ 1.2 s |
| AI in Node (desktop) | median ~1 ms, p95 13 ms, max 123 ms | — |

## Balance (`tools/balance.mjs`, 150 games per pairing)
| Pairing | Win rate | Average scores | Hot Springs share | Full Soaks / game |
|---|---|---|---|---|
| Hard vs Medium | 71 % | 420 – 373 | 6.6 % | 2.0 |
| Medium vs Easy | 100 % | 447 – 215 | 2.6 % | 0.8 |
| Hard vs Easy | 100 % | 494 – 209 | 7.4 % | 1.4 |
Hot Springs bonuses come to 2.6–7.4 % of AI points under tier-scaled lexicon foresight (`bonusWeight`: Easy 0 %, Medium 50 %, Hard 100 %, W1-S2-08) while the locked +10 / +18 / +30 tiers stay untouched (CD-WF0-09; before Wave 2, all AI tiers used 100 % foresight for a 9.9–11.5 % AI share). The computer hunts them selectively by tier, so a person hunting them will see more. Computers claim 0.02 to 0.07 Featured Springs a game organically without hidden peeking (CD-WF1-06). All four town opponents carry orthogonal trade-grounded heuristics in `STYLES` independent of difficulty (Opal favours baths/springs words and Bathhouse Row squares, Hollis favours compact connected cross-plays, park words and open-spring defence, Lucky bets on multiplier squares with low leave caution, and Julian favours 5+ letter plays and balanced racks). Table: `node tools/balance.mjs --games 150`, seeds 1000 to 1149 (Medium `leave: 0.65`, `bonusWeight: 0.5`; Easy everyday words ~209–215 pts, `bonusWeight: 0`); Lucky vs Hollis (Medium, 150 games): 42 % win rate (375 – 387, premium share 0.441 vs 0.359).

## Visual results
Six scored review loops against Bathhouse Barons (two critics each: Claude and a Codex adversarial reviewer) took the
score from 43 to a best of **52.5/80**. Tiles and type and Hot Springs identity reached the benchmark (7); the other
six categories ended at 6–6.75. The campaign stopped at its six-loop cap, followed by an unscored defect pass. Details
and the remaining gaps: `VISUAL-REPORT.md`, `reviews/HISTORY.md`.

## v1.1.1: stuck tiles
Players on iPhone and iPad reported tiles that got stuck: lifted but never landing, or gone from the rack. A new
robustness suite (`tests/22-input-robust`, 20 tests) and a real-pointer input fuzz (`19-statefuzz`, 160 steps per
viewport) reproduced 14 defects (`DEV-PLAN.md` §5, #24–#37); 13 of the first 18 tests failed on v1.1.0. The main
one: starting a drag rebuilt the rack and removed the button under the finger, and WebKit sends the rest of that
touch to the removed node, so the release never arrived. Drags are now captured on a lasting element, every way a
drag can end without a drop puts the tile back where it came from, extra fingers are ignored while a tile is held,
and a Worker that dies silently falls back to the main thread after 8 s. Also fixed: tiles placed while the
computer's tiles were landing snapped back; the bottom rows were out of reach on 375×667 and smaller phones; rack
tiles were stuck at 40 px on phones; sideways phones squeezed the board to 60 px (they now get a board-left layout).
- Full matrix (`--milestone final`, Chromium, slow tests included): **121/121**. WebKit (`--browser webkit`, the
  engine-neutral suites, 58 runs): **58/58**. An independent Codex review found three more issues, all fixed.
- Staging a tile now costs 1.4 ms (median, stage + recall) since it redraws only the rack, actions and preview;
  dragging 3.2 ms per frame, idle 1.2 ms.
- Firefox could not run here: Playwright's Firefox build fails to start on this Windows build (a missing `mozglue`
  side-by-side assembly), so `--browser firefox` is wired up but untested. Real iOS devices were not available;
  WebKit on Windows and the "stays attached" check (the pressed button must stay in the page and `#app` must hold
  the capture) stand in for them.

## Update: repainted backgrounds (v1.2.0, 2026-11-02)

The title painting was repainted and its alt text now describes the new picture. The new source PNGs replace the
`art-src/art.json` sources (git-ignored; the workspace keeps copies of the old and new paintings in
`reference/backgrounds/`) and were packed with the usual tools. Older descriptions of these paintings in
VISUAL-REPORT.md refer to the previous art.

`npm test`: 115/115 passed.

## Known gaps
- The visual gate was not met (best 52.5/80; board materials, phone layout and small defects score 6–6.25). The
  likeliest next step is a fully painted board face, as Barons has.
- Nobody has listened to the sound or used a screen reader; both are tested only by machine (offline renders, the
  live region text).
- The Easy opponent is calibrated for beginners and casual play (~220–240 points against Medium/Hard, ~279 points in Easy mirror, using everyday common words plus 25 everyday two-letter words and no 7-letter Full Soaks).
- The Daily Soak resets at each player's local midnight, so two players in different time zones can be on different
  deals at the same moment.
- ENABLE lacks some newer short words (QI, ZA); the help says which list is used.

## Harness requests
- `shared/tools/inline.mjs` mis-parses an `export const` arrow function whose body has a regex literal containing
  quote characters (it split `esc`'s character class and produced "Unexpected number"). Worked around with function
  declarations in `src/js/ui.js`.
- `art-pack.mjs` rewrites `assets/manifest.json` from `art.json` alone, dropping assets copied in from elsewhere;
  `tools/build-art.mjs` re-adds them.
- CDP CPU throttling does not reach Web Workers, so AI timings at 4× need `?worker=0` (18-perf does this).
