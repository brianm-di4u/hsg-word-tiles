# Bathhouse Letters: town content

Every place, fact, name and colour the game uses, with its source. Player-facing facts come from the
audited bank (`shared/data/trivia-questions.json`, a copy of `games/trivia/data/questions.json`) or quote
a research file copied into this folder; `tools/check-facts.mjs` verifies every card. Game rules,
personas and square names are game logic and are labelled as such on screen.

## 1. The springs and the board
| Use in game | Fact | Source |
|---|---|---|
| 47 spring squares (46 premiums + the Display Spring) | The park's springs are counted as 47 ("47 springs produce about 1,000,000 gallons/day at 143°F"); other counts (43) exist | `research/bathhouse-row-and-springs.md` (Wikipedia: Hot Springs, Arkansas); `00-INDEX.md` notes the 47 / 43 conflict. The board says "one square for each of the 47 springs counted by Wikipedia" |
| Centre square "Display Spring" | The Display Spring behind the Maurice emerges into a shallow pool at about 143°F; uncovered in the 1930s | `research/visual-style-guide.md` (NPS Experience the Water); bank hs-0120 |
| Square names: Warm, Hot, Steam, Boiling Spring | Game logic (temperature words), not historical names | — |
| "Valley of Vapors" title flavour and the steam effects | The nickname comes from the steam rising off the springs | `research/culture-events-food.md` |
| Steam and tufa visuals | Steam: white curls at 15–35 % alpha; tufa: gray terraces `#9A968C` / rim `#C8C3B6` | `research/visual-style-guide.md` §Thermal water |

## 2. Bathhouse Row squares
Eight squares named for the eight historic bathhouses, placed clockwise round the board in the confirmed
north-to-south order **Superior, Hale, Maurice, Fordyce, Quapaw, Ozark, Buckstaff, Lamar**
(`research/bathhouse-row-layout.md` §1, four sources). Each square's medallion uses that building's
sourced detail (`research/visual-style-guide.md` §Architecture by building):

| Square | Medallion motif | Colours (est.) |
|---|---|---|
| Superior | green tile paterae rosette | `#4E7D5B`, `#E6D7B5` |
| Hale | double-curved bell gable, red tile | `#A9432C`, `#F3EFE6` |
| Maurice | sea-glass skylight | `#1F5F6B`→`#7FC8B8` |
| Fordyce | lozenge brick with stained-glass oval | `#E3CF94`, `#6E4B2F`, `#2B4C9B` |
| Quapaw | chevron-mosaic dome with copper cupola | `#D8C29A`, `#C8963E`, `#B87333` |
| Ozark | twin stepped towers | `#F3EFE6`, `#A9432C` |
| Buckstaff | paterae frieze and brass letters | `#E6D7B5`, `#C9A23F` |
| Lamar | skylit stair core, clay-tile cap | `#F3EFE6`, `#A9432C` |

Logos: none. Names are used as place names only.

## 3. Hot Springs bonus words
`data/thermal-words.json`: 70 entries, 184 playable forms, in six categories (Springs & stone, Bathhouse
Row, Park & nature, Track & ballpark, Clubs & casinos, Town life). Every form is an ordinary dictionary
word (no proper nouns, nothing blocklisted). Each entry carries one fact card:
- 59 cards cite an audited bank item (the card shows the bank item's source line).
- 11 cards quote a research file (`culture-events-food.md`, `bathhouse-row-and-springs.md`,
  `hot-springs-national-park.md`, `oaklawn-and-racing.md`, `arcades-and-amusements.md`).

Sensitive-history filter (00-INDEX content rules): no card uses violence, slavery, segregation or
illness as play flavour. The ranger/bootlegger fact (hs-0309) and the Vapors bombing were left out or
reworded to their neutral detail (hs-0046 is used only for "slot machines and craps tables"). The
masseurs card (Black bath workers) is presented as museum-style history, not flavour.

Proper names that appear only on fact cards (never as playable words): Fordyce, Quapaw, Maurice, Hale,
Ozark, Buckstaff, Superior, Lamar, Oaklawn, Arlington, Eastman, Whittington, Capone, Rockefeller,
Diamond Jo Reynolds, Babe Ruth (deceased historic public figures, in factual trivia only).

## 4. Opponents (fictional)
Four game opponents, clearly labelled "fictional character" on the setup screen. They are archetypes
of town trades from `research/culture-events-food.md` §Jobs (bath attendants, masseurs, park staff,
racing, radio and big-band musicians) and are not real people:

| Persona | Archetype | Level |
|---|---|---|
| Opal Vance | bath attendant on the Row | Easy |
| Hollis Crane | park ranger | Medium |
| "Lucky" Delmar | racetrack tout | Medium |
| Maestro Julian Fitch | 1920s hotel bandleader | Hard |

## 5. Palettes and type
From `shared/design/tokens.css` (copied into `src/styles/main.css`): **gilded-spa** for day (cream brick
`#E6D7B5`, red clay `#A9432C`, Maurice green `#4E7D5B`, stained-glass cobalt `#2B4C9B`, amber/brass
`#D9A23A`, marble `#F2EFE8`, wrought iron `#1F2A24`), **deco-neon** for night (`#14121F`, deco gold
`#D4AF37`, neon blue `#4FC3FF`), and **thermal-water** for springs and steam (pool `#1F5F6B`, algae
`#2A9D8F`). Display type: Limelight (as on hsargames.com). Tiles: Fraunces. UI: Josefin Sans.
All OFL, vendored.

## 6. What is game logic, not history
Tile values and counts (computed from the dictionary), square names and multipliers, the bonus amounts,
the Featured Springs, the Bathhouse Register, the opponents. The help screen says so.
