# Bathhouse Letters refinement, November 2026

**Source fixes integrated. Formal release HOLD.**

The user ended testing early and directed integration of the recorded fixes. This closure records the fixes and retained generated runtime on the game repository’s main branch. Earlier findings and results retain their original scope. Full qualification and production deployment remain unverified. [R41 campaign record](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)

## Source and publication

- Integrated source tip `1fbaf5b120d4774538a21b07f6a50852d7367457`. The original fix commits remain in the main history.
- The root `index.html` was updated from the retained candidate artifact, SHA-256 `f14990180d985d661996ffb7a24d11cb48c2bc005b97e496e58e2d0dc7b68c2f`. No additional testing was run for this closure.


The historical publication inventory records `v1.2.0` at commit `39264be7304747e1024d70e965cb75237028a691`. The corresponding committed index SHA-256 was `4e37eeefcec0bc5da820f2204a786f78b95c2e0dc68f2238e8f2d7b9cc3b19ec`. Current public response bytes and deployment identity still require verification. [Historical site ref inventory](<C:/Video Game Projects/campaigns/refinement-2026-11/preflight/p0-01-attempt1/stdout.txt>) · [Committed index inventory](<C:/Video Game Projects/campaigns/refinement-2026-11/preflight/p0-11-assessment/stdout.txt>)

- Local `refine/2026-11` at `1fbaf5b120d4774538a21b07f6a50852d7367457` in `D:/hsg-campaign/worktrees/word-tiles/refine-2026-11-savefix-20261104`.

## Coverage matrix

The rows record bounded observations by workflow. Formal completion of each applicable workflow and profile is still pending. [Workflow and profile requirements](<C:/Video Game Projects/campaigns/refinement-2026-11/MASTER-PROMPT.md>)

| Workflow | Scoped evidence and remaining work |
| --- | --- |
| WF-01 Build and integrity | Historical preflight retained the committed index and the rebuilt digest. The generated timestamp difference was recorded as a baseline build-integrity failure. |
| WF-02 Feature inventory | Complete feature-to-real-input coverage map remains pending. |
| WF-03 Core loop | Candidate Play reached a 24-move loss, 382–435. Candidate Daily reached an actual 10-turn terminal state, score 372. |
| WF-04 Input | Physical iPad Safari exercised native tile placement and Recall in the baseline and candidate follow-up scopes. |
| WF-05 Layout | Scoped desktop rendering and physical iPad rendering are retained. Full viewport, safe-area, scale and rotation checks remain pending. |
| WF-06 Mechanics | Independent full rules, seeded shadow models and balance comparisons remain pending. |
| WF-07 Persistence | Scoped exact opaque save, Save and quit, readonly Continue and result reload passed. Physical follow-up used genuine saved state and preserved the identified Continue raw bytes. |
| WF-08 Audio | Full real-input audio, analyser and recovery evidence remains pending. Human audibility remains unverified. |
| WF-09 Lifecycle | Full lifecycle matrix remains pending. Individual actions are listed in the retained scoped evidence. |
| WF-10 Performance | Hardware-qualified frame cost, throttled load and 30-minute soak remain pending. |
| WF-11 Accessibility | Full keyboard, contrast, scalable text and assistive checks remain pending. |
| WF-12 Content and licensing | Complete help, site controls, claims and licensing audit remains pending. |
| WF-13 Player integration | Scoped local player paths were observed in Chrome and Edge. Current formal workflow, exact production routes and candidate smoke remain pending. |
| WF-14 Visual polish | Scoped screenshots and visual review are retained. Complete all-screen visual assessment remains pending. |

## Defect log

| Severity | Recorded defect or finding | Local status |
| --- | --- | --- |
| S0 | `word-tiles-baseline-daily-completion-erases-foreign-play-save` and `word-tiles-baseline-partial-v1-save-blocks-startup` | Integrated fix `1fbaf5b120d4774538a21b07f6a50852d7367457`. Formal release HOLD. |

The integrated changes affect play as follows. Daily completion preserves a different Play save. Startup accepts the checked partial v1 save and the tested Continue path preserves it. [Local commit and worktree index](<D:/hsg-campaign/platform-support/release-controller/final-report-readiness-031009b8-9c99-4849-87ee-76e539afcebb/REPORT-READINESS.json>)

## Before and after

The candidate original subset passed 66/67 with one renderer-premise failure and 19 whole-case deferrals. Separate focused runs passed 32 pure and eight browser checks. Two baseline S0 defects were fixed in one local commit. [Evidence 1 · 12174](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-word-tiles-save-final-ae7ae375-25b8-466d-9e13-4daaa6fa68c5/handoff.json>)

## Evidence tiers

- Installed Chrome and Edge basic player observations are scoped E2 desktop evidence. Hardware qualification and broader workflow coverage remain separate. [Desktop scope and profile limits](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)
- The physical iPad Safari lane records 3 completed bounded gameplay runs across 4 attempts. The earlier whole-object oracle rejected expected migration metadata. The corrected observation validated metadata separately and preserved the exact raw bytes of the identified Continue path. The R8 local route returned 200 with body SHA-256 `4e37eeefcec0bc5da820f2204a786f78b95c2e0dc68f2238e8f2d7b9cc3b19ec`. The last gameplay body SHA-256 was `f14990180d985d661996ffb7a24d11cb48c2bc005b97e496e58e2d0dc7b68c2f` from source commit `1fbaf5b120d4774538a21b07f6a50852d7367457`. Physical iPad scope is recorded separately from the Android and WebKit proxy tiers. [Physical iPad route](<D:/hsg-campaign/evidence/refinement-2026-11/ipad-route-verification-r8-9157fa31-c2c2-46ee-a788-e9bb70e3a59e/route-report.json>) · [Physical iPad gameplay](<D:/hsg-campaign/evidence/refinement-2026-11/ipad-final-report-c14434a9-3a6e-49f6-83fa-a1bea341c260/FINAL-REPORT.json>)

## Coverage left open at closure

- Original subset 66/67, one renderer-premise failure and 19 whole-case deferrals. Separate 32 pure and 8 browser outcomes, natural candidate and later physical candidate. Full historical saves and all modes remain open.
- Full A1 and A2 Android Chrome workflow evidence, the complete device and mode matrix, all historical save/rollback paths, independent rounds and production smoke remain pending. [R41 campaign record](<D:/hsg-campaign/evidence/refinement-2026-11/desktop-director-progress-d9696d13-41ae-427a-bb9e-a366f45ed43c/report.json>)

## Not Covered

No approved exclusions. Pending work is listed above.

## Manual checklist candidates

- Real iPhone Safari, Android handset performance and heat, and audible-output review remain for the end-of-campaign manual checklist. [Manual-checklist requirement](<C:/Video Game Projects/campaigns/refinement-2026-11/MASTER-PROMPT.md>)
