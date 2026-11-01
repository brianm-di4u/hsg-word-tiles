# Bathhouse Letters: development plan

## 1. Milestones
| Milestone | Scope | Exit |
|---|---|---|
| **M1 foundation** | data tools (dictionary, tiles, layout, lexicon, facts); `dict.js`, `rng.js`, `engine.js`, `score.js`; reference validator; Node rule tests; `src/` skeleton, inliner build, tokens; flat 2D board; tap-to-place hot-seat; `window.__game` | `--milestone m1` passes; a 2-human game plays to the end in the browser |
| **M2 core loop** | `movegen.js`, `ai.js`, worker + fallback; self-play leave fit; drag-and-drop (mouse, touch), zoom, loupe, keyboard; setup with seats; privacy screen; saves and Continue; game over | AI-vs-AI finishes in Node and browser; rules, AI legality, input tests pass |
| **M3 content and 3D** | bonus words, fact cards, Featured Springs, Register, Daily Soak; three.js board on a counter with Blender tiles; Codex art (pilot → set); fonts; all screens | content and modes tests pass; 3D and 2D shots reviewed |
| **M4 polish** | animation and steam, audio, night theme, reduced motion, text size, live region, hints, mobile tuning | a11y, touch, save and visual tests pass |
| **M5 campaign and release** | mechanics test campaign (reference model, state fuzz), visual review loops, perf and size pass, REPORT.md, VISUAL-REPORT.md | `--milestone final` passes at both viewports; every shot inspected |

## 2. Task breakdown
- **M1:** `tools/fetch-wordlists.mjs`, `build-dict.mjs`, `build-tiles.mjs`, `build-layout.mjs`,
  `check-lexicon.mjs`, `check-facts.mjs` (done before M1 code); `src/js/{dict,rng,tiles,layout,engine,score,lexicon}.js`;
  `tools/ref-validator.mjs`; `src/index.html`, `styles/main.css` (tokens), `render2d.js` (flat board),
  `ui.js`, `main.js`; tests 01, 02, 03, 07, 10.
- **M2:** `movegen.js`, `ai.js`, `worker-main.js` → `tools/build-worker.mjs` → `worker-src.js`,
  `aiclient.js`; `tools/selfplay.mjs`, `leave-table.js`, `tools/balance.mjs`; `input.js` (drag, tap, keys),
  `view.js` (zoom/pan/loupe); setup, privacy, over screens; `storage.js`; tests 04, 05, 11, 12, 13, 17, 20.
- **M3:** `themed.js` (plaques, register), fact dialog, `daily.js`; `board3d.js` + `tools/build-three.mjs`;
  `art-src/blender/tiles.py` → `tile-mesh.js`; `art-src/art.json` + Codex prompts → `assets/`;
  `tools/build-fonts.mjs`; help/about/register/daily screens; tests 06, 14, 15.
- **M4:** `audio.js`, tile flight and score roll-up, steam, theme switch, settings, hints, live region;
  tests 16, 18.
- **M5:** `tests/19-statefuzz`, `tests/21-interaction`, `TEST-CAMPAIGN.md`; `reviews/` loops; REPORT.md.

## 3. `window.__game` hook spec
See `MECHANICS.md` §9 (the authoritative list).

## 4. Test matrix
Node tests run with `node: true`. Browser tests run at desktop (1280×800) and mobile (390×844) unless noted.

| AC | Test | Screenshot(s) |
|---|---|---|
| 1 | 02-rules "layout counts"; 15-visual | `05-board` |
| 2, 3 | 02-rules "bag and deal" | — |
| 4 | 02-rules "placement errors"; 11-play "illegal play refused" | `11-error` |
| 5 | 02-rules "invalid word"; 11-play | `11-invalid` |
| 6 | 02-rules "blanks"; 11-play "blank dialog" | `11-blank` |
| 7 | 11-play "live preview" | `11-preview` |
| 8, 9 | 02-rules "premiums", "full soak" | — |
| 10, 11 | 02-rules "bonus words", "featured"; 14-themed | `14-toast`, `14-plaque-claimed` |
| 12 | 03-reference (50,000 plays) | — |
| 13, 14 | 02-rules "swap", "pass"; 11-play "swap dialog" | `11-swap` |
| 15, 16 | 02-rules "ending"; 12-modes "game over" | `12-over` |
| 17, 18 | 12-modes "setup", "privacy screen" | `12-setup`, `12-privacy` |
| 19 | 06-daily (golden hashes, node); 12-modes "daily" | `12-daily`, `12-daily-result` |
| 20 | 17-save "continue after reload" | `17-resumed` |
| 21 | 04-movegen "AI legality"; 05-ai | — |
| 22 | 05-ai "easy common"; `tools/balance.mjs` (REPORT) | — |
| 23 | 20-worker "worker", "fallback" | — |
| 24 | 11-play "hint" | `11-hint` |
| 25, 26, 27 | 07-content (node); 14-themed "fact card", "plaques clear", "register" | `14-fact`, `14-plaques`, `14-register` |
| 28 | 01-dict (node) | — |
| 29 | 10-smoke, 15-visual "every screen" | `01-title` … `09-about` |
| 30 | 15-visual "3D board" (`--gpu`), "2D fallback" | `20-board-3d`, `21-board-2d` |
| 31 | 16-a11y "contrast day/night" | `16-night` |
| 32 | 15-visual "tile flight", "steam"; 16-a11y "reduced motion" | `15-flight`, `15-steam` |
| 33 | 21-audio: every sound rendered offline (audible, unclipped, short) | — |
| 34, 35 | 13-input "mouse drag", "touch drag", "tap", "zoom and loupe" | `13-loupe`, `13-zoomed` |
| 36, 37 | 16-a11y "keyboard game", "live region" | `16-keyboard` |
| 38 | 17-save "storage throws" | — |
| 39 | every test (harness); `--file-url --gpu` run | — |
| 40 | 18-perf "size", "frame cost", "AI time at 4×" (worker and main thread) | — |
| all | 19-statefuzz (seeded walks, shadow model, slow); 15-visual (review captures, GPU) | `v01`–`v11` |

