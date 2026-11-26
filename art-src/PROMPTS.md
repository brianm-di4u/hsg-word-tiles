# Art provenance

All painted art is original, made with OpenAI image generation through the Codex plugin (`codex:codex-rescue`) on
2026-11-01. Raw PNGs in this folder are git-ignored; the packed WebP files in `assets/` ship (`art.json` →
`tools/build-art.mjs`, which runs `shared/test-harness/art-pack.mjs`). The 3D pieces are our own Blender models
(`blender/pieces.py`). The 18 `vig-*` landmark vignettes are reused from Bathhouse Barons (same collection, MIT); their
prompts are in `repos/hsg-property-game/art-src/PROMPTS.md`.

Every prompt carried the same constraints:
- original art for an open-source word game set in Hot Springs, Arkansas
- no text, letters, numbers, signage words, logos or watermarks
- no real or recognisable people; people small and generic (portraits: fictional characters)
- do not imitate any living artist

## Style pilots (approved first, then used as the reference for every later batch)
| File | Prompt summary |
|---|---|
| `title` | Bathhouse Row at dusk along the promenade: a tiled dome with a copper cupola, twin stepped towers, cream stucco and brick, red clay tile, magnolias, steam on the wooded hill, warm lamps, blue-violet sky to amber; Art Deco / WPA travel-poster painting; calm sky in the top third for the title set in code. (2026-11-24 W2-S2-03: tiny garbled stone carving on lower-left pier surgically inpainted to plain weathered limestone with Gemini image generation; rest of composition preserved verbatim.) |
| `glass-w` | a square stained-glass pane seen straight on, edge to edge: radial Art Deco sunburst, six wedges and leaded rings, sea-glass aqua to deep pool, mottled antique glass, dark lead came, a plain centre for the label |

## Board (styled after `glass-w`)
| File | Prompt summary |
|---|---|
| `glass-h` | cobalt and sapphire: an eight-pointed star with two thin rings |
| `glass-s` | amber and honey: wavy S-curved lead lines rising like steam |
| `glass-b` | copper, terracotta and red: three bold rings and scattered round bubble panes |
| `glass-c` | the Display Spring from above: a turquoise pool with ripples, grey-cream tufa terraces, emerald algae, steam |
| `marble`, `terrazzo`, `counter` | frameless, evenly lit: Carrara marble; cream terrazzo with terracotta, sage, cobalt and brass chips (2026-11-24 W3-S4-03: replaced 768x768 full-board bitmap with seamless 256x256 tileable terrazzo swatch tiled along the 4 outer border strips via `createPattern`; generated with OpenAI image fallback after Gemini 503 capacity error); dark walnut counter |

## Bathhouse Row medallions and portraits (styled after `title`)
| File | Prompt summary |
|---|---|
| `bath-*` (8) | one facade each, centred in a brass-rimmed roundel on cream limestone, bold and simple for small sizes: Superior (green rosettes), Hale (red hip roof, bell gable porch), Maurice (green tile cap, arched sun-parlour windows), Fordyce (lozenge brick, copper marquee), Quapaw (chevron-mosaic dome, copper cupola), Ozark (twin stepped towers), Buckstaff (seven bays, medallion frieze), Lamar (plain stucco, skylight) |
| `face-*` (4) | round cameo portraits of the fictional opponents: Opal Vance (1920s bath attendant), Hollis Crane (1930s park ranger, no insignia), "Lucky" Delmar (1930s racetrack tout), Maestro Julian Fitch (1920s hotel orchestra leader; if ever refreshed, warm ballroom/tuxedo cues while preserving silver hair, mustache, and baton) |

## Fact cards (styled after `title`; loop 1 of the visual review)
| File | Prompt summary |
|---|---|
| `card-springs` | a steaming hot spring spilling over tufa terraces on a wooded hillside |
| `card-baths` | an early-1900s bathhouse hall: marble, a sea-green and amber skylight, a small fountain, towels |
| `card-park` | an Ouachita forest trail, a rustic stone overlook, blue ridges, dogwood |
| `card-track` | thoroughbreds racing toward the viewer, plain silks without numbers or emblems, a 1930s grandstand |
| `card-club` | a family-friendly 1930s Hot Springs Art Deco supper-club bandstand at night in warm WPA gouache: gleaming grand piano, brass ribbon microphone, pleated amber stage curtains, fluted pilasters, stepped brass panels, parlor palms, and clean cream-draped booths with warm amber table lamps (zero cigarettes, smoke, alcohol, gambling, or text; replaced 2026-11-24 W2-S2-03 via Gemini image generation) |
| `card-town` | Central Avenue in the 1920s at dusk: a streetcar, brick storefronts without lettering, steam on the hill |
| `card-magnolia` | the Magnolia Promenade: blooming southern magnolias before cream bathhouse facades |
