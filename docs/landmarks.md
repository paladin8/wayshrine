# Landmarks

Landmarks are hand-crafted places emblematic of Japan, one per special region, built as models rather than generated. Restoring them (not shrines) unlocks abilities. See [ADR 0006](decisions/0006-landmarks-and-progression.md) for the mechanics.

Fifty are planned, in nine **acts**. An act is a band: its landmarks sit in a ring farther from the start than the act before, on a bearing that is rotated per seed, so the world grows outward in a spiral rather than along a chain. Geography is loose: an act's biome is the main constraint, and real-world location only decides order within it.

Status: acts I to IV (landmarks 1 to 20) are in the code, because their biomes and abilities exist. Acts V to IX need new biomes and abilities first (below). ## Models

A landmark's model is `public/models/landmarks/<id>.glb` (binary glTF, Y up, one unit = one world unit), centred on the region's site and sitting on its flat plateau. Without a file, the landmark shows a plain placeholder. Conventions the loader relies on:

- Author it alive; the dead look is derived per material (as for scenery), so keep one material per colour and name them.
- Parts named `glow_*` (or using a `glow_*` material) light up and flare as the region wakes.
- The ground under it is a flat square plateau of half-width 9.7 (`LANDMARK_PLATEAU_RADIUS`) that eases back to natural height over 8 more units (`LANDMARK_BLEND`), so keep the diorama within about 19.4 units square and let its edge sit at ground level. Monuments keep clear of the plateau and slope.
- The model is a diorama up to about 19 units square; set `radius` on its entry in `LANDMARK_SPECS` to its solid footprint (the player is stopped there, and uses the landmark from just outside it).

Done: fushimi-inari. Everything else uses the placeholder.

## Abilities

| Ability | Unlocked at | Opens | Status |
| --- | --- | --- | --- |
| Boat | 3 landmarks | water | in code |
| Snowshoes | 8 | snow | in code |
| Climbing gear | 13 | mountain | in code |
| Geta | 20 | marsh | planned |
| Lantern | 26 | dark forest | planned |
| Ash sandals | 33 | volcanic ground | planned |
| Ship | 39 | open sea | planned |

Each threshold sits at the end of an act, so an act's landmarks never need the ability they unlock.

## The list

| # | Act | Id | Landmark | Biome |
| --- | --- | --- | --- | --- |
| 1 | I Meadow | fushimi-inari | Fushimi Inari Taisha, the torii tunnel | meadow |
| 2 | | kinkaku-ji | Kinkaku-ji, the Golden Pavilion | meadow |
| 3 | | todai-ji-daibutsu | Great Buddha of Todai-ji | meadow |
| 4 | II Shore | itsukushima-torii | Itsukushima floating torii | water |
| 5 | | himeji-castle | Himeji Castle | meadow |
| 6 | | kiyomizu-dera | Kiyomizu-dera and its wooden stage | meadow |
| 7 | | meoto-iwa | Meoto Iwa, the wedded rocks | water |
| 8 | | enoshima-lighthouse | Enoshima lighthouse | water |
| 9 | III Snow | shirakawa-go | Shirakawa-go gassho houses | snow |
| 10 | | matsumoto-castle | Matsumoto Castle | meadow |
| 11 | | hirosaki-castle | Hirosaki Castle | snow |
| 12 | | zao-juhyo | Zao snow monsters | snow |
| 13 | | kenroku-en | Kenroku-en in winter ropes | snow |
| 14 | IV Mountain | mount-fuji | Mount Fuji | mountain |
| 15 | | nikko-toshogu | Nikko Toshogu | mountain |
| 16 | | kegon-falls | Kegon Falls | mountain |
| 17 | | kappa-bashi | Kappa-bashi, Kamikochi | mountain |
| 18 | | tateyama-kurobe | Tateyama Kurobe snow corridor | mountain |
| 19 | | koyasan-okunoin | Koyasan Okunoin cemetery | mountain |
| 20 | | yoshino-yama | Yoshino-yama cherry slopes | meadow |
| 21 | V Marsh | kushiro-shitsugen | Kushiro Wetland and its cranes | marsh |
| 22 | | oze | Oze boardwalks | marsh |
| 23 | | ouchi-juku | Ouchi-juku thatched post town | marsh |
| 24 | | yanagawa | Yanagawa canals | marsh |
| 25 | | kawagoe | Kawagoe bell tower | meadow |
| 26 | | kurashiki-bikan | Kurashiki Bikan canal quarter | marsh |
| 27 | VI Forest | jomon-sugi | Jomon Sugi | forest |
| 28 | | shiratani-unsuikyo | Shiratani Unsuikyo moss forest | forest |
| 29 | | arashiyama | Arashiyama bamboo grove | forest |
| 30 | | nachi-falls | Nachi Falls and pagoda | forest |
| 31 | | meiji-jingu | Meiji Jingu forest gate | forest |
| 32 | | ise-jingu | Ise Jingu | forest |
| 33 | | nikko-cedars | Nikko cedar avenue | forest |
| 34 | VII Volcanic | sakurajima | Sakurajima | volcanic |
| 35 | | mount-aso | Mount Aso caldera | volcanic |
| 36 | | beppu-hells | Beppu hells | volcanic |
| 37 | | owakudani | Hakone Owakudani | volcanic |
| 38 | | jigokudani | Noboribetsu Jigokudani | volcanic |
| 39 | | unzen | Unzen | volcanic |
| 40 | VIII Open sea | gunkanjima | Hashima, Battleship Island | sea |
| 41 | | ogasawara | Ogasawara islands | sea |
| 42 | | naruto | Naruto whirlpools | sea |
| 43 | | shuri-castle | Shuri Castle | sea |
| 44 | | yonaguni | Yonaguni Monument | sea |
| 45 | | okinoshima | Okinoshima | sea |
| 46 | IX Far north | shiretoko | Shiretoko | snow |
| 47 | | otaru-canal | Otaru Canal | snow |
| 48 | | goryokaku | Goryokaku star fort | snow |
| 49 | | asahiyama | Asahiyama | snow |
| 50 | | sapporo-tv-tower | Sapporo TV Tower | snow |

## Open questions

- Acts V to IX each need a biome with its own palette, props and traversal rule, and the matching ability; these should be designed together.
- The names and a line of text for each landmark go through `src/app/i18n/`, in English and Japanese, when the UI shows them.
- Haiku are linked to the landmark they are about by `landmark` in `content/haiku-scenery.json` (nine so far, from Bashō; the poems are in `content/source/landmark-haiku.json`). The link reaches the text index but does not yet change placement: placing a linked monument near its landmark is still to do.
