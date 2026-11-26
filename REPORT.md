# Bathhouse Letters: report

## What was built
An original crossword word-tile game for 1–4 players set among the hot springs of Hot Springs, Arkansas.
- **Board:** 15×15 marble on a walnut-and-brass frame, one square for each of the valley's 47 springs as Wikipedia
  counts them: the Display Spring at the centre and 46 premium squares (Warm ×2 letter, Hot ×3 letter, Steam ×2 word,
  Boiling Spring ×3 word) in stained glass, swirling out in a pinwheel. Eight Bathhouse Row squares, each a painted
  medallion of one historic bathhouse, add a flat +20 to a Hot Springs word laid over them.
- **Tiles:** 98 (2 blank "Steam tiles"), with counts and values computed from the dictionary's letter frequencies
  (`tools/build-tiles.mjs`), not taken from any commercial table.
- **Words:** ENABLE (public domain) minus a curated blocklist of slurs and crude words: 168,271 words (168,295 before
  the P-N04 blocklist additions were rebuilt into the data on 2026-11-22), plus the owner's 28-word supplement.
- **Hot Springs words:** 107 entries, 290 playable forms, each paying +10 / +18 / +30 (by the word's tier) and opening a fact card with
  its source (95 from the audited trivia bank, 12 quoting the research corpus — 107/107 verified by `tools/check-facts.mjs`).
  Three Featured Springs per game hide in steam on brass plaques (+30, letters clear as the bag empties). The Bathhouse
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
| 22 AI strength | met | Hard beats Medium 73 % (2,000 games; 73 % over 100g, 74.7 % over 150g), Medium beats Easy 100 % (Easy ~243–254 pts vs Hard/Medium under Option B `OQ-WF7-W2-01`, 0 % obscure words, 0 Full Soaks; `tools/balance.mjs`, 150 games each) |
| 23 AI off the main thread | met | Worker; fallback tested (`?worker=0`) |
| 24 Hints | met | 11-play |
| 25–28 Hot Springs content | met | 07 (lexicon, facts), 14 (cards open; toast, Register, Featured); first built with 96 entries, 107 now (96/96 facts and all 96 cards were the count then) |
| 29 Every screen finished at both sizes | met | every screen renders cleanly at both sizes (10-smoke, 15-visual, `checkLayout`, and Waves 1–5 visual/UI suites; owner-approved `title.webp`, `card-club.webp`, and seamless `terrazzo.webp`) |
| 30 3D and 2D boards | met | 20-board3d (`--gpu`), `?gl=0` |
| 31 Day and night contrast | met | 16-a11y: no failures on any screen in either theme |
| 32 Animation and reduced motion | met | tile drops, score pops, steam, banners; 16-a11y reduced motion |
| 33 Sound | met (music owner-approved; live SFX/Night ambience awaiting final human listen) | 21-audio + full-volume probe verify 0 clipped samples; lobby, table, and dusk music approved by owner on 2026-11-25 (`OQ-WF7-W3-06`) |
| 34–35 Mouse, touch, zoom, floating tile | met | 13-input |
| 36–37 Keyboard, live region | met | 13-input, 16-a11y |
| 38 No storage | met | 17-save |
| 39 Offline, no network, no console errors | met | every test; `--file-url --gpu` run |
| 40 Size and performance | met | 18-perf |

## Tests
- Node: dictionary, rules, reference (50,029 plays), move generator (exact against brute force), AI legality and
  vocabularies, Daily golden hashes, content and facts.
- Browser & wave suite: expanded from the initial 99/99 baseline to 805/805 after Wave 4 and 814/814 after Wave 5
  Batch 2 across 1280×800, 390×844, and Node checks, plus GPU, `file://`, 32/32 Node save-slot tests (`npm run test:save`),
  and `npm run check:pipeline`. See `TEST-CAMPAIGN.md` and `REFINEMENT-2026-11.md`.

## Performance
| Measure | Result | Budget |
|---|---|---|
| `index.html` | 1.48 MiB (1,515.9 KiB / 1,552,313 bytes on 26 Nov 2026; three.js 532.8 KiB / 32 exports, dictionary 321.9 KiB) | ≤ 2.0 MiB |
| Dictionary ready | 153 ms; 864 ms at 4× throttle | ≤ 1.5 s at 4× |
| Frame cost, 2D | idle 0.15 ms, dragging 2.5 ms | ≤ 8 / ≤ 12 ms |
| Frame cost, 3D (GPU) | idle 0.36 ms, dragging 1.1 ms, 60 fps | ≤ 8 / ≤ 12 ms |
| AI move at 4×, main thread | Easy ≤ 33 ms, Medium ≤ 102 ms, Hard ≤ 42 ms (sampled games) | ≤ 250 ms / ≤ 1.2 s |
| AI in Node (desktop) | median ~1 ms, p95 13 ms, max 123 ms | — |

## Balance (`tools/balance.mjs`, 150 games per pairing)
| Pairing | Win rate | Average scores | Hot Springs share | Full Soaks / game |
|---|---|---|---|---|
| Hard vs Medium | 75 % (73 % of 2,000) | 427 – 375 | 7.2 % | 1.9 |
| Medium vs Easy | 100 % | 430 – 254 | 3.5 % | 0.7 |
| Hard vs Easy | 100 % | 475 – 244 | 6.9 % | 1.3 |
Hot Springs bonuses come to 3.5–7.2 % of AI points under tier-scaled lexicon foresight (`bonusWeight`: Easy 0 %, Medium 50 %, Hard 100 %, W1-S2-08) while the locked +10 / +18 / +30 tiers stay untouched (CD-WF0-09; before Wave 2, all AI tiers used 100 % foresight for a 9.9–11.5 % AI share). The computer hunts them selectively by tier, so a person hunting them will see more. Computers claim 0.23 to 0.36 Featured Springs a game without hidden peeking (CD-WF1-06): Medium and Hard go for one only when its plaque can be worked out (two letters or fewer in the fog, one entry of the lexicon left; W6-S3-02), and Easy never does. Before that rule they counted none and claimed 0.03 to 0.07 by chance. All four town opponents carry orthogonal trade-grounded heuristics in `STYLES` independent of difficulty (Opal favours baths/springs words and Bathhouse Row squares, Hollis favours compact connected cross-plays, park words and open-spring defence, Lucky bets on multiplier squares with low leave caution, and Julian favours 5+ letter plays and balanced racks). Table: `node tools/balance.mjs --games 150`, seeds 1000 to 1149 (Medium `leave: 0.65`, `bonusWeight: 0.5`; Easy Option B `slip: 0.60`, `pick: [0.05, 0.35]`, `maxLen: 6`, `bonusWeight: 0`, everyday words ~243–254 pts, 0 % obscure words, 0 Full Soaks); Lucky vs Hollis (Medium, 150 games): 43 % win rate (384 – 400, premium share 0.388 vs 0.313, counting what the multiplied letters and words earn and no flat bonus, W6-S1-03; before that 39 %, 382 – 399).

## Visual results
An early six-loop review against Bathhouse Barons took the initial baseline from 43 to **52.5/80** (`VISUAL-REPORT.md`,
`reviews/HISTORY.md`). Subsequent pipeline Waves 1–5 superseded that baseline with honed warm travertine and twilight Night
marble, brass-bezel painted Bathhouse Row medallions, tightened 3D desktop framing, collapsible mobile Featured Springs
bar, and owner-approved OpenAI/Gemini art updates (`title.webp`, `card-club.webp`, and seamless `terrazzo.webp`).

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
- The early 52.5/80 visual review was superseded by Waves 1–5 material, layout, and owner-approved art updates (`title.webp`, `card-club.webp`, `terrazzo.webp`); physical handset touch and thermal checks remain on the release checklist (`REFINEMENT-2026-11.md`).
- The lobby, table, and dusk music renders were listened to and approved by the owner on 2026-11-25 (`OQ-WF7-W3-06`), while live interactive SFX/Night ambience (`OQ-WF6-03`) and an NVDA/VoiceOver screen-reader pass remain on the pre-release human sign-off checklist (`W6-S1-03`).
- The Easy opponent is calibrated for beginners and casual play (~243–254 points against Hard/Medium, ~285 points in Easy mirror, using everyday common words plus 25 everyday two-letter words and no 7-letter Full Soaks).
- The Daily Soak resets at each player's local midnight, so two players in different time zones can be on different
  deals at the same moment.
- On Windows, Chrome logs one shader message when the 3D board starts ("Program Info Log ... warning X4122: sum of
  0.996094 and -2.98545e-017 cannot be represented accurately"). It is the Direct3D compiler's note on a constant in
  three.js r186's own shader code, the same before and after the board, counter and bell became standard materials
  (measured on a real GPU, 25 Nov 2026). Nothing is drawn wrongly, so it is left as it is: no shader is patched for it.
- ENABLE lacks some newer short words (QI, ZA and others); the 28-word supplement (`src/js/supplement.js`) adds them, and
  About says which words are added. Other newer words are still refused.

## Harness requests
- `shared/tools/inline.mjs` mis-parses an `export const` arrow function whose body has a regex literal containing
  quote characters (it split `esc`'s character class and produced "Unexpected number"). Worked around with function
  declarations in `src/js/ui.js`.
- `art-pack.mjs` rewrites `assets/manifest.json` from `art.json` alone, dropping assets copied in from elsewhere;
  `tools/build-art.mjs` re-adds them.
- CDP CPU throttling does not reach Web Workers, so AI timings at 4× need `?worker=0` (18-perf does this).