## 5. Defect log
| # | Milestone | Symptom | Root cause | Fix | Test |
|---|---|---|---|---|---|
| 1 | data | DAWG lists merged words (`ANTISCORON`) | node signature joined letter and child id without a separator (`1`+`23` = `12`+`3`) | separator in the key | build-dict self-check |
| 2 | data | Dictionary 489 KB packed (budget 450) | child pointers in the DAWG compress poorly | ship the front-coded word list (322 KB), build the DAWG at load | build-dict budget |
| 3 | data | Front-coded words decoded wrong (`AALSBRDVARKHS`) | common markers 64–79 overlapped letters A–O | markers 48+p and 97+p | build-dict self-check |
| 4 | data | Blocklist stems removed real words (injunction, squawk, clitic, japed) | stems too short | exact entries instead | `--show-blocked` review |
| 5 | data | V had 2 tiles, F 1 | largest-remainder ignored the floor-of-one bump | remainder = share − count | build-tiles table |
| 6 | M1 | Tile values summed to 308 (scores ~550 a game) | linear rarity → value scale | convex curve (exponent 1.7): face value 215 | build-tiles table; balance |
| 7 | M2 | Hot Springs bonuses only 1–2 % of points | lexicon held mostly rare words | 26 everyday entries added (WATER, HOT, ROCK, ROW, POOL …), each sourced: 4.8–6.3 % | balance |
| 8 | M2 | Hard beat Medium only 53–61 % | leave equity alone is a small edge; empty leave scored 0 while a 1-tile leave carried the vowel intercept (Hard avoided Full Soaks) | intercepts measured from the empty leave; Medium limited to common words plus all 2–3 letter words: Hard 76 % | balance; 05-ai |
| 9 | M2 | Featured word letters overflowed the plaque on phones | fixed 14 px letter boxes × 8 | flexible boxes | 15-visual |
| 10 | M2 | Bundle threw "Unexpected number" | the shared inliner mis-parses `export const` arrows containing a regex with quotes | function declarations in ui.js (harness request in REPORT) | 10-smoke |
| 11 | M3 | 3D tile letters mirrored | face canvas pre-flipped although CanvasTexture already flips | no flip | 20-board3d |
| 12 | M3 | Letters washed out near the lamp | glossy clearcoat on tile faces reflected the spot | lower clearcoat, higher roughness | 20-board3d shots |
| 13 | M3 | Fact cards sometimes opened empty | the title re-rendered when art or the dictionary finished loading and closed the dialog | re-render only without an open dialog | 14-themed (96 cards) |
| 14 | M3 | Plaque letters 4.05:1 contrast | semi-transparent letter boxes over gold | opaque boxes | 16-a11y |
| 15 | M3 | Screenshots caught half-faded dialogs | isIdle ignored the 0.2 s dialog animation | idle waits 260 ms after a dialog opens | 15-visual |
| 16 | M3 | Stale error text after a refused play | flash message outlived the staging change | flash clears on staging and on every action | 11-play |
| 17 | V1 | Toasts covered the header, plaques and board on phones | fixed-position toast | banner in the preview strip | 15-visual |
| 18 | V1 | Loupe missing over occupied squares | loupe keyed to the drop target, which is −2 there | loupe follows the hovered square, marks taken squares | 15-visual v10 |
| 19 | V1 | Re-packing art dropped the 18 Barons vignettes from the list | art-pack rewrites the manifest from art.json | build-art keeps vig-* files | art-list count |
| 20 | V2 | Old preview text showed through the bonus banner (night) | the banner faded in over the strip and screenshots caught it mid-fade | the strip's text hides while a banner shows; the banner slides, no fade | 15-visual v09 |
| 21 | V2 | Phone winner name wrapped to three lines | desktop's three-column winner card on 390 px | grid reflow on phones | 15-visual v06 |
| 22 | V2 | 3D tile letters greyed | an untextured white emissive lifted the ink | emissive mapped through the face texture | 15-visual v04, v09 |
| 23 | Final | From file://, the counter and help swatch images failed to load | CSS is inlined into index.html, so `url(../assets/…)` resolved outside the game folder (over http it only worked by accident) | `url(assets/…)` | 10-smoke "offline …" (fileUrl) |
