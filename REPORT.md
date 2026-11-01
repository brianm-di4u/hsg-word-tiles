# Bathhouse Letters: report

## What was built
An original crossword word-tile game for 1–4 players set among the hot springs of Hot Springs, Arkansas.
- **Board:** 15×15 marble on a walnut-and-brass frame, one square for each of the valley's 47 springs as Wikipedia
  counts them: the Display Spring at the centre and 46 premium squares (Warm ×2 letter, Hot ×3 letter, Steam ×2 word,
  Boiling Spring ×3 word) in stained glass, swirling out in a pinwheel. Eight Bathhouse Row squares, each a painted
  medallion of one historic bathhouse, double the bonus of a Hot Springs word laid over them.
- **Tiles:** 98 (2 blank "Steam tiles"), with counts and values computed from the dictionary's letter frequencies
  (`tools/build-tiles.mjs`), not taken from any commercial table.
- **Words:** ENABLE (public domain), 168,295 words, minus a curated blocklist of slurs and crude words.
- **Hot Springs words:** 96 entries, 267 playable forms, each paying +10 / +15 / +25 and opening a fact card with
  its source (59 from the audited trivia bank, 11 quoting the research corpus, all verified by `tools/check-facts.mjs`).
  Three Featured Springs per game hide in steam on brass plaques (+30, a letter clears every round). The Bathhouse
  Register collects every Hot Springs word you play.
- **Modes:** against 1–3 computer opponents (four fictional town characters at three levels), pass-and-play for
  2–4 people with a privacy screen, and the Daily Soak (10 turns, the same tiles for everyone on a date, best score
  and streak).
- **Presentation:** a three.js board on a bathhouse counter (Blender tiles, frame, towels and desk bell), with a 2D
  fallback; painted art made for the game (title, glass, marble, terrazzo, counter, bathhouse medallions, portraits,
  fact-card paintings) plus 18 Barons vignettes; day and night themes; synthesized sound.
- **Input:** mouse drag-and-drop, touch with tap-to-zoom, a loupe and an overview map, tap-to-place, and full
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
| 22 AI strength | met | Hard beats Medium 76 %, Medium beats Easy 100 % (`tools/balance.mjs`, 150 games each) |
| 23 AI off the main thread | met | Worker; fallback tested (`?worker=0`) |
| 24 Hints | met | 11-play |
| 25–28 Hot Springs content | met | 07 (lexicon, 96/96 facts), 14 (all 96 cards open; toast, Register, Featured) |
| 29 Every screen finished at both sizes | partial | every screen renders cleanly at both sizes (10-smoke, 15-visual, `checkLayout`); the visual review's gate (all categories ≥ 7) was not met: best 52.5/80 |
| 30 3D and 2D boards | met | 20-board3d (`--gpu`), `?gl=0` |
| 31 Day and night contrast | met | 16-a11y: no failures on any screen in either theme |
| 32 Animation and reduced motion | met | tile drops, score pops, steam, banners; 16-a11y reduced motion |
| 33 Sound | met (not listened to) | 21-audio renders every sound offline: audible, unclipped, short |
| 34–35 Mouse, touch, zoom, loupe | met | 13-input |
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
| Hard vs Medium | 76 % | 413 – 365 | 6.3 % | 1.9 |
| Medium vs Easy | 100 % | 454 – 211 | 5.9 % | 0.7 |
| Hard vs Easy | 100 % | 489 – 195 | 4.8 % | 1.5 |
Hot Springs bonuses come to 4.8–6.3 % of all points (target 5–10 %): the computer plays them only when they score
well, so a person hunting them will see more. Featured Springs are claimed in about 1 game in 10 by computers.

## Visual results
Six scored review loops against Bathhouse Barons (two critics each: Claude and a Codex adversarial reviewer) took the
score from 43 to a best of **52.5/80**. Tiles and type and Hot Springs identity reached the benchmark (7); the other
six categories ended at 6–6.75. The campaign stopped at its six-loop cap, followed by an unscored defect pass. Details
and the remaining gaps: `VISUAL-REPORT.md`, `reviews/HISTORY.md`.

## Known gaps
- The visual gate was not met (best 52.5/80; board materials, phone layout and small defects score 6–6.25). The
  likeliest next step is a fully painted board face, as Barons has.
- Nobody has listened to the sound or used a screen reader; both are tested only by machine (offline renders, the
  live region text).
- The Easy opponent is soft for adults (about 200 points a game); it is meant for beginners and children.
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
