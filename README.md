# Bathhouse Letters

An original crossword word-tile game set among the hot springs of Hot Springs, Arkansas. Part of **Hot Springs
Games**, an open-source (MIT) collection of browser games set in the town. The game ships as a self-contained
`index.html` (with painted art and fonts in `assets/`): sound is synthesized with WebAudio and nothing loads from the
network.

Build words on a marble bathhouse board whose 47 squares stand for the valley's springs, play against three
computer opponents or pass the device around, take the Daily Soak, and collect the town's own words, each with a
sourced fact card, in the Bathhouse Register.

All games in the collection are original designs. Real places appear as setting and history only; no logos are
reproduced and nothing implies endorsement. The opponents are fictional characters.

## Play

Open `index.html` in a browser, or serve the folder (`python -m http.server 8765`) and open http://127.0.0.1:8765/.
Add `?gl=0` for the flat board, `?worker=0` to run the computer on the main thread, `?art=0` for the vector art.

## Develop

```bash
npm run setup          # Playwright and Chromium for the test harness
cd tools/dev && npm install && cd ../..   # build-time tools: esbuild, three, OFL fonts
npm run data           # word lists → dictionary, tiles, board layout; lexicon and fact checks
npm run build          # AI worker bundle, then src/ → index.html (edit src/, not index.html)
npm test               # tests/*.test.mjs; screenshots land in screenshots/
npm test -- --browser webkit   # the engine-neutral suites on WebKit (iOS's engine); also firefox
```
WebKit and Firefox need `cd shared/test-harness && npx playwright install webkit firefox` once.

| Tool | Does |
|---|---|
| `tools/fetch-wordlists.mjs` | downloads ENABLE and SCOWL into `data/raw/` (git-ignored) with checksums |
| `tools/build-dict.mjs` | ENABLE minus `data/blocklist.txt`, SCOWL "common" flags → `data/dict.b64.txt` (front-coded, deflated) |
| `tools/build-tiles.mjs`, `tools/build-layout.mjs` | the tile set from letter frequencies; the 15×15 spring board, checked |
| `tools/check-lexicon.mjs`, `tools/check-facts.mjs`, `tools/build-data.mjs` | the Hot Springs words and their fact cards |
| `tools/selfplay.mjs`, `tools/balance.mjs` | fits the AI's rack-leave values; AI-vs-AI balance numbers |
| `tools/ref-validator.mjs` | an independent rules reference for tests |
| `tools/build-worker.mjs`, `build-three.mjs`, `build-fonts.mjs`, `build-art.mjs` | the AI worker, trimmed three.js, fonts, painted art |
| `art-src/blender/pieces.py` | the 3D tile, frame, towels and bell (headless Blender) |
| `tools/sync-repo.mjs` | copies the game into its standalone repo clone |

Design docs: `PRD.md`, `MECHANICS.md`, `DEV-PLAN.md`, `SAMPLES.md`, `REPORT.md`, `VISUAL-PLAN.md`, `VISUAL-REPORT.md`,
`TEST-CAMPAIGN.md`, `research/town-content.md`, `art-src/PROMPTS.md`.

## Credits and licences

- Code: MIT (see `LICENSE`). Third-party code in `vendor/` keeps its own licence (three.js, MIT).
- Dictionary: the ENABLE word list (public domain). Common-word flags from SCOWL by Kevin Atkinson
  (`data/LICENSES/SCOWL-Copyright.txt`).
- Fonts: Limelight, Fraunces and Josefin Sans (SIL Open Font License 1.1, `vendor/fonts/`).
- Painted art: made for the collection with OpenAI image generation (`art-src/PROMPTS.md`); landmark vignettes from
  Bathhouse Barons.
- Facts: the collection's audited trivia bank (`shared/data/trivia-questions.json`) and the research corpus copies in
  `research/`, each card citing its source.
