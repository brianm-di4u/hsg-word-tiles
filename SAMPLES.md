# Code-sample survey

The crossword word-tile genre is dominated by one commercial title and its clones. Per the session brief,
no clone's code, board, tile table or rules text was used: the open-source crossword-game projects below
were looked at only far enough to read their licence, and are listed so the exclusion is on record. The
foundation is published algorithms (papers) plus our own collection's MIT code. Nothing was downloaded,
installed, built or run except the public-domain and MIT-like word lists in `data/raw/` (git-ignored,
fetched by `tools/fetch-wordlists.mjs` with SHA-256 checks).

| # | Sample | URL | Licence | Version (2026-11-01) | Verdict |
|---|---|---|---|---|---|
| 1 | Appel & Jacobson, "The World's Fastest Scrabble Program", CACM 31(5), 1988 | https://users.cs.northwestern.edu/~robby/uc-courses/22001-2008-winter/worlds-fastest-scrabble-appel-jacobson.pdf | paper | 1988 | **Algorithm adopted** (anchors, cross-checks, LeftPart/ExtendRight over a DAWG), written from the paper |
| 2 | Gordon, "A Faster Scrabble Move Generation Algorithm", SP&E 24(2), 1994 (GADDAG) | https://users.cs.northwestern.edu/~robby/uc-courses/22001-2008-winter/faster-scrabble-gordon.pdf | paper | 1994 | Idea only: GADDAG is about 2× faster but ~5× larger; we keep the DAWG (size budget, mobile memory) |
| 3 | Daciuk, Mihov, Watson & Watson, "Incremental Construction of Minimal Acyclic Finite-State Automata", Computational Linguistics 26(1), 2000 | https://aclanthology.org/J00-1002.pdf | paper | 2000 | **Algorithm adopted** for the DAWG build from sorted input (`buildDawg` in `src/js/dict.js`) |
| 4 | Bathhouse Barons (our collection) | `C:\Video Game Projects\repos\hsg-property-game` | MIT | v1 (2026-10-29) | **Code adapted**: `rng.js`, three.js board-on-table renderer pattern (`board3d.js`), `audio.js` synth, `tools/build-three.mjs`, `build-fonts.mjs`, `build-art.mjs`, `check-facts.mjs`, settings/save/`window.__game` patterns, 31 painted landmark vignettes |
| 5 | Bathhouse Mahjong (our collection) | `C:\Video Game Projects\repos\hsg-mahjong` | MIT | v2.1.0 | **Method adapted**: Blob-URL Web Worker with node budgets, `tools/engine-load.mjs` idea, the mechanics test campaign (reference model, seeded state fuzz with a shadow model, defect log) |
| 6 | bryc, PRNGs (mulberry32) | https://github.com/bryc/code/blob/master/jshash/PRNGs.md | public domain | via Barons `rng.js` | **Adopted** (through #4) |
| 7 | MDN, `DecompressionStream` | https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream | CC-BY-SA docs (API only) | — | API reference; the dictionary inflates with the browser's own codec, no library |

Word lists (data, not code):

| Data | URL | Licence | Version | Use |
|---|---|---|---|---|
| ENABLE (enable1.txt) | https://github.com/dolph/dictionary | public domain ("formally released into the Public Domain", ENABLE README) | commit 233d25a5, sha256 3f161302… | The dictionary: 172,823 words, 2–15 letters kept, minus `data/blocklist.txt` → 168,295 |
| SCOWL 2020.12.07 (english/american-words.10–50) | http://wordlist.aspell.net/ | MIT-like (Kevin Atkinson; notice in `data/LICENSES/SCOWL-Copyright.txt`) | 2020.12.07 | One bit per word: "common" (60,360 words), so the Easy AI plays familiar words |
| LDNOOBW `en` | https://github.com/LDNOOBW/List-of-Dirty-Naughty-Obscene-and-Otherwise-Bad-Words | CC BY 4.0 | 5faf2ba4 | Read for comparison only and **not used**: it removes ordinary words (ASS, COCK, TIT, ESCORT, SNATCH). `data/blocklist.txt` is our own shorter list |

Excluded (clones of the commercial game, or GPL), licence checked only:

| Project | Licence | Why excluded |
|---|---|---|
| Xanado (github.com/cdot/Xanado) | README says MIT; GitHub detects none | A clone of the commercial game; brief forbids borrowing from clones |
| scrabble-solver (github.com/kamilmielnik/scrabble-solver) | not detected (NOASSERTION) | Clone tooling; licence unclear |
| Quackle (github.com/quackle/quackle) | not detected | Clone engine; its leave data is not used |
| Macondo (github.com/domino14/macondo) | GPL-3.0 | GPL; never copied |

## How the pieces fit
- **Dictionary:** ship the sorted word list front-coded and deflated (287 KB without flags, 322 KB with
  the common bit), build the minimal DAWG at load time with Daciuk's algorithm (#3). Shipping the DAWG
  itself packed to 489 KB because child pointers compress poorly; building it costs ~170 ms on a laptop,
  off the critical path (title screen, and inside the AI worker).
- **Move generation:** Appel–Jacobson (#1) on that DAWG: anchors, per-square cross-check bitmasks,
  LeftPart and ExtendRight, across on the board and down on its transpose.
- **AI equity:** score + rack-leave value. The leave values are fitted by our own Node self-play
  (`tools/selfplay.mjs`), not taken from any engine.
- **Everything around it** (board on a table in three.js, painted art pipeline, fonts, audio, saves,
  test hooks, fact checking) follows Bathhouse Barons (#4); the test campaign follows Mahjong (#5).
