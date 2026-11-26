# Bathhouse Letters refinement, November 2026

**Status: Superseded by WF-1..WF-7 pipeline waves (`pipeline/wave-4`); build-integrity and CI/pipeline gates resolved, pending post-wave verification and WF-6 re-audit.**

This document retains the historical early-November 2026 save-fix closure record and records the follow-up pipeline and build-integrity resolutions landed on `pipeline/wave-4`.

## Pipeline update (`pipeline/wave-4`, November 2026)

- **Deterministic builds (WF-01 resolved):** `shared/tools/inline.mjs` no longer embeds a wall-clock ISO timestamp in the generated banner comment, so `npm run build` produces byte-for-byte identical `index.html` across repeated runs (`<= 2.0 MiB` PRD cap).
- **Automated pipeline, data & CI gates:** `package.json` wires `tools/check-facts.mjs` (107/107 facts) and `tools/build-data.mjs` into `npm run data`, exposes explicit `build:art`, `build:fonts`, `build:three`, `build:meshes`, `check:facts`, and `check:pipeline` scripts, and runs `npm run test:save && npm run check:pipeline` in `pretest`. `.github/workflows/test.yml` installs `tools/dev` and runs `npm run check:facts && npm run check:pipeline -- --fresh` before the browser suite.
- **Asset & manifest verification:** `tools/build-art.mjs` fails loudly on `art-pack` errors (unless `--allow-missing` is passed explicitly) and writes uniform `{ file, w, h, bytes, from }` metadata for all 18 `vig-*` entries in `assets/manifest.json` (46 WebPs total). `tools/check-pipeline.mjs` verifies manifest completeness, `CANVAS_ART` / `art-list.js` / `art-data.js` (`<= 700 KB`) parity, `pieces-mesh.js` (`<= 25 KB`, peripheral props `<= 500` tris), `data/lexicon.game.json`, `src/js/worker-src.js`, and exact `index.html` freshness.
- **Vector fallback (`?art=0`):** `src/js/art.js` gates `art.has()` and `file://` `assets/art-data.js` injection on `art.on` and toggles `body.no-art`, paired with pure CSS gradient overrides in `src/styles/main.css` so `?art=0` triggers zero `.webp` or `art-data.js` loads.
- **Persistence & test coverage:** `npm run test:save` passes 32/32 Node save-slot tests; post-wave full-suite verification, idle-machine clerk checks, and WF-6 re-audit gate merge to `main`.

## Historical source and publication record (early November 2026 closure)

Earlier in November 2026, the user ended the initial scoped save-fix campaign early and directed integration of the recorded save fixes on `main` (campaign record `R41 / desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c`).

- Integrated source tip `1fbaf5b120d4774538a21b07f6a50852d7367457` (branch `refine/2026-11`). The original fix commits remain in the `main` history.
- The root `index.html` from that closure had SHA-256 `f14990180d985d661996ffb7a24d11cb48c2bc005b97e496e58e2d0dc7b68c2f`.
- Historical publication inventory recorded `v1.2.0` at commit `39264be7304747e1024d70e965cb75237028a691` (committed `index.html` SHA-256 `4e37eeefcec0bc5da820f2204a786f78b95c2e0dc68f2238e8f2d7b9cc3b19ec`; preflight records `p0-01-attempt1` and `p0-11-assessment`). Public deployment verification remains a release step after merge to `main`.

## Coverage matrix (historical campaign + wave status)

| Workflow | Historical scoped observation and current wave status |
| --- | --- |
| WF-01 Build and integrity | **Resolved on `pipeline/wave-4`.** Wall-clock timestamp removed from `shared/tools/inline.mjs`; `npm run build` is byte-for-byte deterministic and enforced by `tools/check-pipeline.mjs` in `pretest` and CI. |
| WF-02 Feature inventory | Historical scoped map superseded by WF-1..WF-6 contract audits and automated wave test suites (`tests/wave1-*`..`tests/wave4-*`). |
| WF-03 Core loop | Historical candidate Play reached a 24-move loss (382–435) and Daily reached a 10-turn terminal state (372); full rules/AI/Daily coverage verified across Node and browser wave suites. |
| WF-04 Input | Physical iPad Safari exercised native tile placement and Recall in the historical scope; desktop, mobile, touch, and keyboard paths are covered in automated Chromium/WebKit suites. |
| WF-05 Layout | Historical desktop and physical iPad observations retained; multi-viewport, safe-area, 130% text scale, and landscape checks added in Waves 1–4. |
| WF-06 Mechanics | Rules, 50,029-play reference validator, AI balance, Daily par, and Challenge invariants verified in automated Node and browser suites. |
| WF-07 Persistence | Scoped exact opaque save, Save and quit, read-only Continue, newer-save freeze (`CD-WF0-01`), endgame persistence ordering (`CD-WF6-03`), and 32/32 Node save tests verified. |
| WF-08 Audio | Automated offline cue, mix, limiter/ceiling, and recovery checks pass; human ear review of newly added wave cues remains on the manual checklist (lobby/table/dusk music approved 2026-11-25). |
| WF-09 Lifecycle | Pause audio-hold release, timer cancellation, WebGL context-loss recovery, and Worker Blob URL revocation covered in automated suites. |
| WF-10 Performance | Automated real-GPU quiet pass and perf budgets verified on desktop/mobile; long-soak and physical handset thermal checks remain manual. |
| WF-11 Accessibility | Keyboard navigation, focus traps, landmarks, WCAG contrast, 130% text scaling, and reduced-motion gates verified in automated suites. |
| WF-12 Content and licensing | 107/107 fact cards (`npm run check:facts`) and 37/37 owner-approved strings verified character for character. |
| WF-13 Player integration | Local Chrome/Edge/Playwright paths verified; production portal route verification follows release merge. |
| WF-14 Visual polish | Historical scoped screenshots retained; WF-2..WF-5 visual hierarchy, lighting, typography, and approved image updates (`title.webp`, `card-club.webp`, `terrazzo.webp`) verified in Waves 1–4. |

## Historical defect log (November 2026 save-fix closure)

| Severity | Recorded defect or finding | Status |
| --- | --- | --- |
| S0 | `word-tiles-baseline-daily-completion-erases-foreign-play-save` and `word-tiles-baseline-partial-v1-save-blocks-startup` | Fixed in `1fbaf5b120d4774538a21b07f6a50852d7367457` (covered by `tests-node/save.test.mjs`, 32/32 passing). |

Daily completion preserves a different Play save, and startup accepts the checked partial v1 save while preserving it on Continue (closure records `final-report-readiness-031009b8` and `desktop-word-tiles-save-final-ae7ae375`).

## Historical evidence tiers

- Installed Chrome and Edge basic player observations (`R41`) provided scoped desktop evidence.
- The physical iPad Safari lane (`ipad-route-verification-r8`, `ipad-final-report-c14434a9`) recorded 3 completed bounded gameplay runs across 4 attempts against `1fbaf5b120d4774538a21b07f6a50852d7367457`, preserving raw bytes of the identified Continue path.

## Remaining verification & manual checklist

- Automated post-wave full-suite run, idle-machine clerk checks, and WF-6 re-audit on `pipeline/wave-4` before merge to `main`.
- Physical iPhone Safari and Android Chrome handset play, performance, and thermal checks.
- Human ear/tactile sign-off on Wave 4 UI micro-foley, early-reflection reverb, persona barks, Night ambience, and 6 ms touch haptics (lobby, table, and dusk tunes were approved by the owner on 2026-11-25).
- Production portal deployment smoke check after release merge.
