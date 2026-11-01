# Visual Style Guide

The art-direction bible for the eleven Hot Springs browser games, all drawn procedurally in Canvas/SVG with no image files. It collects the sourced architecture and material facts for Bathhouse Row and downtown, an era-by-era look, ten named palettes, typography (system fonts first), a 54-icon catalog, a motif library with construction recipes, and per-game art-direction hooks.
**Every hex value in this file is an estimate (`est.`).** Each was matched to a material or a written description ("cream-colored brick", "red clay tile", "blue-green algae"); none was measured from a photo, and no source gives official hex values for any building, school or business. The shared tokens in `shared/design/tokens.css` and `tokens.js` carry the same palettes.

Era ids: `ancient (<1804) · frontier (1804–1874) · gilded-spa (1875–1920) · roaring (1921–1946) · midcentury (1947–1967) · revival (1968–1999) · modern (2000–2026)`

Tags: **[inferred]** = design inference, not a sourced fact; `est.` = estimated hex; **[DISPUTED]** / **[UNVERIFIED]** / **[UNCONFIRMED]** carried over from the notes; `conflict:` gives both sourced values; (snippet) = from a search summary, one level less verified.

---

## How to use this guide

- **Everything is drawn in code.** Facades are flat polygons, roofs are repeated arcs, glass is a Voronoi tessellation, steam is blurred sine paths. Recipes below give primitive counts and sizes. No downloaded images, fonts or logos.
- **Fonts: system stacks first.** Games may not be able to load web fonts, so every text style has a system fallback stack (Typography section). Web fonts from Google Fonts are optional extras; verify each license.
- **Tokens.** Colors, fonts, spacing and radius live in `C:\Video Game Projects\shared\design\tokens.css` (CSS custom properties `--pal-<slug>-<role>` and `--color-*`) and `tokens.js` (`PALETTES`, `THEME`, `FONTS`, `ERA_PALETTE`). Games are single files: copy the blocks you need inline; do not link the shared file. Default light theme is gilded-spa based, dark theme is deco-neon based; all default text/background pairs pass 4.5:1 (see `shared/design/README.md`).
- **Facts vs. inferences.** Building descriptions marked with a source link are sourced. Drawing recipes, hexes and era looks are **[inferred]** unless noted.
- **Content rules.** No logos or brand marks (no NPS arrowhead, no school logos, no Oaklawn, Magic Springs or Mountain Valley marks). School mascots are generic geometric shapes. The Quapaw Bathhouse "Indian-head" cartouche is drawn as an abstract architectural cartouche or a respectful motif, never a caricature. Gangster-era props (fedora, cigar) are generic silhouettes, never a real person's likeness.

---

## Architecture by building

### Row-wide facts

- Bathhouses are "made of masonry and steel." The 1912–1923 replacements were "fire-resistant brick and stucco bathhouses, several of which featured marble walls, billiard rooms, gymnasiums, and stained glass windows." — [NPS, Bathhouse Row](https://www.nps.gov/hosp/learn/historyculture/bathhouse-row.htm)
- NPS opening years and architects: Lamar 1923 (Roberts & Schwebke); Buckstaff 1912; Ozark 1922 (Mann & Stern); Quapaw 1922 (Mann & Stern); Fordyce 1915 (Mann & Stern); Maurice 1912 (George R. Gleim Jr.); Hale 1892; Superior 1916 (Harry C. Schwebke). — [NPS, Bathhouse Row](https://www.nps.gov/hosp/learn/historyculture/bathhouse-row.htm). The NPS per-building sheets and the CLI add: Hale by George and Fremont Orff; Buckstaff by Frank W. Gibb and Company; Lamar by Harry Schwebke (conflict with "Roberts & Schwebke" above) — [NPS sheets](https://npshistory.com/publications/hosp/bathhouses/hale.pdf); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf).
- Size of the whole: about 1,705 ft along Central Ave from Reserve St to Fountain St, of which the nine buildings fill about 1,150 ft from the Reserve St (south) end; the ~550 ft at the Fountain St (north) end is Arlington Lawn. The Quapaw lantern (~58–60 ft) is the highest point; most main masses are 30–49 ft. Details and sources in `bathhouse-row-layout.md`.
- The row is called the largest remaining collection of twentieth-century bathhouses in the US; the cultural landscape became a National Historic Landmark on May 28, 1987. Three periods of significance: 1885–1897, 1912–1923 and 1930–1959; an "informal Victorian landscape design" dates to the 1890s. — [NPS Bathhouse Row Cultural Landscape](https://www.nps.gov/articles/500341.htm); [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row)
- Overall look: cream or white brick and stucco, red clay tile roofs (one green-tile roof, one mosaic dome), trim in terra cotta, marble and stained glass.

### Skyline recipe and row order

**[inferred]** A per-building skyline rendered as flat SVG polygons, **south to north** (visual notes):

| # (S→N) | Building | Silhouette recipe | Front width ft [measured] | Main heights ft [measured] |
|---|---|---|---|---|
| 0 | Administration Building | Stucco block, red hip roof; narrow end toward Central (door faces Reserve Ave) | ~42–49 | eaves ~27.5; ridge ~37.6 |
| 1 | Lamar | Flat parapet, plain stucco block, low central pediment | ~91–96 | parapet ~31; pediment ~34 |
| 2 | Buckstaff | Cream block with a seven-bay column rhythm; taller central attic | ~103–106 | end pavilions ~34–35; attic ~45–46; penthouse ~48 |
| 3 | Ozark | Two stepped towers with red hip caps, ~47 ft apart centre to centre | ~107–110 | parapet ~26; towers ~38; finials ~41 |
| 4 | Quapaw | Widest house: half-ellipse dome with chevron stripes and a small cupola | ~181–186 | ridge ~35; dome ~50; **lantern ~58–60 (highest point)** |
| 5 | Fordyce | Cream first story, lozenge band on the upper two stories, two low hipped end pavilions with a flat centre and a set-back penthouse | ~102–107 | eaves ~40; hip peaks ~45; piers ~49; penthouse ~57 |
| 6 | Maurice | White stucco with green tile wing roofs and a glazed hipped centre | ~89–92 | wings ~36; centre ~48; penthouse ~56 |
| 7 | Hale | Big red hip roof; double-curved bell gable low on the front porch | ~116–127 | eaves ~23; ridge ~37–38; gable ~15 |
| 8 | Superior | Flat with brick pilasters; one-story sun porch in front | ~86–89 | cornice ~30–31; chimney ~40 |

Widths and heights are game-session measurements from the HABS AR-28 drawings (frontages ±5 ft, heights ±1–2 ft above each front's grade) — [HABS AR-28](https://npshistory.com/publications/hosp/habs-bathhouse-row.pdf); `bathhouse-row-layout.md` (from `games/trivia/research/bathhouse-row-layout.md` and `games/mahjong/research/bathhouse-row-facades.md`). Gaps between buildings, N→S: ~2–4, ~57–59 (Maurice Spring fountain garden), ~41–45 (Main Entrance), ~31–33, ~30–31, ~17–19, ~10–11, ~11–12 ft.

Order: **confirmed** north to south as Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar, then the Administration Building, by the HABS AR-28 site-plan labels, the NHL nomination ("The northernmost bathhouse on the row is the Superior"), the CLI and OpenStreetMap footprints — [HABS AR-28](https://npshistory.com/publications/hosp/habs-bathhouse-row.pdf); [NHL nomination](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf); [OSM](https://www.openstreetmap.org/way/1002548146). The earlier **[UNVERIFIED]** caveat ("confirm it against an NPS map") is lifted. The table above reads south to north, the order a left-to-right panorama drawn from the east would show; from the usual viewpoint on the west side of Central Ave looking east, north is on the left. Street numbers rise southward: Superior 329, Hale 341, Maurice 359 (or 355), Fordyce 369, Quapaw 413, Ozark 425 (or 491), Buckstaff 509, Lamar 515 (sources in `bathhouse-row-layout.md`). The Arlington stands at the north end, at the "Y" of Central Ave. and Fountain St. The bathhouses face west onto Central Avenue on the east side of the street, with Hot Springs Mountain and the Grand Promenade behind them. Seen from across Central Ave, the Mountain Tower (about 0.49 mi away at 062°) rises behind the north half of the Row, over the Maurice, Hale or Superior, and is probably hidden by the rooftops from the near sidewalk **[inferred]** (see `bathhouse-row-layout.md` §9).

### Superior Bathhouse (1916) — northernmost

- **Style:** eclectic commercial style of Classical Revival origin. **Architect:** Harry C. Schwebke of Hot Springs — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). conflict: the history notes give "Harvey C. Schwebke" — [EOA Bathhouse Row](https://encyclopediaofarkansas.net/entries/bathhouse-row-437/).
- **Materials:** concrete painted to imitate ornamental tile, **green tile medallions** and paterae above brick pilasters carrying patterned insets; marble stair treads and tile wainscoting — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row).
- **Roof:** flat roofs behind brick parapets.
- **Signature:** green neon script — [EOA Bathhouse Row](https://encyclopediaofarkansas.net/entries/bathhouse-row-437/). Today a brewery brewing with thermal water.
- **Drawing recipe [inferred]:** wide low rectangle; 6–8 vertical brick pilasters (`#B5654A` est.) with small inset diamonds; a frieze row of green paterae rosettes (Motif 9); flat parapet line; optional green neon script sign above the door (Motif 15 in `#4E7D5B`→glow).
- **Hexes (est.):** painted tile body `#E6D7B5`, green medallion `#4E7D5B`, pilaster brick `#B5654A`, marble `#F2EFE8`.

### Hale Bathhouse (1892–93; remodeled 1914 or 1919; Mission facade 1939–40)

- **Dates:** conflict: the article gives both "originally built in 1883" and 1892–93; NPS lists 1892; oldest surviving bathhouse — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row); [EOA Bathhouse Row](https://encyclopediaofarkansas.net/entries/bathhouse-row-437/). Original architects George and Fremont Orff ([NPS Hale sheet](https://npshistory.com/publications/hosp/bathhouses/hale.pdf); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)). Mann & Stern remodeled it in 1914 (NPS sheet, CLI) — conflict: 1919 ([NHL nomination](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text)); Thompson, Sanders & Ginocchio converted the facade to Mission style in 1939–40.
- **Roof:** "a great-hipped roof of red tile" on all four sides; brick stuccoed over in 1939.
- **Signature details:** a double-curved name parapet, a Spanish bell gable, wrought-iron grilles beside the entrance; French tile and/or marble floors; brick vaulting in the basement; a former tufa sweat cave, the "electric cave," closed 1911 — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row).
- **Correction (HABS):** the double-curved "HALE" bell gable sits **low, on the one-story front porch over the door (about 15 ft up)**, not on the main roofline. The porch carries a tile pent roof; the main hip roof (eaves ~23 ft, ridge ~37–38 ft) has a second hip at the south end and two ventilator cowls; there are 12 arched second-floor windows [measured, HABS AR-28-B] — [HABS AR-28-B](https://www.loc.gov/item/ar0033/); `games/mahjong/research/bathhouse-row-facades.md`. 1984 photo: white stucco, orange-red tile, rust-red trim **[observed 1984]**.
- **Drawing recipe [inferred]:** stucco block; big red hip roof as a trapezoid with barrel-tile strip (Motif 10), the widest roof on the Row after the Quapaw; a one-story porch across the front with a low tile pent roof, and the double-curve gable (two mirrored cubic Béziers with a small arched bell opening) **on the porch roof over the door, well below the main eaves**; black iron grilles (Motif 5) left and right of the door.
- **Hexes (est.):** stucco `#F3EFE6`, red tile `#A9432C` / shadow course `#7E2F1F`, iron `#1F2A24`.

### Maurice Bathhouse (1911–12; remodeled 1915 by Mann & Stern)

- **Style:** eclectic Renaissance Revival / Mediterranean. **Architect:** George Gleim Jr. of Chicago (NPS: George R. Gleim Jr.). The 1915 remodel added the front sun parlor and made the white look "warmer and more luxurious." — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row); [NPS](https://www.nps.gov/hosp/learn/historyculture/bathhouse-row.htm)
- **Materials:** stucco exterior "inset with decorative colored tiles"; visible roof sections covered with **green tile**.
- **Signature details:** stained glass skylights and "mythical sea-scene" windows; an orange neon "Maurice" sign in the lobby; fluted Ionic pilasters and arches in the lobby; the Roycroft (Dutch) Den with an inglenook fireplace and carved mascarons; a bronze-and-crystal fountain and mermaid art glass ([EOA Bathhouse Row](https://encyclopediaofarkansas.net/entries/bathhouse-row-437/)); the 1931 therapeutic pool. The landmarks notes call it a neon "Maurice" sign without giving its color. In 2026 a local group was raising money to re-create the original stained-glass ceiling — [ADG 2026-04-11 (via search summary)](https://www.arkansasonline.com/news/2026/apr/11/hot-springs-group-raising-money-to-re-create/).
- **Glass maker and imagery:** the 1915 remodel's "large stained glass skylights" came from the **Rossbach Art Glass Company**, Columbus, Ohio (later of Chicago) — [NPS Maurice sheet](http://npshistory.com/publications/hosp/bathhouses/maurice.pdf). EOA's "mermaid art glass" is not confirmed: the NHL says "mythical sea scenes", and the one Maurice window photographed in color (women's pack room) shows a white water lily on green pads with an amber border **[observed 1984]** — [HABS AR-28-C](https://www.loc.gov/item/ar0034/). Exterior in 1984: white stucco; the green roof tile reads very dark green, almost black; ochre and blue tile panels in the second-floor band **[observed 1984]**. Roof form: hipped tile roofs on the end wings and a hipped, metal-framed glazed skylight roof over the centre [measured, HABS AR-28-C].
- **Drawing recipe [inferred]:** white stucco block; green tile cap (barrel-tile strip recolored); 3–5 small colored tile inset squares in the frieze; arched sun-parlor windows across the front; lobby view with an orange neon script and a sea-glass skylight (Motif 4).
- **Hexes (est.):** stucco `#F3EFE6`, green tile `#4E7D5B`, neon orange `#F28C28`, sea glass ramp `#1F5F6B`→`#7FC8B8`.

### Fordyce Bathhouse (1914–15, Mann & Stern) — visitor center

- **Style:** Renaissance Revival with Spanish and Italian elements. Architects George Mann and Eugene John Stern of Little Rock. Cost $212,749.55 including fixtures. — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row)
- **Exterior:** cream-colored brick facing with terra cotta detailing; Batesville limestone foundation and porch; **lozenge-patterned brickwork on the upper two stories**; visible hipped roofs covered in decorative tile; a stained glass and copper marquee with a Greek-motif parapet; rusticated terra cotta; Spanish-style curvilinear parapets on the north and south ends.
- **Brick, per the 1915 *Arkansas Gazette*:** the lower story was cream-colored enamel brick and tile; the second and third floors were "brown and light yellow pressed brick, the darker working out a diamond bond in front" — [Fordyce HSR data section](http://npshistory.com/publications/hosp/hsr-hds-fordyce-bathhouse.pdf) p.104. So the lozenges are **dark brown diamonds set in light-yellow brick**, and only the first story is cream. The 1984 HABS photo reads golden buff with a darker lozenge diaper, cream terra cotta at the ground floor and window surrounds, and a dark verdigris/bronze marquee **[observed 1984]**. Conflict: the NHL and Wikipedia say "cream-colored brick".
- **Roof, per HABS:** not one red hip roof but **two low red-tile hipped end pavilions with a flat centre**, plus a set-back hipped skylight and penthouse (end-pavilion eaves ~40 ft, hip peaks ~45 ft, corner piers ~49 ft, penthouse ~57 ft); the curvilinear parapets are on the north and south end walls, one with a quatrefoil vent [measured, HABS AR-28-D] — [HABS AR-28-D](https://www.loc.gov/item/ar0035/); `games/mahjong/research/bathhouse-row-facades.md`. Seven bays; arched third-floor openings under a terra cotta frieze.
- **Interior:** stained glass skylight over the DeSoto fountain; the men's bath hall skylight shows "figures floating in a sea of blue and green above the de Soto statue" — [SAH Archipedia AR-01-GA6](https://sah-archipedia.org/buildings/AR-01-GA6). The 1915 newspapers and booklet place Neptune's daughter, mermaids, sea fish, frogs and human bathers in the **men's bath hall skylight** — [NPS Historic Furnishings Report](http://npshistory.com/publications/hosp/hfr-fordyce-batthouse.pdf). A 1917 *Ornamental Glass Bulletin* credits that skylight ("ceiling light over pond") to the **Condie-Bray Glass and Paint Co., St. Louis** (HFR). The NPS podcast credits "the Condi-Neal Glass Company from St. Louis" only with the Music/Assembly Room and the ladies' bath hall and pack room glass — [NPS Fordyce Stained Glass Podcast](https://www.nps.gov/hosp/learn/photosmultimedia/fordyce-stained-glass.htm); whether the two names are one firm is not established. Piece count conflict: "approximately eight thousand" (c.1915 booklet; [VOA](https://www.voanews.com/a/a-13-2008-04-28-voa19/345299.html)) vs "approximately 18,000" (*Hot Springs New Era*, Feb. 27, 1915) (HFR). The third-floor glass-vaulted room was the **assembly or palm room** in 1915 (five art-glass ceiling panels "representing Music, Art, Science, etc."; gray-tinted art-reed furniture); the 1915 "music room" was the ladies' parlor at its south end. Today NPS calls the restored room the **Music Room**, with a patterned tile floor, a stained glass ceiling, a Knabe grand piano, and violin, French horn and harp in the décor — [NPS Fordyce Bathhouse](https://home.nps.gov/hosp/planyourvisit/fordyce-bathhouse.htm). Caption it "assembly room (today's Music Room)". The earlier **[DISPUTED]** room-attribution flag is dropped.
- **Skylight as photographed (1984):** a rectangular frame of pale amber/honey opalescent panes with scallop-shell roundels in dark-leaded circles; a large oval of blue, teal and green "water" with weed lines and bubbles; one fish-tailed mermaid, human-legged swimmers, fish and a crab-like creature; a pale-yellow inner oval and a small rose/lavender whirlpool at the centre; blue-and-white scroll spandrels in the corners **[observed 1984]** — [HABS 570634c](https://www.loc.gov/resource/hhh.ar0035.color.570634c); `games/solitaire/research/interiors-1920s.md`.
- **DeSoto fountain:** installed between Dec. 13, 1915 and Mar. 1, 1916, after the opening (HFR); green and amber glazed-tile curb **[observed 1984]**.
- Other interior finishes: marble walls and partitions, terracotta fountains, private staterooms, the largest gymnasium in the state — [NPS Cultural Landscape](https://www.nps.gov/articles/500341.htm); an "Indian maiden" fountain and a life-size de Soto statue — [EOA Bathhouse Row](https://encyclopediaofarkansas.net/entries/bathhouse-row-437/); 1938 Hubbard tub, bowling lanes (removed), roof garden, spring No. 46 in the basement — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row).
- **Drawing recipe [inferred]:** wide rectangle in seven bays; a cream first story (enamel brick and rusticated terra cotta); the upper two stories filled with Motif 1 (dark brown diamonds in light-yellow brick); **two low red hipped pavilions at the north and south ends with a flat parapet between them**, and a small set-back hipped penthouse rising above the centre; Spanish curvilinear parapets on the end walls (two mirrored S-curves, seen at an angle); arched copper-and-glass marquee across the entry (verdigris edges); limestone base band.
- **Hexes (est.):** cream first-story brick `#E6D7B5`, light-yellow pressed brick `#E3CF94`, dark brown diamond brick `#6E4B2F` (replaces the earlier lozenge outline `#B89A6A`), terra cotta `#C46A3E`, Batesville limestone `#CFC6B2`, copper `#B87333` / verdigris `#5E9C8C`, glass cobalt `#2B4C9B`.

### Quapaw Bathhouse (1922, Mann & Stern)

- **Style:** Spanish Colonial Revival — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). Built on the sites of the Horseshoe and Magnesia bathhouses.
- **Dome:** a large central dome covered with "brilliantly colored tiles" in a **chevron-patterned mosaic**, topped by a small copper cupola; the row's tallest dome — [EOA Bathhouse Row](https://encyclopediaofarkansas.net/entries/bathhouse-row-437/). The dome is about 23 ft across on an octagonal drum with a quatrefoil vent; its lantern finial, about 58–60 ft above the sidewalk, is the highest point on the Row [measured, HABS AR-28-E] — [HABS AR-28-E](https://www.loc.gov/item/ar0036/).
- **Dome colors (1984 HABS color photos, [observed 1984]):** not the "brilliantly colored" blue-and-yellow of the old guess. The chevron field is **buff/tan and cream** zigzags with small gold-and-blue diamond accents; the base band is darker **ochre/gold** diamond tiles and gold rosettes edged in brown, with **turquoise** picture panels set into it (a cream winged beast; a diamond panel with a mask-like face); the lowest border is ochre with ring motifs; the lantern is dark bronze or brownish copper — [HABS 570749c](https://www.loc.gov/resource/hhh.ar0036.color.570749c); [HABS 570751c](https://www.loc.gov/resource/hhh.ar0036.color.570751c); `games/solitaire/research/interiors-1920s.md`; `games/mahjong/research/bathhouse-row-facades.md`. Cobalt, terra cotta and green are not the main colors. Blue-and-white striped awnings in 1984.
- **Roof:** red clay tile on the sloped roofs and two large finials.
- **Signature details:** a carved Indian-head cartouche over the entrance; **scalloped shells cap the parapets and frame sculpin fish**, originally gold and now white — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). NPS: "a tiled dome crowns a decorative scheme with an American Indian motif." — [NPS Bathhouse Row Today](https://home.nps.gov/hosp/learn/historyculture/bathhouse-row-today.htm)
- **Drawing recipe [inferred]:** long stucco block, the widest on the Row; central half-ellipse dome on an octagonal drum, filled with Motif 2 (buff/tan/cream chevrons with small blue diamonds over an ochre base band with turquoise panels); small dark-bronze cupola with finial; two finials at the roof ends; parapet edge of Motif 3 (scallop shells framing sculpin). Draw the entrance cartouche as an oval with scroll ends and no face.
- **Hexes (est.):** stucco `#F3EFE6`, red tile `#A9432C`, copper `#B87333`, sculpin gold `#D4AF37` (original look) or white (current). Dome tiles, re-keyed to the 1984 photo descriptions (still estimates, not measured): buff `#D8C29A`, tan `#B89A6A`, cream `#E6D7B5`, ochre band `#C8963E`, brown edging `#6E4B2F`, small blue diamonds `#2B4C9B`, turquoise panels `#3FA8A0`, bronze lantern `#6B4E2E`. This replaces the earlier cobalt/gold/terra cotta/green guess.

### Ozark Bathhouse (1922, Mann & Stern)

- **Style:** Spanish Colonial Revival "with a vague Art Deco appearance" — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). An NPS caption: "white with a Spanish hacienda architecture style." — [NPS, Bathhouse Row](https://www.nps.gov/hosp/learn/historyculture/bathhouse-row.htm)
- **Signature:** **twin towers with three-tiered setbacks** flank the entrance; hipped tower roofs in red clay tile topped with finials; red clay tile on the sloped porch; cartouches above the pavilion windows; marble lobby counter and mirrored walls.
- **Drawing recipe [inferred]:** low white block between two towers; each tower = 3 stacked rectangles, each 85% the width of the one below; red pyramid caps with a finial; small cartouche ovals over the side windows.
- **Hexes (est.):** white `#F3EFE6`, red tile `#A9432C`, shadow `#7E2F1F`.

### Buckstaff Bathhouse (1912) — still operating

- **Architect:** Frank W. Gibb and Company — [NPS Buckstaff sheet](https://npshistory.com/publications/hosp/bathhouses/buckstaff.pdf); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf).
- **Brick color conflict:** "cream-colored brick" (NHL; Wikipedia) vs "taupe brick" (NPS Buckstaff sheet) vs tan to light brown with white trim in the 1984 HABS photo **[observed 1984]**. Maroon striped awnings in 1984.
- **Style:** Neoclassical. A "cream-colored brick building"; base, spandrels, friezes, cornices and parapet in white stucco; paterae (round medallions) on the friezes; brass letters spell "Buckstaff Baths"; engaged columns divide the entrance into seven bays with pavilions at each end and classical urns; rooftop sun porches — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row).
- **Drawing recipe [inferred]:** cream rectangle; 6 vertical engaged columns (7 bays); white cornice band with a row of 8–12 small paterae rosettes (Motif 9 in white); brass lettering band; two small urns on the parapet ends.
- **Hexes (est.):** cream brick `#E6D7B5`, white stucco `#F3EFE6`, brass `#C9A23F`.

### Lamar Bathhouse (1923) — southernmost

- **Style:** transitional commercial with classical-revival traces; stuccoed reinforced concrete, two stories; flat roof with a wire-glass skylight; parapet edges capped with brick and clay tile; lobby murals of architectural and country scenes; skylit stair core. Architect **[DISPUTED]**: Roberts & Schwebke (NPS Bathhouse Row page) vs Harry Schwebke ([NPS Lamar sheet](https://npshistory.com/publications/hosp/bathhouses/lamar.pdf); [CLI](https://npshistory.com/publications/hosp/cli-bathhouse-row.pdf)) — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row); [NPS](https://www.nps.gov/hosp/learn/historyculture/bathhouse-row.htm). Front: five broad segmental-arched porch openings under a small "LAMAR" pediment [HABS AR-28-H].
- **Drawing recipe [inferred]:** plain two-story stucco box; thin brick-and-tile parapet cap strip; a mural panel inside the lobby view (flat landscape bands).
- **Hexes (est.):** stucco `#F3EFE6`, cap tile `#A9432C`.

### NPS Administration Building (1936)

- Spanish Colonial Revival by NPS Eastern Division architects; clay-tile hip roof, wrought-iron balconies and grilles, a broken arched pediment over a second-story window; a cast-concrete fountain in front (1936) — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). It faces the street because its predecessor kept being mistaken for a bathhouse — [NPS History](https://www.nps.gov/hosp/learn/historyculture/index.htm).
- **Orientation correction:** the street it faces is **Reserve Ave**. HABS calls it "the only structure not facing Central Avenue"; its main door and "south front" face Reserve, and from Central Ave you see its plain two-story west side (about 45–49 ft wide) — [HABS data pages](https://tile.loc.gov/storage-services/master/pnp/habshaer/ar/ar0000/ar0031/data/ar0031data.pdf); [HABS AR-28-I](https://www.loc.gov/item/ar0040/). Date conflict: 1936 (NHL; HABS AR-28-I) vs "Built in 1938" (HABS AR-28 data page).
- **Drawing recipe [inferred]:** stucco block with red hip roof; in a Central Ave panorama show the narrow plain west end, with the pediment door on the Reserve Ave side; one broken-pediment arch (two quarter-arcs with a gap) over a central window; small iron balcony (Motif 5); round fountain basin in front.

### Landscape: entrance, Magnolia Promenade, Grand Promenade

- Main entrance and balustrade designed in the 1890s by Army engineer Robert Stevens, with two bronze federal eagles and a central hemicycle drinking fountain; a bandstand on the balustrade was removed in 1958 — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). A 2010 view shows "symmetrical hedges and columns" at the Main Entrance — [NPS Cultural Landscape](https://www.nps.gov/articles/500341.htm).
- **Magnolia Promenade:** laid out by Stevens in the 1890s, double rows of magnolias then, a single row now. In 1916 Stephen Mather brought **Jens Jensen** in to add lights and flower gardens. A 1940s caption describes a "tree-lined walkway." — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row); [NPS Cultural Landscape](https://www.nps.gov/articles/500341.htm)
- **Grand Promenade:** a north–south brick path on the hillside behind the bathhouses, Reserve Avenue to Fountain Street; begun in the 1930s, gravel by WWII, completed early 1960s; paving brick replaced 1984; replaced a "meandering Victorian path" with a more formal line — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). conflict: NPS gives "built 1930s–1958" — [NPS Cultural Landscape](https://www.nps.gov/articles/500341.htm); the NPS Grand Promenade sheet gives final landscaping July 25, 1958, and the NHL "early 1960s". From Central Ave it is mostly hidden behind the buildings and shows through the gaps, best at the Main Entrance.
- **Street lamps (1984 photos, [observed 1984]):** dark green cast-iron posts, each with **five white globe lamps** (one on top, four on arms), along the Central Ave walk and at the Main Entrance; HABS AR-28-I-6 records a "typical light standard". Their date is unknown (Jensen added lights in 1916) — [HABS AR-28-I](https://www.loc.gov/item/ar0040/).
- **Magnolia spacing:** one row along the curb, about **25 ft apart** on the HABS plan [measured]; canopies overhang the walk and frame each facade in the 1984 photos. Bronze eagles on rock-faced pale limestone pylons mark the Main Entrance between the Maurice and Fordyce **[observed 1984]**.
- **Drawing recipe [inferred]:** a Bézier ribbon of running-bond brick (Motif 11) with lamp posts every ~80 px (on Central Ave, five-globe posts in dark green); magnolia trees as dark ovoid canopies with white blossom dots (Motif 12); two bronze eagles as stylized spread-wing polygons on the entry piers (generic eagle shape, not a federal seal).

### Arlington Hotel (three buildings)

| Version | Years | Sourced look | Drawing recipe [inferred] | Hexes (est.) |
|---|---|---|---|---|
| 1st Arlington | 1875, razed after almost 20 years | Financed by Samuel W. Fordyce and two partners; state's largest hotel — [Wikipedia: Arlington Hotel](https://en.wikipedia.org/wiki/Arlington_Hotel_(Hot_Springs_National_Park)); [Arlington history](https://www.arlingtonhotel.com/history/). Wooden frame is an inference | Long two- to three-story frame building, porch along the front, clapboard lines | weathered pine `#A58A64`, whitewash `#EFE8DA` |
| 2nd "New Arlington" | 1892–93, burned April 5, 1923 | Spanish Renaissance, 300 rooms, four stories of red brick with corner towers — [Wikipedia: Arlington Hotel](https://en.wikipedia.org/wiki/Arlington_Hotel_(Hot_Springs_National_Park)) | Four-story red-brick block, square corner towers with pyramidal caps, veranda | brick `#B5654A`, tile `#A9432C` |
| 3rd (current) | Begun Oct. 25, 1923; completed Nov. 28, 1924 in 11 months and 3 days ([Arlington history](https://www.arlingtonhotel.com/history/)); "opened by Dec. 31, 1924"; one mirror gives 1925 (conflict) | Mann & Stern (architect George Mann per [ADG 2024](https://www.arkansasonline.com/news/2024/may/26/hot-springs-rebound/)), Spanish Colonial Revival with **twin towers**; its "huge size... and placement at the terminus of the town's most important vista made the building a key Hot Springs landmark"; 484 rooms; 239 Central Ave at the Central/Fountain "Y" — [Wikipedia, Arlington Hotel](https://en.wikipedia.org/wiki/Arlington_Hotel_(Hot_Springs_National_Park)). The 2023–25 renovation stripped seven layers of stucco to the brick — [Arlington history](https://www.arlingtonhotel.com/history/) | Wide symmetrical block with two taller towers with domed or pyramidal caps; arched entry; placed at the head of the street "Y" so it closes the vista | buff brick `#E6D7B5` [inferred], red tile `#A9432C` |

### Medical Arts Building (1929–30)

- 236 Central Ave.; sixteen stories, designed by Almand & Stuck of Little Rock, among the top Art Deco skyscrapers in the South; **bas-relief limestone carvings** on the frieze and main entrance and **bronze grillework above the doors** — [Encyclopedia of Arkansas](https://encyclopediaofarkansas.net/entries/medical-arts-building-6047/). Begun Dec. 1, 1929 at $375,000 on the old Rector Bath House site — [ADG 2024](https://www.arkansasonline.com/news/2024/may/26/hot-springs-rebound/). Arkansas's tallest building from 1930 until 1960 (EoA); Wikipedia gives a 1929 build year — [Wikipedia](https://en.wikipedia.org/wiki/Medical_Arts_Building_(Hot_Springs,_Arkansas)).
- **Drawing recipe [inferred]:** tall slab that narrows in 2–3 setbacks; vertical piers as thin light stripes; a fan/sunburst relief over the door (Motif 6); bronze grille square above each door.
- **Hexes (est.):** limestone `#D8CFBD`, bronze `#7C5A2E`, gold highlight `#D4AF37`.

### Southern Club (1893; structural-glass front 1940s)

- 250 Central Ave.; built 1893 as the private club of Charles Dugan and Dan Stuart; William Stokley Jacobs bought it in 1927, expanded it and clad the front in **dark Pittsburgh glass**, which helped hide the gambling; now the Josephine Tussaud Wax Museum — [EoA: Southern Club](https://encyclopediaofarkansas.net/entries/southern-club-1208/); [HMdb marker](https://hmdb.org/m.asp?m=211121). **Date of the glass:** EoA ties it to Jacobs but gives no year. The 1985 Central Avenue Historic District nomination says the first-floor arches "were removed when the existing glass, metal and structural glass storefront and canopy were added" and that "the extensive remodeling to the first floor took place during the 1940's" — [CAHD NRHP nomination, form HS-21](https://npgallery.nps.gov/GetAsset/18195d15-bdf3-4b67-b1de-fe40609ce075). Date the glass front to the 1940s (after the 1927 purchase), not 1927. Above it, a Romanesque Revival dressed-stone arcaded second floor with egg-and-dart moulding (CAHD).
- **Drawing recipe [inferred]:** storefront faced with a grid of dark glossy panels (near-black with a diagonal specular streak per panel); neon outline sign optional.
- **Hexes (est.):** glass `#14121F` with highlight streak `#4F4A66` at 30% alpha.

### Majestic Hotel (1882/1888; burned 2014)

- Built 1882 as the Avenue Hotel, renamed the Majestic in 1888 — [EOA Central Avenue HD](https://encyclopediaofarkansas.net/entries/hot-springs-central-avenue-historic-district-7954/). conflict: the Baseball Trail marker list gives "1902, expanded 1926" — [Trail site](https://hotspringsbaseballtrail.com/see-the-trail/). The Feb. 27, 2014 fire destroyed the **yellow-brick section**; the rest was razed in late 2016 — [EoA: Majestic Hotel](https://encyclopediaofarkansas.net/entries/majestic-hotel-8351/).
- **Drawing recipe [inferred]:** multi-story yellow-brick block; for "lost landmark" cards, draw it in desaturated tones with a ghost outline.
- **Hexes (est.):** yellow brick `#D8B868` [inferred].

### Velda Rose Tower Motor Hotel (1960 or 1963)

- On **Park Avenue** (not Central), built by Garland Anthony and named after his daughter; sources date it to 1960 or 1963 (conflict) — [Rex Nelson, "Along Park Avenue"](https://www.rexnelsonsouthernfried.com/post/along-park-avenue); [KKYR](https://kkyr.com/arkansas-hotel-makes-list-of-national-register-of-historic-places/). A listing describes it as 10 stories with 191 rooms and a covered parking deck — [OfficeSpace listing](https://www.officespace.com/ar/hot-springs/1368578-217-park-ave). NRHP address 218 Park Ave, listed May 10, 2024 — [NRHP list](https://en.wikipedia.org/wiki/National_Register_of_Historic_Places_listings_in_Garland_County,_Arkansas). 1950–1965 brought a hotel and motel boom tied to casino gambling — [Rex Nelson](https://www.rexnelsonsouthernfried.com/post/along-park-avenue).
- **Drawing recipe [inferred]:** tall flat-roofed slab on a wide parking podium; regular balcony grid (10 rows); signage is unsourced, so use a generic neon "MOTOR HOTEL" or invented name.
- **Hexes (est.):** motor-hotel palette (turquoise `#3FBFB5`, coral `#F26B5B`, concrete `#D9D4CA`).

### McClard's Bar-B-Q building (1942)

- 505 Albert Pike; the family moved in 1942 to the current **whitewashed stucco** building — [EoA: McClard's](https://encyclopediaofarkansas.net/entries/mcclards-bar-b-q-4230/).
- **Drawing recipe [inferred]:** low whitewashed box with a flat roof and a simple painted sign band (invented text, no real signage).
- **Hexes (est.):** whitewash `#EFE8DA`.

### Hot Springs Mountain Tower and its predecessors

| Tower | Dates | Sourced look | Recipe [inferred] |
|---|---|---|---|
| Woolman tower | 1877 (NPS); destroyed by lightning in the 1890s (Sentinel-Record) | Wooden; about 75 ft (Wikipedia) or about 80 ft (Sentinel-Record) — [NPS](https://www.nps.gov/places/hot-springs-mountain-tower.htm); [Sentinel-Record 2019](https://www.pressreader.com/usa/the-sentinel-record/20190801/281775630770491) | Tapered timber frame with X-bracing and a small platform |
| Rix Tower | Opened 1906 per Sentinel-Record; down July 13, 1971 (NPS) or 1975 (Wikipedia) | Steel, about 165 ft, elevator, telescope; Wikipedia says it was the 1904 World's Fair wireless telegraph tower, relocated (NPS does not confirm); an earlier tower (c. 1924) was 165 ft and advertised a "120 mile view" — [Wikipedia: Hot Springs Mountain Tower](https://en.wikipedia.org/wiki/Hot_Springs_Mountain_Tower) | Narrow steel lattice with a boxy cab on top |
| Current tower | Contract March 1982; opened June 3, 1983 | 216 ft (65.8 m) lattice steel with observation deck — [Wikipedia: Hot Springs Mountain Tower](https://en.wikipedia.org/wiki/Hot_Springs_Mountain_Tower); [NPS](https://www.nps.gov/places/hot-springs-mountain-tower.htm) | Tall narrow trapezoid lattice (zigzag cross-bracing) with a wider observation box on top; steel gray `#8C877C` est. |

### Rustic trail shelters (1924)

- The first was built in May 1924 on the ridge between North and Hot Springs Mountains, and four more followed; "built using native stone and logs and were topped with a redwood shingle roof"; three survive — [HMdb marker](https://www.hmdb.org/m.asp?m=234366).
- **Recipe [inferred]:** stone pillars (rounded rects in an irregular voronoi stone fill), log beams with ringed log-end circles, steep shingle gable. Hexes (est.): stone `#8C877C`, log `#5B4632`, shingle `#8B4A33`.

### Anthony Chapel, Garvan Woodland Gardens (2006)

- By Maurice Jennings and David McKee; wood and glass, modeled on E. Fay Jones's Thorncrown Chapel; part of a $5.8M complex; a 57-ft ceiling on massive pine columns — [EoA: Garvan Woodland Gardens](https://encyclopediaofarkansas.net/entries/garvan-woodland-gardens-4197); [SAH Archipedia](https://sah-archipedia.org/buildings/AR-01-GA13).
- **Recipe [inferred]:** tall narrow gable outline; repeated vertical pine columns with criss-cross timber lattice; glass panes as pale cyan with forest green behind. Hexes (est.): pine `#C49A6C`, glass `#A7DDF2` at 40% alpha.

### Other buildings worth drawing

- **Woodmen of Union Building / National Baptist Hotel**, 501 Malvern Ave.: four-story Classical Revival (1923–24) — [Wikipedia: Woodmen of Union Building](https://en.wikipedia.org/wiki/Woodmen_of_Union_Building).
- **Hot Springs High School** 1914 building: Late Gothic Revival by Sanguinet & Staats — [Wikipedia](https://en.wikipedia.org/wiki/Hot_Springs_High_School_(Arkansas)).
- **Park Hotel** (1930, seven stories, Thompson, Sanders & Ginocchio) — [ADG 2024](https://www.arkansasonline.com/news/2024/may/26/hot-springs-rebound/); 223 windows replaced in its rehab.
- **Ohio Club**, 336 Central (1905): no sourced exterior description; "narrow brick storefront, neon sign" is an inference.
- Central Avenue commercial blocks: 2–4 story brick storefronts **[inferred]**; their Victorian/Italianate details and ironwork were not researched.

---

## Era looks

### ancient (<1804) — palette `ouachita-forest`

- **Sourced:** novaculite is "a dense, hard, recrystallized chert" from **white to grayish-black**, resists erosion and forms prominent ridges — [Arkansas Geological Survey](https://www.geology.arkansas.gov/minerals/industrial/novaculite-silica-stone.html); it also occurs in **pink, red, tan, dark gray and black**, is found only in the Ouachitas (AR/OK) and southwest Texas, and more than 120 prehistoric quarries are recorded in Arkansas — [Arkansas Archeological Survey PDF](https://archeology.uark.edu/wp-content/uploads/2021/07/Arkansas-Novaculite.pdf). Forest is oak/hickory on north slopes and pine on south slopes — [Wikipedia: HSNP](https://en.wikipedia.org/wiki/Hot_Springs_National_Park). Steam rising off the springs gave the "Valley of Vapors" nickname — [npshistory.com (via search summary)](https://www.npshistory.com/publications/hosp/index.htm).
- **Look [inferred]:** dark, cool forest greens; white and pink novaculite outcrops as pale angular ridges; steam rising from a creek in a narrow valley; quarry pits and flake scatter as white dots.
- **Props:** spear points, whetstones, campfires, steam pools. No buildings.

### frontier (1804–1874) — palette `frontier-valley`

- **Sourced:** the Dunbar–Hunter party (1804) found an empty cabin and several visitor shacks; Percival built cabins to rent; Belding built a small hotel by 1828; log cabins and a store in the 1830s; by 1873 six bathhouses and 24 hotels/boardinghouses — see `history-timeline.md`. The town's physical appearance in the 1830s–1870s is **not sourced**.
- **Look [inferred, general knowledge]:** unpainted pine boards and log browns, whitewash, mud-brown streets; buildings in one or two rows hugging the creek in a narrow valley with steep wooded slopes on both sides.
- **Props:** log cabins, plank bath huts over steaming pools, wagons, stagecoach, broadside posters (woodcut style).

### gilded-spa (1875–1920) — palette `gilded-spa`

- **Sourced:** cream brick, white stucco, red clay tile, terra cotta, marble, brass and stained glass of the 1912–1923 Row; the 1890s Magnolia Promenade and Jens Jensen's 1916 lights and flower gardens — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row). Brick replaced wood after the 1905 and 1913 fires; wood-shingle roofs were outlawed after 1913 — [EOA Fire of 1913](https://encyclopediaofarkansas.net/entries/Hot-Springs-Fire-of-1913-14306).
- **Look [inferred]:** cream, white and red-tile building masses, a magnolia-green band in the foreground, black iron grilles, brass lettering; daylight with warm haze and steam.
- **Props:** parasols, bowler hats, horse-drawn and electric streetcars, narrow-gauge train, the second Arlington's corner towers. (Streetcar and parasol looks are not documented in the visual notes.)

### roaring (1921–1946) — palettes `deco-neon` + `linen-postcard`

- **Sourced:** Medical Arts limestone and bronze (1929–30); the Southern Club's dark Pittsburgh glass (structural-glass storefront from the 1940s per the 1985 CAHD nomination; Jacobs bought the club in 1927); the current twin-towered Arlington (1924); linen postcards popular 1930s–1950s — [Collectors Weekly](https://collectorsweekly.com/postcards/linen).
- **Look [inferred]:** deep navy-black night skies, limestone verticals, bronze, neon tubes as stroked paths with a blur glow (Canvas `shadowBlur`); daytime scenes in linen-postcard saturation. 1920s–40s club interiors and neon colors are **not sourced**.
- **Props:** card-table felt, roulette wheel, dice, fedora silhouette, radio microphone (KTHS), racing programs.

### midcentury (1947–1967) — palettes `motor-hotel` + `linen-postcard`

- **Sourced:** 1950–1965 hotel and motel boom; Velda Rose 10-story slab with covered parking; Park Avenue motor courts (NRHP 2004) — see Architecture.
- **Look [inferred, general mid-century knowledge]:** a tall motor-hotel tower slab, covered parking, flat roofs, saturated postcard skies, turquoise and coral paint, atomic starbursts, neon arrows.
- **Props:** neon "Vacancy," tail-finned cars, linen postcards of Bath House Row (a 1949 postcard subject).

### revival (1968–1999) — palette `nps-rustic`

- **Sourced:** bathhouses closed one by one 1962–1985, leaving only the Buckstaff; the Fordyce reopened as visitor center in 1989; NPS rustic shelters (1924) and trails — see `bathhouse-row-and-springs.md`.
- **Look [inferred]:** the "empty Row" — the gilded-spa palette desaturated about 50% with a grime overlay ("vacant" variant), boarded windows; trail and park scenes in native stone, logs and routed-wood brown.
- **Props:** plywood boards, "For Lease" signs (invented), restoration scaffolds, trail signs (generic, no NPS arrowhead).

### modern (2000–2026) — palette `lake-life`

- **Sourced:** restored and re-leased bathhouses (Quapaw spa 2008, Superior brewery, Ozark cultural center 2014, Hotel Hale 2019); Arlington stucco stripped to brick (2023–25).
- **Look [inferred]:** restored brick plus lake blues, sunset gold, redbud and dogwood accents, dock wood. Lake water colors, sunsets and foliage timing are **not sourced**.
- **Props:** pontoon boats, bass boats, string lights, brewery tanks, mountain bikes.

### Cross-era palettes

- `thermal-water` — springs, steam, tufa and algae appear in every era.
- `school-colors` — sports games (stand-in hexes).

---

## Named palettes (hex est.)

All hexes below are **inferred approximations** keyed to the sourced materials (cream brick, white stucco, red clay tile, Maurice/Superior green tile, terra cotta, Batesville limestone, copper, marble, brass and blue-green stained glass — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row); [SAH Archipedia](https://sah-archipedia.org/buildings/AR-01-GA6); thermal gray tufa, emerald or blue-green algae, moss — [NPS tufa](https://www.nps.gov/hosp/learn/photosmultimedia/tufa.htm); [NPS water](https://www.nps.gov/hosp/planyourvisit/thermal-springs.htm); [Haywood & Weed](https://www.nps.gov/parkhistory/online_books/hosp/haywood-weed/sec9.htm); novaculite white to black with pink, red and tan — [AR Archeological Survey](https://archeology.uark.edu/wp-content/uploads/2021/07/Arkansas-Novaculite.pdf); Medical Arts limestone and bronze — [EoA](https://encyclopediaofarkansas.net/entries/medical-arts-building-6047/); linen postcards' saturated, exaggerated colors — [Collectors Weekly](https://collectorsweekly.com/postcards/linen)). None was measured from photos.

### P1. Ouachita Forest — slug `ouachita-forest` (ancient) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Background | Shortleaf pine shadow | #1F3324 |
| Primary | Pine needle green | #2F4A2C |
| Secondary | Oak canopy | #5C7A3A |
| Accent | Novaculite white | #EDEAE2 |
| Accent 2 | Novaculite rose | #C99A92 |
| Text/dark | Shale charcoal | #2B2A27 |
| Highlight | Creek steam | #F4F6F5 (use at 40% alpha) |
| Earth | Sandstone tan | #A08A6A |

### P2. Thermal Water — slug `thermal-water` (cross-era) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Background | Pool depth | #1F5F6B |
| Primary | Blue-green algae | #2A9D8F |
| Secondary | Emerald tufa algae | #2F8F5B |
| Neutral | Tufa gray | #9A968C |
| Neutral light | Tufa rim | #C8C3B6 |
| Accent | Moss | #6B8E3A |
| Highlight | Steam | #FFFFFF @ 25–35% alpha |
| Text | Wet stone | #3A3A36 |

### P3. Frontier Valley — slug `frontier-valley` (frontier) (hex est.; unsourced era look, general knowledge)
| Role | Name | Hex |
|---|---|---|
| Background | Valley haze | #C9D3D6 |
| Primary | Weathered pine board | #A58A64 |
| Secondary | Log brown | #5A4330 |
| Neutral | Whitewash | #EFE8DA |
| Ground | Mud street | #7B6248 |
| Accent | Hearth red / barn paint | #8E3B2B |
| Text | Lampblack ink | #2A2420 |
| Foliage | Hillside pine | #3B5236 |

### P4. Gilded Spa / Bathhouse Row — slug `gilded-spa` (gilded-spa) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Background | Cream brick | #E6D7B5 |
| Primary | Red clay tile | #A9432C |
| Secondary | Terra cotta | #C46A3E |
| Accent | Maurice green tile | #4E7D5B |
| Accent 2 | Stained-glass cobalt | #2B4C9B |
| Highlight | Amber glass / brass | #D9A23A |
| Neutral | Marble | #F2EFE8 |
| Text | Wrought-iron black-green | #1F2A24 |

### P5. Art Deco and Neon Night — slug `deco-neon` (roaring) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Background | Midnight | #14121F |
| Primary | Limestone | #D8CFBD |
| Secondary | Bronze grille | #7C5A2E |
| Accent | Neon red | #FF3B3B |
| Accent 2 | Neon blue | #4FC3FF |
| Highlight | Deco gold | #D4AF37 |
| Felt | Card-table green | #1E5B3A |
| Text | Smoke gray | #8A8590 |

### P6. Linen Postcard — slug `linen-postcard` (roaring, midcentury) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Sky top | Airbrush cerulean | #2F7FC6 |
| Sky bottom | Horizon cyan | #A7DDF2 |
| Primary | Saturated foliage | #3C9A4A |
| Secondary | Postcard brick | #C8452B |
| Accent | Title yellow | #F6C933 |
| Accent 2 | Sunset orange | #F28C28 |
| Border | Card cream | #F3E9D2 |
| Text/outline | Ink navy | #1F2F5C |

### P7. Mid-century Motor Hotel — slug `motor-hotel` (midcentury) (hex est.; general mid-century knowledge, not sourced to Hot Springs signs)
| Role | Name | Hex |
|---|---|---|
| Background | Pool-sky | #8FD0E8 |
| Primary | Turquoise | #3FBFB5 |
| Secondary | Coral | #F26B5B |
| Accent | Atomic yellow | #F4C542 |
| Neutral | Poured concrete | #D9D4CA |
| Highlight | Neon tube white | #FFF6E0 |
| Text | Asphalt | #222222 |
| Accent 2 | Rose (namesake nod) | #E26D8E |

### P8. Restored Downtown and Lake Life — slug `lake-life` (modern) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Background | Lake deep | #1E4E79 |
| Secondary | Lake shallows | #4C8FA8 |
| Primary | Restored brick | #B5654A |
| Neutral | Dock wood | #9C7A55 |
| Accent | Sunset gold | #F2A541 |
| Accent 2 | Redbud pink | #B5568F |
| Highlight | Dogwood white | #F6F3EC |
| Fall | Maple/sweetgum orange | #C8501F |

### P9. NPS Rustic Trail — slug `nps-rustic` (revival; trails any era) (hex est.)
| Role | Name | Hex |
|---|---|---|
| Background | Forest floor | #3E3528 |
| Primary | Native stone | #8C877C |
| Secondary | Log | #5B4632 |
| Accent | Redwood shingle | #8B4A33 |
| Sign | Routed-wood brown | #5E4B3C |
| Sign letters | Cream | #EDE3C8 |
| Foliage | Oak green | #4F6B35 |

### P10. Garland County School Colors — slug `school-colors` (STAND-INS; names sourced, hexes inferred)
| School | Colors | Hex (style-guide stand-in) | Hex (schools-notes prototype stand-in) |
|---|---|---|---|
| Hot Springs HS Trojans | black / gold | #111111 / #D4A017 | #000000 / #C9A227 |
| Lakeside Rams | blue / gold | #1F4E9C / #E6B422 | #1F4E9C / #FFC72C |
| Lake Hamilton Wolves | maroon / gold | #6D1A2B / #D9A520 | #7A1E2C / #FFC72C |

Color names: [Wikipedia HSHS](https://en.wikipedia.org/wiki/Hot_Springs_High_School_(Arkansas)); [Wikipedia Lakeside](https://en.wikipedia.org/wiki/Lakeside_High_School_(Hot_Springs,_Arkansas)); [Wikipedia Lake Hamilton](https://en.wikipedia.org/wiki/Lake_Hamilton_High_School). Hot Springs' black and gold trace to Honus Wagner's 1912 uniform donation — [Wikipedia: Ban Johnson Park](https://en.wikipedia.org/wiki/Ban_Johnson_Park). Both stand-in sets are **NOT official**; the schools notes say to replace them once a district style guide is found. Colors for Fountain Lake (Cobras), Cutter-Morning Star (Eagles), Jessieville (Lions) and Mountain Pine (Red Devils) were not found — invent neutral team colors and label them fictional, or use only the three sourced schools.

### Token role mapping (as shipped in tokens.css / tokens.js)

"derived" = not in the notes; added to fill a role or to pass 4.5:1 text contrast. All hex est.

| Slug | bg | surface | primary | secondary | accent | text | muted | highlight |
|---|---|---|---|---|---|---|---|---|
| ouachita-forest | #1F3324 | #2F4A2C | #5C7A3A | #A08A6A | #C99A92 | #EDEAE2 | #BFC7B0 derived | #F4F6F5 |
| thermal-water | #1F5F6B | #174A54 derived | #2A9D8F | #2F8F5B | #6B8E3A | #F4F2EC derived | #D6D2C6 derived | #FFFFFF |
| frontier-valley | #C9D3D6 | #EFE8DA | #A58A64 | #7B6248 | #8E3B2B | #2A2420 | #5A4330 | #3B5236 |
| gilded-spa | #E6D7B5 | #F2EFE8 | #A9432C | #C46A3E | #4E7D5B | #1F2A24 | #5A4C38 derived | #D9A23A |
| deco-neon | #14121F | #1F1C2E derived | #D4AF37 | #7C5A2E | #FF3B3B | #D8CFBD | #8A8590 | #4FC3FF |
| linen-postcard | #F3E9D2 | #FBF6EA derived | #2F7FC6 | #C8452B | #F6C933 | #1F2F5C | #4A5675 derived | #F28C28 |
| motor-hotel | #8FD0E8 | #D9D4CA | #3FBFB5 | #F26B5B | #F4C542 | #222222 | #34424A derived | #FFF6E0 |
| lake-life | #1E4E79 | #183F63 derived | #B5654A | #4C8FA8 | #F2A541 | #F6F3EC | #C3D3DF derived | #B5568F |
| nps-rustic | #3E3528 | #5E4B3C | #8C877C | #5B4632 | #8B4A33 | #EDE3C8 | #D2C8AE derived | #4F6B35 |
| school-colors | #111111 | #1E1E1E derived | #D4A017 | #1F4E9C | #6D1A2B | #F5F1E6 derived | #B8B2A6 derived | #E6B422 |

Mapping notes: in deco-neon the notes' "smoke gray" text is used as `muted` and limestone as `text`; in thermal-water the notes' "wet stone" `#3A3A36` text fails on the pool background (1.58:1), so it is kept as an extra (`--pal-thermal-water-wet-stone`) for dark text on light tufa. Default theme: light = gilded-spa (bg marble `#F2EFE8`, surface cream brick `#E6D7B5`, text `#1F2A24`, primary darkened to `#8E3622`, accent darkened to `#355E41`); dark = deco-neon (bg `#14121F`, text `#D8CFBD`, primary `#D4AF37`, accent `#FF5A5A`). All 68 checked pairs pass 4.5:1; the printed table is in `shared/design/README.md`.

---

## Material color swatches (est.)

All approximate material colors are inferred, not measured.

| Material | Where | Hex (est.) |
|---|---|---|
| Cream brick | Buckstaff, Fordyce | #E6D7B5 |
| Mortar | Brick fills | #CDBF9F |
| Light-yellow pressed brick | Fordyce upper stories (field) | #E3CF94 |
| Dark brown diamond brick | Fordyce upper-story lozenges (1915: "brown and light yellow pressed brick") | #6E4B2F |
| Quapaw dome chevrons | buff / tan / cream (1984 photo) | #D8C29A / #B89A6A / #E6D7B5 |
| Quapaw dome band | ochre, with turquoise panels and small blue diamonds | #C8963E / #3FA8A0 / #2B4C9B |
| White stucco | Ozark, Maurice, Hale, Lamar | #F3EFE6 |
| Red clay tile | Hale, Ozark, Quapaw, Admin Building | #A9432C |
| Red tile shadow course | Roof strips | #7E2F1F |
| Maurice green tile | Maurice roof, Superior medallions | #4E7D5B |
| Terra cotta | Fordyce detailing | #C46A3E |
| Batesville limestone | Fordyce foundation and porch | #CFC6B2 |
| Copper (new) | Quapaw cupola, Fordyce marquee | #B87333 |
| Verdigris | Aged copper | #5E9C8C |
| Marble | Lobbies, stalls | #F2EFE8 with gray veins #B9B4AA |
| Brass lettering | "Buckstaff Baths" | #C9A23F |
| Medical Arts limestone | Deco skyscraper | #D8CFBD |
| Bronze grille | Medical Arts doors | #7C5A2E |
| Restored brick | Modern downtown, promenade brick | #B5654A |
| Wrought iron | Hale, Admin Building grilles | #1F2A24 |
| Dark Pittsburgh glass | Southern Club front (1940s structural glass) | #14121F |
| Whitewash | McClard's, frontier cabins | #EFE8DA |
| Lead came | Stained glass lines | #2A2A2A |

---

## Thermal water, steam, tufa and algae rendering

**Sourced facts**
- When the springs were enclosed in 1901, water was diverted to form a thermal cascade. A blue-green alga, *Phormidium treleasei*, grows where spring water meets light and air. — [Encyclopedia of Arkansas photo entry](https://encyclopediaofarkansas.net/photo-of-day/this-day-1638/)
- The Display Spring behind the Maurice comes out of a hillside into a shallow pool, "shaded by trees, surrounded by mosses and blue-green algae"; the water emerges at about 143°F. — [NPS Experience the Water](https://www.nps.gov/hosp/planyourvisit/thermal-springs.htm)
- Tufa forms when thermal water evaporates at the surface and leaves carbonate deposits; locally "the color tends to be a more drab gray." — [NPS What is tufa?](https://www.nps.gov/hosp/learn/photosmultimedia/tufa.htm)
- An older account describes "the brilliant emerald-green tufa, whose color is due to the growth of hot-water algae." — [Haywood & Weed, NPS online book](https://www.nps.gov/parkhistory/online_books/hosp/haywood-weed/sec9.htm)
- The minerals precipitate as white-to-tan travertine ("tufa") near the openings — [Wikipedia: HSNP](https://en.wikipedia.org/wiki/Hot_Springs_National_Park). In 1982 NPS created the Thermal Water Cascade — [EOA HSNP](https://encyclopediaofarkansas.net/entries/hot-springs-national-park-2547/); the icon catalog places a cascade "below Arlington lawn" (location not separately sourced).

**Recipes [inferred]**
- **Steam:** stacked translucent white curls (`#FFFFFF` at 15–35% alpha) drifting upward with a sinusoidal x-offset; more visible on cold mornings.
- **Tufa:** rounded terrace lobes in gray `#9A968C` with lighter rims `#C8C3B6` and damp dark streaks `#6E6A60`.
- **Algae:** emerald `#2F8F5B` to blue-green `#2A9D8F` filaments along the waterline.
- **Pool:** radial gradient from `#1F5F6B` center to `#2A9D8F` edge; 1 px light ripple arcs at 20% alpha.
- **NPS rustic:** rough rectangular stones as an irregular voronoi-like pattern in gray-brown, dark log ends as circles with rings, a reddish shingle roof `#8B4A33`.

---

## Typography

Licensing background: Google Fonts' library is overwhelmingly SIL Open Font License (OFL), with a few Apache 2.0 fonts; both allow embedding and subsetting in games. Under the OFL, fonts may be embedded and bundled with software but cannot be sold on their own, and modified versions should not keep a Reserved Font Name — [SIL Open Font License](https://openfontlicense.org/); [fonts.google.com](https://fonts.google.com/). The Google Fonts FAQ could not be fetched; per-family licenses below are from prior knowledge — **verify each license** on its specimen page.

### System stacks first (use these by default)

| Token | Stack | Era / use |
|---|---|---|
| `--font-serif-victorian` | `"Palatino Linotype", "Book Antiqua", Palatino, Georgia, "Times New Roman", serif` | gilded-spa titles; inscriptions like "BUCKSTAFF BATHS" |
| `--font-deco` | `"Century Gothic", Futura, "Avenir Next", "Trebuchet MS", "Gill Sans", sans-serif` | roaring Deco and nightlife |
| `--font-sans` | `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` | UI, modern, NPS-like plain text |
| `--font-mono` | `"Courier New", Courier, ui-monospace, Menlo, Consolas, monospace` | gangster-era typewriter, tickets, scoreboards |
| `--font-frontier` (extra) | `Georgia, "Times New Roman", serif` | frontier broadsides |
| `--font-neon` (extra) | `"Arial Black", Impact, "Helvetica Neue", sans-serif` | neon signage, block numerals |
| `--font-script` (extra) | `"Brush Script MT", "Segoe Script", cursive` | midcentury motel and postcard script |

Canvas tip **[inferred]:** neon and block-letter looks are better drawn as stroked paths than as fonts (Motif 15); jersey numerals can be built from rectangles so no font is needed.

### Optional web fonts by era (verify license)

| Era | Display face | Text face | System fallback stack (from notes) |
|---|---|---|---|
| Frontier 1830s–70s (wood type, broadsides) | Rye (OFL), Smokum (OFL), Ewert (OFL) | Old Standard TT (OFL), IM Fell English (OFL) | `Georgia, "Times New Roman", serif` |
| Gilded spa 1880s–1920s | Playfair Display (OFL), Cinzel (OFL) | Cormorant Garamond (OFL), Libre Baskerville (OFL) | `"Palatino Linotype", "Book Antiqua", Georgia, serif` |
| Art Deco / 1920s–40s nightlife | Limelight (OFL), Poiret One (OFL), Federo (OFL), Josefin Sans (OFL) | Josefin Sans, Raleway (OFL) | `"Century Gothic", "Futura", "Trebuchet MS", sans-serif` |
| Neon signage | Monoton (OFL; multi-line, tube-like), Beon (verify) | none | `"Arial Black", Impact, sans-serif` |
| Mid-century motel / linen postcard | Pacifico (OFL), Lobster (OFL), Yellowtail (verify, likely Apache) | Righteous (OFL), Bungee (OFL) for block "Greetings" letters | `"Brush Script MT", cursive` / `Impact` |
| Gangster-era typewriter / tickets | Special Elite (Apache 2.0), Courier Prime (OFL) | none | `"Courier New", monospace` |
| NPS / modern | Rokkitt or Arvo (OFL slab, close to routed-wood signs); Source Sans 3 (OFL) | Source Sans 3 | `system-ui, "Segoe UI", sans-serif` |

Subsetting tip: subset to Basic Latin plus digits (e.g. `pyftsubset` or glyphhanger) so embedded files stay small.

---

## Icon catalog

Each silhouette is buildable from fewer than ten primitives. "Source" points to the factual basis for the subject; "Unsourced" means a known local subject not verified in the visual pass (several are covered in other corpus files, e.g. Oaklawn, Magic Springs, the alligator farm, bass). Colors are est.

| # | Icon | Represents | Silhouette (construction) | Colors | Source |
|---|---|---|---|---|---|
| 1 | Steam spring | The thermal springs | Shallow ellipse pool with 3 S-curve wisps rising, heights varied | P2 pool, steam | [NPS water](https://www.nps.gov/hosp/planyourvisit/thermal-springs.htm) |
| 2 | Tufa cascade | Cascade below Arlington lawn | 3 stacked rounded lobes (half-ellipses) stepping down, wavy blue lines over them | tufa gray, #2A9D8F | [EoA photo](https://encyclopediaofarkansas.net/photo-of-day/this-day-1638/) |
| 3 | Algae strand | *Phormidium* blue-green alga | 3 wavy parallel strokes, thicker at the base | #2F8F5B, #2A9D8F | [EoA photo](https://encyclopediaofarkansas.net/photo-of-day/this-day-1638/) |
| 4 | Thermometer 143° | Spring temperature | Rounded capsule with a bulb circle; red fill to about 80% | #C8452B | [NPS water](https://www.nps.gov/hosp/planyourvisit/thermal-springs.htm) |
| 5 | Quapaw dome | Quapaw Baths | Half-ellipse dome with chevron V-stripes, a small square cupola and finial, on a rectangle | buff/tan/ochre chevrons, blue diamonds, turquoise panels, bronze lantern | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 6 | Fordyce facade | Fordyce / visitor center | Wide rectangle; upper band of dark diamonds on light-yellow brick; two low red hipped end pavilions with a flat centre; arched marquee | cream, light yellow, dark brown, red tile, verdigris | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 7 | Ozark twin towers | Ozark Bathhouse | Low block flanked by two towers that each step in 3 tiers, red pyramid caps and finials | white, red tile | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 8 | Buckstaff colonnade | Buckstaff Baths (still operating) | Rectangle with 6 vertical lines (7 bays), flat cornice, a row of small circles (paterae) | cream, white | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 9 | Hale bell gable | Hale Bathhouse | Big red hip roof over a one-story porch; the double-curve gable with a small arched bell opening sits low on the porch, over the door | red tile, stucco | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 10 | Maurice green roof | Maurice Bathhouse | White block with a green-tile cap and a colored tile inset square | #4E7D5B | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 11 | Sculpin fish | Quapaw parapet ornament | Fish with a large head, a fan pectoral fin and a tapering tail, framed in a scallop shell | gold #D4AF37 or white | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 12 | Scallop shell | Quapaw parapet caps | Fan of 7 ribs radiating from a hinge, scalloped outer edge | cream, terra cotta | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 13 | Mermaid / Neptune's Daughter | Fordyce men's bath hall skylight | Profile figure with a flowing-hair curve, a tail fin and leaded-glass segmentation lines | blue/green/teal glass, amber frame | [NPS podcast](https://www.nps.gov/hosp/learn/photosmultimedia/fordyce-stained-glass.htm) |
| 14 | DeSoto helmet | DeSoto fountain statue (Fordyce) | Morion helmet: crescent brim with a crest ridge | steel gray | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 15 | Arlington towers | Arlington Hotel | Wide symmetrical block with two taller towers with domed or pyramidal caps; arched entry | cream, red tile | [Wikipedia](https://en.wikipedia.org/wiki/Arlington_Hotel_(Hot_Springs_National_Park)) |
| 16 | Medical Arts skyscraper | Medical Arts Building | Tall setback slab narrowing in 2–3 steps, vertical piers, fan relief over the door | limestone, bronze | [EoA](https://encyclopediaofarkansas.net/entries/medical-arts-building-6047/) |
| 17 | Bronze grille | Deco grillework | Square of chevrons and verticals, like a stylized fountain | #7C5A2E | [EoA](https://encyclopediaofarkansas.net/entries/medical-arts-building-6047/) |
| 18 | Magnolia blossom | Magnolia Promenade | 6 broad ovate petals around a cone, with 2 glossy dark leaves | white, #2F4F2F | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 19 | Brick path | Grand Promenade | Running-bond rectangles on a curving strip | #B5654A | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |
| 20 | Mountain tower | Hot Springs Mountain Tower | Tall narrow trapezoid lattice with a wider observation deck box on top | steel gray, sky | [MiraCosta](https://gotbooks.miracosta.edu/gonp/hosp/html/hosp0206.html) |
| 21 | Trail shelter | 1924 rustic shelters | Stone-pillar base (rounded rects), log beams, a steep shingle gable | P9 | [HMdb](https://www.hmdb.org/m.asp?m=234366) |
| 22 | Pine tree | Ouachita shortleaf pine | Tall narrow stacked triangles (3) on a thin trunk | #2F4A2C | [AR Geological Survey](https://www.geology.arkansas.gov/minerals/industrial/novaculite-silica-stone.html) (region; pine unsourced in visual pass) |
| 23 | Oak leaf | Ouachita hardwoods | Lobed leaf from 5 circles unioned along a midrib | #5C7A3A / fall #C8501F | Unsourced |
| 24 | Novaculite whetstone | "Arkansas"/"Washita" stones | Long rounded rectangle, bevelled top highlight, faint sheen stripe | #EDEAE2, rose | [AR Geological Survey](https://www.geology.arkansas.gov/minerals/industrial/novaculite-silica-stone.html) |
| 25 | Novaculite ridge | Ridge-forming rock | Jagged white zigzag ridge line over green slopes | white, pine | [AR Geological Survey](https://www.geology.arkansas.gov/minerals/industrial/novaculite-silica-stone.html) |
| 26 | Spear/arrow point | Prehistoric novaculite quarrying | Leaf-shaped point with notched base and flake facets | novaculite whites | [AR Archeological Survey](https://archeology.uark.edu/wp-content/uploads/2021/07/Arkansas-Novaculite.pdf) |
| 27 | Quartz crystal | Ouachita quartz | Hexagonal prism with a pointed 3-facet tip; light and dark facets | #F4F6FA, #C9D6E3 | Unsourced |
| 28 | Water jug | Spring water / jug filling | Round-shouldered jug, small loop handle, cork | stoneware tan or glass green | Unsourced |
| 29 | Fedora | Gangster era (generic, no likeness) | Pinched crown (trapezoid with a notch) over a wide elliptical brim, with a band | #2B2A27, band #7C1F1F | Unsourced |
| 30 | Tommy gun | Gangster era (use sparingly) | Long barrel, round drum magazine circle, stock | gunmetal | Unsourced |
| 31 | Roulette wheel | Illegal casinos 1950–65 | Concentric circles, 37 alternating wedges, center spindle | red/black/green | [Rex Nelson](https://www.rexnelsonsouthernfried.com/post/along-park-avenue) (casino boom) |
| 32 | Dice pair | Gambling | Two rounded squares in isometric, pips | ivory, red | [Rex Nelson](https://www.rexnelsonsouthernfried.com/post/along-park-avenue) |
| 33 | Playing-card spade | Casino / card games | Spade glyph from heart-inverted + stem | black | Unsourced |
| 34 | Racehorse | Oaklawn racing | Galloping horse silhouette, 4 legs extended, jockey hump | bay brown, silks | Unsourced |
| 35 | Horseshoe | Racing luck | U-shape thick stroke with 6 nail holes | steel | Unsourced |
| 36 | Rollercoaster | Magic Springs park (generic, no park marks) | Sine-wave track with a lattice of vertical supports | red track, white supports | Unsourced |
| 37 | Largemouth bass | Lake fishing | Fish with big jaw, dark lateral stripe, spiny dorsal | #4F6B35, belly #E6DDB0 | Unsourced |
| 38 | Fishing bobber | Lake life | Circle split red over white, with a stem | #C8452B, white | Unsourced |
| 39 | Pontoon / boat | Lake Hamilton | Flat deck rectangle on two pill pontoons, canopy line | white, lake blue | Unsourced |
| 40 | Alligator | Alligator farm | Long low body, ridged back zigzag, open V jaw | #3E5A3A | Unsourced |
| 41 | Ostrich | Ostrich farm (postcard subject) | Big oval body, long S neck, small head, 2 long legs | black/white plumes | [Etsy listing](https://www.etsy.com/listing/4516116804) |
| 42 | Baseball | Spring training history | Circle with two curved stitch arcs (red ticks) | white, #C8452B | Unsourced |
| 43 | Streetcar | Early electric streetcars | Rounded-roof box on 2 wheels, trolley pole diagonal | dark green, cream | Unsourced |
| 44 | Parasol | Gilded-age promenade | Scalloped half-circle canopy, curved handle | lace white, rose | Unsourced |
| 45 | Bath towel & robe | Bath ritual | Folded rectangles with stripe | white, blue stripe | [NPS Bathhouse Row](https://www.nps.gov/hosp/learn/historyculture/bathhouse-row.htm) |
| 46 | Bath ticket | Bath tickets | Rectangle with notched/serrated edge and a numeral | cream, red ink | Unsourced (design undocumented; invented) |
| 47 | Neon arrow | Motel / club signs | Bent arrow path, double-stroked with glow | neon red/blue | Unsourced |
| 48 | Motor hotel tower | Velda Rose | Tall slab with a regular balcony grid on a wide parking podium | P7 | [OfficeSpace](https://www.officespace.com/ar/hot-springs/1368578-217-park-ave) |
| 49 | Postcard | Linen postcards | Rectangle with cream border, stamp square, wavy cancel lines | P6 | [Collectors Weekly](https://collectorsweekly.com/postcards/linen) |
| 50 | Trojan helmet | Hot Springs HS Trojans (generic shape, not a logo) | Crested helmet profile (arc crest + cheek guard) | black, gold | [Wikipedia HSHS](https://en.wikipedia.org/wiki/Hot_Springs_High_School_(Arkansas)) |
| 51 | Ram horn | Lakeside Rams (generic shape) | Spiral curl from 3 decreasing arcs | blue, gold | [Wikipedia Lakeside](https://en.wikipedia.org/wiki/Lakeside_High_School_(Hot_Springs,_Arkansas)) |
| 52 | Wolf head | Lake Hamilton Wolves (generic shape) | Pointed ears triangle head, snout wedge | maroon, gold | [Wikipedia Lake Hamilton](https://en.wikipedia.org/wiki/Lake_Hamilton_High_School) |
| 53 | Piano / harp | Fordyce Music Room (the 1915 assembly room) | Grand piano curve silhouette or triangle harp with strings | black, gold | [NPS Fordyce](https://home.nps.gov/hosp/planyourvisit/fordyce-bathhouse.htm) |
| 54 | Indian-head cartouche | Quapaw entrance carving | Oval cartouche with scroll ends (abstract; avoid caricature; no face) | terra cotta | [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row) |

Sensitivity: the Quapaw "Indian head" ornament should be drawn as an abstract architectural cartouche or a Quapaw Nation-respectful motif, not a caricature.

---

## Motif and pattern library

Each motif traces to a sourced detail: Fordyce "lozenge-patterned brickwork" and a Greek-motif parapet; Quapaw chevron-patterned dome mosaic and scalloped shells framing sculpin fish; Hale and Administration Building wrought-iron grilles and balconies; Superior concrete painted to imitate ornamental tile with green tile medallions; Buckstaff paterae — [Wikipedia, Bathhouse Row](https://en.wikipedia.org/wiki/Bathhouse_Row); Medical Arts bas-relief limestone frieze and bronze grillework — [EoA](https://encyclopediaofarkansas.net/entries/medical-arts-building-6047/); Fordyce glass with figures "floating in a sea of blue and green" — [SAH Archipedia](https://sah-archipedia.org/buildings/AR-01-GA6); linen texture — [Collectors Weekly](https://collectorsweekly.com/postcards/linen). The recipes themselves are **[inferred]**; function names are suggestions for shared code.

| # | Motif | Suggested function | Construction recipe | Uses |
|---|---|---|---|---|
| 1 | Fordyce Lozenge Brick | `drawLozengeBrick(ctx, rect, opts)` | Light-yellow running bond (`#E3CF94` est.): bricks 2:1, half-offset every row, 1 px mortar `#CDBF9F`. Lay a diagonal grid of diamonds (square rotated 45°, side ≈ 3 bricks) in **dark brown brick** `#6E4B2F` est.: the 1915 *Gazette* says "brown and light yellow pressed brick, the darker working out a diamond bond" ([HSR](http://npshistory.com/publications/hosp/hsr-hds-fordyce-bathhouse.pdf) p.104). Use it only on the upper two stories; the first story is plain cream enamel brick `#E6D7B5`. | Card-back fields, tile edges, Fordyce facades |
| 2 | Quapaw Chevron Dome | `drawChevronDome(ctx, cx, cy, r, opts)` | On a semicircle or circle draw concentric bands; in each band alternate V-chevrons (zigzag polylines) in buff `#D8C29A`, tan `#B89A6A` and cream `#E6D7B5`, dotted with small gold and blue `#2B4C9B` diamonds. Around the base, a darker ochre band `#C8963E` edged in brown `#6E4B2F`, with rosettes and turquoise `#3FA8A0` inset panels. Radial version: clip a zigzag stripe pattern to the dome path. Hue families come from the 1984 HABS color photos **[observed 1984]**; hexes are estimates. | Mahjong tile back and "dot"-suit variant, card-back medallion, Thermal Blocks skin |
| 3 | Scallop and Sculpin Border | `drawScallopSculpinBorder(ctx, rect, opts)` | Repeat a 7-rib fan (scallop) along the border at a fixed interval; between each pair place a small fish (ellipse body, triangular tail, fan fin). Gold `#D4AF37` fish on cream = original look; white fish = current look. | Card and board borders, frames |
| 4 | Leaded Sea Glass | `drawLeadedGlass(ctx, rect, seed, opts)` | Voronoi tessellation (or random convex polygons) over the area; fill each cell from the ramp `#1F5F6B → #2A9D8F → #7FC8B8 → #2B4C9B`; stroke cells 2–3 px in dark lead `#2A2A2A`; add a larger figural cell group (mermaid tail curve) and an amber accent ring `#D9A23A`. Skylight frame: rectangle with a border of small squares. Seed per player for unique decks. | Card backs, skylight interiors, victory screens |
| 5 | Wrought-Iron Scroll | `drawIronScroll(ctx, x, y, size, opts)` | C- and S-scrolls with cubic Béziers ending in small spirals (Archimedean, 1.5 turns); mirror across a vertical axis; add vertical pickets with spear finials (small diamond on top). Stroke 2–4 px `#1F2A24`. | Tile corners, card-back borders, gates |
| 6 | Deco Sunburst / Bronze Grille | `drawDecoSunburst(ctx, cx, baseY, r, opts)` / `drawBronzeGrille(ctx, rect, opts)` | From bottom center cast 12–24 rays as alternating thin and thick triangles in a semicircle fan, then concentric stepped arcs. Grille variant: nested chevrons stacked vertically between verticals. Bronze `#7C5A2E` with gold highlights on limestone `#D8CFBD`. | Medical Arts, Deco screens, scoreboards, hint arrows |
| 7 | Steam Curls | `drawSteam(ctx, x, y, h, t, opts)` | Each curl is a vertical sine path with decreasing amplitude, 20–35% white, Gaussian blur; tile as staggered columns; animate the phase offset for a living card back. | Every game: idle animation, match/clear effects |
| 8 | Tufa Terraces | `drawTufaTerraces(ctx, rect, rows, opts)` | Rows of overlapping half-ellipses (scalloped lobes) stepping down; each lobe a gray gradient (rim `#C8C3B6` → base `#9A968C`); thin blue water lines over the rims; emerald fringe dots at edges. | Board centers, cascade animations, Thermal Blocks backgrounds |
| 9 | Paterae Rosette Row | `drawPateraeRow(ctx, x, y, w, count, opts)` | Circle with 8–12 petal ellipses rotated around the center and an inner disk; repeat in a frieze band. Green tile `#4E7D5B` for Superior, white for Buckstaff. | Friezes, tile borders, coin/score badges |
| 10 | Spanish Tile Roof Strip | `drawTileRoofStrip(ctx, x, y, w, opts)` | Rows of overlapping half-circles (barrel tiles seen from the front) in red `#A9432C` with alternate darker courses `#7E2F1F` and a thin highlight arc. | Top edges of cards, boards, Mahjong tile edge band, roofs |
| 11 | Running-Bond Promenade Brick | `drawBrickPath(ctx, bezierPts, width, opts)` | Brick pattern mapped along a curved Bézier, warm red `#B5654A`, gray mortar line. | Paths on maps, board track, Mahjong ribbon layout |
| 12 | Magnolia Repeat | `drawMagnoliaLattice(ctx, rect, opts)` | Diagonal lattice with a magnolia blossom at each node and two leaves, white and `#2F4F2F` on cream. | Gilded-era card back, frames |
| 13 | Linen Texture Overlay | `applyLinenTexture(ctx, rect, opts)` | 4×4 px crosshatch at 8% multiply plus faint noise over any illustration. | "Postcard mode" for any scene |
| 14 | Routed-Wood Sign Plank | `drawRoutedSign(ctx, rect, text, opts)` | Brown rounded rectangle with horizontal grain lines (low-amplitude noise sines); inset cream letters with a darker inner shadow for a routed look. Sign style inferred; NPS sign standards unsourced; no arrowhead. | Trail and map labels, menus |
| 15 | Neon Outline | `drawNeon(ctx, path, color, t, opts)` | Draw the path three times: 10 px stroke with blur at 30% alpha, 4 px color stroke, 1.5 px near-white core; flicker by modulating alpha. | Night modes, signage, high-score banners |

The actual Quapaw dome color sequence and the Maurice tile patterns are unknown; consult public-domain NPS or HABS photos before finalizing.

---

## Period graphic design

**Linen postcards (best documented)**
- Linen cards were not linen fiber: they had high rag (cotton) content, and "linen" refers to the embossed surface texture. Popular 1930s–1950s; declined as color photography took over in the 1950s — [Collectors Weekly](https://collectorsweekly.com/postcards/linen).
- Key traits: saturated colors (echoing Detroit Publishing "Phostints") and a soft focus from the uneven surface; images colorized in vivid, often exaggerated hues with an airbrushed look — [Smithsonian Magazine](https://www.smithsonianmag.com/travel/immigrant-story-behind-classic-greetings-from-postcards-180970894/); [Collectors Weekly](https://collectorsweekly.com/postcards/linen).
- Curt Teich Co. of Chicago pioneered linen cards; the Newberry Library holds the Teich archive of more than 360,000 images (1898–1978) — [Newberry Curt Teich Co. records](https://archives.newberry.org/repositories/2/resources/1282). Hot Springs NP has a postcard collection finding aid — [NPS Postcard Finding Aid (docx)](https://www.nps.gov/hosp/learn/historyculture/upload/Postcard-Finding-Aid.docx).
- Postcard subjects from the linen era include the Ostrich Farm, Bath House Row (1949) and roadside courts such as the "Spike Hunter Court Motel, US 70" (seller listings, dates unverified) — [Etsy listing](https://www.etsy.com/listing/4516116804); [eBay listing](https://www.ebay.de/itm/157392110170).

**Linen-postcard shader recipe [inferred]** (`renderLinenPostcard(ctx, scene, opts)`)
1. Flat airbrush gradients: sky from saturated cerulean `#2F7FC6` at the top to pale cyan `#A7DDF2` at the horizon.
2. Overlay a crosshatch of 1 px lines at 0° and 90°, 3–4 px apart, at 6–10% opacity in multiply, for the embossed texture.
3. Slight blur of about 0.5 px to soften edges.
4. Cream (`#F3E9D2`) white border 8–12 px wide.
5. Title in a bold condensed or script face in yellow or red with a dark outline, in the corner or along the bottom.

**Large-letter style:** block letters filled with scenes is the classic Teich layout (from general knowledge, not a Hot Springs source). Render with clipped paths: each letter is a clip region filled with a mini scene.

**Undocumented ephemera (do not describe as historical):** Hot Springs railroad posters (Missouri Pacific / Iron Mountain / Rock Island), hotel ads, matchbooks, bath tickets, Oaklawn racing programs, Mountain Valley Spring Water label design, 1920s–40s club neon. Any game version of these is an original design. The 1877 booklet "The Hot Springs of Arkansas, America's Baden-Baden" is documented as an artifact ([NPS Getting to the American Spa](https://www.nps.gov/hosp/learn/kidsyouth/getting-to-hot-springs-national-park.htm)) but its design is not.

---

## Reference image sources

Consult only; do not download or embed. HABS/HAER items at LOC and NPS photos are generally public domain as US federal government works; Wikimedia Commons files need a per-file check.

- **HABS AR-28: Bathhouse Row & Grand Promenade** (drawings, data pages, photo captions) — [LOC item ar0031](https://www.loc.gov/item/ar0031). A 1984 Jack Boucher HABS photo of the Fordyce entrance foyer is catalogued as HABS ARK,26-HOSP,1-D-17 (search result).
- HABS AR-41, Pythian Bathhouse — [Library of Congress](https://www.loc.gov/item/ar0041).
- NHL photo set for Bathhouse Row — [NPGallery 74000275 photos](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_photos).
- Hot Springs NP postcard collection finding aid — [NPS docx](https://www.nps.gov/hosp/learn/historyculture/upload/Postcard-Finding-Aid.docx).
- University of Arkansas Special Collections: NPS business records of the Fordyce, Maurice and Ozark bathhouses, including architectural drawings (license varies) — [UARK MC367](https://libraries.uark.edu/specialcollections/findingaids/ead/transform.php?xml=mc367).
- Curt Teich archive (copyright and terms per Newberry) — [Newberry](https://archives.newberry.org/repositories/2/resources/1282).
- The Wikipedia Bathhouse Row article "incorporates public domain material from websites or documents of the National Park Service"; check per-image licenses on Commons — [Wikipedia](https://en.wikipedia.org/wiki/Bathhouse_Row).
- Arkansas Digital Heritage — [digitalheritage.arkansas.gov](https://digitalheritage.arkansas.gov/lemke-drawings-dailies/94).
- Encyclopedia of Arkansas photo entries (rights vary) — [EoA](https://encyclopediaofarkansas.net/photo-of-day/this-day-1638/).
- **[inferred]** HABS elevations and sections are the best reference for exact facade proportions; their line-drawing nature maps directly onto SVG path work.

---

## Per-game art-direction hooks

Hook groups from the notes: A = card games, B = mahjong, C = board games, D = sports, E = park sim, F = farm sim, G = cross-game. Everything below is **[inferred]** design direction built on the sourced facts above.

### Spa City Solitaire (card backs)
- **Palettes:** `gilded-spa` default, `deco-neon` "Neon Night" deck, `linen-postcard` tableau, `thermal-water` effects; era selector across all seven.
- **Card backs (A1, A14):** one per bathhouse — Fordyce lozenge (Motif 1), Quapaw chevron dome (2), Maurice green tile, Buckstaff paterae (9), Ozark stepped towers, Hale red hip and bell gable, Superior painted-tile medallions, Lamar flat parapet; plus seeded Fordyce leaded glass (4) so each player's deck is unique, and Southern Club dark glass.
- **Faces (A2–A4, A7, A8):** Gilded-era promenaders (parasol queens, bowler-hat jacks) as flat geometric costumes; a Deco deck with Medical Arts setback pip corners and bronze-sunburst court frames; Ace of Spades = Medical Arts silhouette, Ace of Hearts = magnolia; Joker = generic fedora-and-cigar silhouette, no real-person likeness. Fifth bonus suit of sculpin fish (A12).
- **Table:** card-table felt `#1E5B3A` with a faint Deco grille watermark (A9); linen-postcard tableau background with crosshatch, foundations framed as postcard stamps (A5).
- **Motion:** steam curls rise when shuffling (A6); tufa cascade water flows down the tableau on victory (A10); novaculite "sharpen" white sweep for power-ups (A16); motor-hotel "Vacancy" neon flicker on a new high score (A15); bath-ticket score cards with serrated edges and red numerals (A13, invented design).

### Bathhouse Mahjong (custom tiles)
- **Palettes:** `gilded-spa` faces, `thermal-water` dots, `ouachita-forest` bamboo/winds, `deco-neon` night mode.
- **Suits (B1):** Dots = steam springs (concentric pool circles with wisps); Bamboo = pine trees (stacked triangles); Characters = bathhouse facades 1–9 (eight bathhouses plus the Administration Building, in row order).
- **Honors (B2, B3):** Winds = the four mountains around the valley as ridge silhouettes with novaculite-white ridgelines; Dragons: Red = red clay tile roof, Green = Maurice green tile, White = novaculite whetstone.
- **Flowers/Seasons (B4):** magnolia, dogwood, redbud, sweetgum leaf; spring steam, summer lake, fall foliage, winter tufa. Bonus tiles (B9): sculpin fish, scallop shell, DeSoto helmet, Neptune's Daughter mermaid.
- **Tile build (B5–B7):** face in marble `#F2EFE8` with gray vein Béziers; back in the Quapaw chevron mosaic; edge band of Spanish roof-tile scallops (Motif 10).
- **Layouts and effects (B8, B10–B16):** a "Grand Promenade" ribbon layout along a brick path; Arlington twin towers as the capstone tile of a turtle layout; neon tile outlines at night; matched pairs release steam; bronze Deco hint arrow; Frontier wood-grain and Deco limestone-with-bronze tile sets; parallax of Hot Springs Mountain and its tower against a linen sky; a 143° thermometer tile as a wild.

### Thermal Blocks (9×9 block puzzle)
- **Palettes:** `thermal-water` default; unlockable skins in `gilded-spa`, `deco-neon`, `ouachita-forest`, `lake-life`.
- **Block skins:** steam-pool blocks (radial pool gradient + 3 wisps), tufa blocks (Motif 8 lobes), red clay tile blocks (Motif 10 barrel arcs), Quapaw chevron blocks (Motif 2 clipped to squares), Fordyce lozenge-brick blocks (Motif 1), novaculite whetstone blocks (white with sheen stripe).
- **Board:** a 9×9 grid framed like a 3×3 skylight (Motif 4 frame of small squares) with leaded-glass 3×3 sub-box dividers in lead `#2A2A2A`.
- **Clears:** a cleared row "vents" — steam curls (Motif 7) rise and the row flashes algae green `#2A9D8F`; combos send water down tufa terraces; a 143°F thermometer fills as a combo meter.
- **Themes by level:** pre-contact novaculite ridges, Gilded Row, neon night, lake sunset (era palettes).

### Valley of Vapors Trivia Trail (trivia board game)
- **Palettes:** `linen-postcard` cards, `gilded-spa` board, era palette per question category.
- **Board (C1, C10, C14):** a trail path in running-bond Promenade brick (Motif 11) winding up Hot Springs Mountain past trail shelters and the tower; trivia wedge icons from the Icon Catalog (steam spring, baseball, racehorse, bass, fedora, Quapaw dome).
- **Cards (C8):** question cards as linen postcards (shader recipe) with large-letter category titles; "Fact or Promo" cards styled as routed-wood signs (Motif 14).
- **Map style per era (C11):** frontier hand-inked sepia, Gilded engraved line with hatching, mid-century flat color with airbrush gradients.
- **Weather (C16):** steam fog banks sweep over the board in winter rounds.

### Ouachita Bass Classic (lake fishing tournament)
- **Palettes:** `lake-life` default, `nps-rustic` shoreline, `thermal-water` for creek inflow, `ouachita-forest` for hillsides.
- **Lake art:** deep blue `#1E4E79` to shallows `#4C8FA8` depth gradients; islands as pine-topped blobs with novaculite-white rock edges; dock-wood `#9C7A55` piers; fall shoreline in `#C8501F` (E11, F15, C15).
- **Icons:** largemouth bass (#37), bobber (#38), pontoon (#39), plus a weigh-in scoreboard as a Deco bronze grille with neon digits (D8).
- **Signage:** routed-wood ramp and marker signs (Motif 14), no agency logos.
- **Atmosphere:** morning steam/fog on cold mornings (F11; lake fog itself is unsourced); heat shimmer via a displacement sine on summer afternoons; sunset gold `#F2A541` sky bands.

### Friday Night Spa City (HS football)
- **Palettes:** `school-colors` (stand-ins), `deco-neon` night sky, `gilded-spa` town skyline.
- **Uniforms (D1–D3, D5):** Hot Springs Trojans black jersey, gold numerals with a thin white outline, a crest-shaped helmet stripe; Lakeside Rams royal blue with a gold ram-horn spiral on the sleeves; Lake Hamilton Wolves maroon and gold with a wolf-ear notch collar; 1920s throwbacks in cream wool tone with a single chest stripe. Mascots are generic geometric shapes (#50–52), never school logos.
- **Numbers (D4):** block numerals built from rectangles or `--font-neon`; optional Bungee/Righteous web fonts.
- **Stadium (D7, D10, D12, D13):** skyline of Medical Arts and Arlington towers beyond the end zone for town schools; crowd as dot-matrix circles in team colors; felt-textured triangle pennants; radial gradients from light towers for night games.
- **Rivalry week (D14):** split-diagonal color fields (black/gold vs blue/gold; blue/gold vs maroon/gold). Trophy shaped like a Quapaw dome on a plinth (D15). Small-town Friday nights at the 2A/3A schools get pine-ridge backdrops versus big 6A crowds (schools-notes hook 26).

### Spa City Hoops (HS basketball)
- **Palettes:** `school-colors`, `gilded-spa` for hardwood and arena trim, `deco-neon` for scoreboard.
- **Court:** hardwood as long thin strips in warm tan with a center-circle motif of paterae rosettes (Motif 9) in team color [inferred].
- **Scoreboard (D8):** Deco bronze grille with neon digits; a 35-second shot-clock readout in `--font-mono`.
- **Arena:** state finals arena interior as a generic modern arena (no venue branding); crowd dot-matrix; banners as pennants with year numerals for historic title seasons.
- **Uniforms:** same stand-in colors and generic mascot shapes as football; mascot animations as spinning geometric shapes (D11).

### Diamond Springs (HS baseball)
- **Palettes:** `school-colors`, `linen-postcard` for "Legends" mode, `gilded-spa` for historic grandstands.
- **Fields (D9):** turf pattern with alternating mow stripes and novaculite-white lines; historic Whittington-style park with a short right-field fence and a tall wooden grandstand drawn in frontier/gilded wood tones; the alligator farm across the street as a backdrop prop (alligator icon #40).
- **Legends mode:** 1900s–1920s spring-training scenes in linen-postcard filter with cream wool throwback uniforms (D5, D6) — fictional players, no real likenesses.
- **Icons:** baseball (#42), bat, Baseball Trail-style collectible marker cards (invented design).

### Bathhouse Barons (original property-trading board game)
- **Palettes:** `gilded-spa` board, `deco-neon` "1940s" board variant, era palettes per property group.
- **Board (C1–C3, C6):** the path is Central Avenue with the Bathhouse Row properties along one side in real order; property color groups by material — Red Tile, Cream Brick, Green Tile, Neon, Limestone Deco, Lake Blue; corner spaces Display Spring, Hot Springs Mountain Tower, Oaklawn-style racetrack (generic), the Lake; board center a procedurally drawn tufa cascade (Motif 8).
- **Pieces (C4, C9, C12):** tokens = fedora, horseshoe, whetstone, bass, jug, streetcar, parasol, sculpin; houses as small red-tile hip-roof cubes; hotels as twin-tower blocks; ivory dice with red pips.
- **Cards and money (C5, C8, C13):** railroad spaces styled as era tickets; utilities as "Spring Water Works" and "Electric Streetcar"; event cards as linen postcards; money in Deco guilloche-like patterns drawn as layered spirograph curves.
- **Era boards (C7):** 1880s board magnolia-bordered with ironwork corners (Motifs 12, 5); 1940s board black with neon space dividers (Motif 15).

### Spa City Thrills (original theme-park sim inspired by Magic Springs)
- **Palettes:** `motor-hotel` signage, `lake-life` water park, `nps-rustic` and `ouachita-forest` wooded hillside terrain, `deco-neon` night.
- **Pieces (E7):** coaster track in red with white lattice supports (icon #36); mid-century signage kit (neon arrows, starbursts). Theme kits are original — logging, mining, bears and mountain taxis are generic zone themes; no real park names, logos or ride branding.
- **Heritage set (E1–E6, E12–E14):** placeable bathhouses with era-correct roofs; Magnolia and Grand Promenade path pieces with iron railing and lamp posts (nod to Jensen's 1916 lighting); thermal spring tiles with steam emitters, tufa and algae fringe; a lattice tower with a view-radius bonus; rustic trail shelters; alligator and ostrich pens; a racing-track attraction with a silks color picker; a fountain builder using Deco sunburst jets.
- **Modes (E8, E9, E15):** day/night cycle with neon at dusk; postcard snapshot mode with linen filter and "Greetings from…" large-letter title; restoring a building returns its 1920s palette from a faded "vacant" palette (desaturate + grime overlay).
- **Seasons (E10):** spring redbud/dogwood, fall maple/oak oranges.

### Valley of Vapors: Through the Ages (farming/life sim across eras)
- **Era palettes (F1–F6, `ERA_PALETTE` in tokens.js):** ancient = `ouachita-forest` (no buildings, novaculite quarries as white rock nodes, steaming creek); frontier = `frontier-valley` (log cabins, plank lean-tos, whitewashed fence, mud lanes); gilded-spa = `gilded-spa` (brick farmhouse, iron gates, magnolias, produce sold to bathhouse hotels); roaring = `deco-neon` (Deco barn signage, roadside stand with neon "FRESH"); midcentury = `motor-hotel` (motor-court-style farm stand, turquoise and coral paint, pastel 1950s fenders); revival = `nps-rustic` with the vacant-Row variant; modern = `lake-life` (downtown farmers' market in restored brick, lake-view acreage).
- **Transitions (F7, F16):** crop-tile borders change per era (wood grain → iron scroll → Deco chevron → atomic starburst); era-transition cutscene redraws the same valley vista in each palette, wiping left to right.
- **Activities (F8, F9, F14, F15):** whetstone tool-sharpening with a white novaculite stone and sparkle; spring-water jug collecting from a steaming spring; quartz-crystal nodes on ridges (hexagonal prisms); lake fishing pond with bass and bobbers.
- **Seasons and weather (F10, F11):** spring redbud magenta accents, summer saturated greens, fall sweetgum and maple oranges, winter gray-brown oak with pine green; morning steam fog in valleys, summer heat shimmer.
- **Posters (F12):** market posters in linen-postcard style.

### Cross-game (all 11)
- Shared tokens (P1–P10) as CSS custom properties and JS constants in `shared/design/` (G1); shared motif generator functions named as in the Motif table (G2); a shared Bathhouse Row skyline banner built from the skyline recipe (G3); an icon atlas built at runtime from primitives (G4); a consistent typographic system per era (G5).

---

## Caveats

- **Every hex is an estimate** matched to written material descriptions; no colorimetric sources were used. Sample public-domain NPS/HABS photos to refine. No official hex values exist in the sources for any building, school or business.
- School colors are stand-ins in two slightly different sets (style guide vs schools notes); official values were not found, and colors for Fountain Lake, Cutter-Morning Star, Jessieville and Mountain Pine were not found at all.
- The Quapaw dome and Maurice tile hues now come from 1984 HABS color photos (**[observed 1984]**: buff/tan/ochre chevrons with blue diamonds and turquoise panels; dark green Maurice tile with ochre and blue panels). Film color is not a specification, and every hex remains an estimate.
- Fordyce glass: the mermaid / Neptune's daughter imagery is in the men's bath hall skylight (1915 sources in the NPS HFR); the earlier **[DISPUTED]** flag is dropped. Maker: Condie-Bray (1917 trade journal) for the men's hall; Condi-Neal (NPS podcast) for the assembly room and ladies' glass. Piece count: about 8,000 vs about 18,000 (both printed in 1915).
- Date conflicts carried over: Hale 1883 vs 1892–93; Hale remodel 1914 vs 1919; Administration Building 1936 vs 1938 (HABS data page); Southern Club glass front 1940s (CAHD) rather than 1927; Fordyce 1914–15 vs 1915; current Arlington 1924 vs 1925; Majestic 1882/1888 vs the trail marker's 1902; Velda Rose 1960 vs 1963; Grand Promenade completed 1958 (NPS) vs early 1960s (Wikipedia); Rix Tower removed 1971 (NPS) vs 1975 (Wikipedia); Woolman tower ~75 vs ~80 ft. Architect spellings: Harry vs Harvey C. Schwebke; George Gleim Jr. vs George R. Gleim Jr.
- The Bathhouse Row NHL nomination text is at [NPGallery 74000275](https://npgallery.nps.gov/NRHP/GetAsset/NHLS/74000275_text). The per-building HABS records are AR-28-A (Superior, LOC ar0032) through AR-28-I (Administration Building, ar0040); see `bathhouse-row-layout.md`.
- Not sourced (general knowledge or invention): frontier town appearance; 1920s–40s club interiors/exteriors (Southern Club beyond its glass, Vapors, Belvedere) and neon sign colors; Velda Rose signage; Downtowner and Hwy 7 motor courts; streetcars and parasols; Central Avenue ironwork and Grand Promenade railing details; fall foliage, dogwood/redbud timing and colors; lake water colors; sunsets; NPS sign standards; railroad posters, hotel ads, matchbooks, bath tickets, racing programs and Mountain Valley labels.
- Hot Springs Mountain Tower's 216-ft description in the visual notes rests on a single secondary source ([MiraCosta park guide](https://gotbooks.miracosta.edu/gonp/hosp/html/hosp0206.html)); the landmarks notes confirm it via NPS and Wikipedia.
- Font licenses were not checked one by one; Beon and Yellowtail are marked "verify."
- The notes' visual hooks were written by game type, not for these 11 titles; the mapping above is a design inference.
- Content rules: no logos or brand marks; mascots are generic shapes; the Quapaw cartouche stays abstract; no real-person likenesses.
