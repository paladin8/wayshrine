# Landmarks

Landmarks are hand-crafted places emblematic of Japan, one per special region, built as models rather than generated. Restoring them (not shrines) unlocks abilities. See [ADR 0006](decisions/0006-landmarks-and-progression.md) for the mechanics.

Fifty are planned, in nine **acts**. An act is a band: its landmarks sit in a ring farther from the start than the act before, on a bearing that is rotated per seed, so the world grows outward in a spiral rather than along a chain. Geography is loose: an act's biome is the main constraint, and real-world location only decides order within it.

Status: acts I to IV (landmarks 1 to 20) are in the code, because their biomes and abilities exist. Acts V to IX need new biomes and abilities first (below). ## Models

A landmark's model is `public/models/landmarks/<id>.glb` (binary glTF, Y up, one unit = one world unit), centred on the region's site and sitting on its flat plateau. Without a file, the landmark shows a plain placeholder. Conventions the loader relies on:

- Author it alive; the dead look is derived per material (as for scenery), so keep one material per colour and name them.
- Parts named `glow_*` (or using a `glow_*` material) light up and flare as the region wakes.
- **Ground.** The terrain under the footprint follows the model's own ground (a heightfield, below), 0.2 lower so the model's grass sits clear of it, and eases from the footprint edge to natural height over 8 units (`LANDMARK_BLEND`). The eased slope is drawn as a smooth surface (a "skirt": per-corner heights, `Terrain.corners`) rather than flat-topped tiles, and the player and props follow it via `Terrain.groundAt`. So the model may have a real hill, but its edge heights must be consistent: no holes, no vertical drop at the boundary. Keep the diorama within a square of half-width 9.6 and about 19.2 across. Monuments keep clear.
- **Sidecar.** The generator also writes `src/world/landmark-grounds/<id>.json` (register it in `src/world/landmark-ground.ts`): `half`, `step`, `ground` (walkable surface height on a grid, indexed [z][x], game axes: x = Blender x, z = -Blender y), `solids` (discs [x, z, r] for everything the player must not walk through), `interact` (the point the shrine is used from) and `reach`, and `stand` (where map travel arrives). `content/landmarks/fushimi-inari.py` is the reference; it must not leave zero-height holes in `ground`.
- **Walkable surfaces.** Anything the player climbs (steps, platforms, bridges) is not terrain: register it in the generator as a floor, `(x0, x1, y0, y1, top)`, so the ground grid includes it, and keep solids to what stands above the floor (the generator takes geometry in a band 0.35 to 1.6 above the local ground; up-facing hill triangles are ignored). Leave a clear path at least 0.7 wide from `stand` to `interact`; a test checks it by flood fill.
- Without a sidecar, the landmark gets a flat plateau and one solid disc.

Done: fushimi-inari, kinkaku-ji. Everything else uses the placeholder.

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

Names, in English and Japanese, are what people commonly call each place (they are the display names for `src/app/i18n/`), which is not always the formal name: 金閣寺 rather than 鹿苑寺, 奈良の大仏 rather than 東大寺盧舎那仏, 軍艦島 rather than 端島, 雪の大谷 rather than the whole 立山黒部アルペンルート. Readings are in hiragana. The Yonaguni formation is formally 与那国島海底地形 (whether it is a ruin is disputed), but 海底遺跡 is the everyday name. Asahiyama is taken to be 旭山動物園 in Asahikawa, not 旭山記念公園 in Sapporo. *What to model* is the subject of the diorama.

| # | Act | Id | Name | Japanese | Reading | What to model | Biome |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | I Meadow | fushimi-inari | Fushimi Inari | 伏見稲荷 | ふしみいなり | the torii tunnel | meadow |
| 2 | | kinkaku-ji | Kinkaku-ji | 金閣寺 | きんかくじ | the Golden Pavilion | meadow |
| 3 | | todai-ji-daibutsu | Great Buddha of Nara | 奈良の大仏 | ならのだいぶつ | the Great Buddha in Todai-ji's hall | meadow |
| 4 | II Shore | itsukushima-torii | Itsukushima torii | 厳島神社の大鳥居 | いつくしまじんじゃのおおとりい | the floating torii | water |
| 5 | | himeji-castle | Himeji Castle | 姫路城 | ひめじじょう | the castle keep | meadow |
| 6 | | kiyomizu-dera | Kiyomizu-dera | 清水寺 | きよみずでら | the temple and its wooden stage | meadow |
| 7 | | meoto-iwa | Meoto Iwa | 夫婦岩 | めおといわ | the wedded rocks | water |
| 8 | | enoshima-lighthouse | Enoshima Sea Candle | 江の島シーキャンドル | えのしましーきゃんどる | the lighthouse | water |
| 9 | III Snow | shirakawa-go | Shirakawa-go | 白川郷 | しらかわごう | gassho houses | snow |
| 10 | | matsumoto-castle | Matsumoto Castle | 松本城 | まつもとじょう | the castle keep | meadow |
| 11 | | hirosaki-castle | Hirosaki Castle | 弘前城 | ひろさきじょう | the castle keep | snow |
| 12 | | zao-juhyo | Zao snow monsters | 蔵王の樹氷 | ざおうのじゅひょう | rime-frosted trees | snow |
| 13 | | kenroku-en | Kenroku-en | 兼六園 | けんろくえん | the garden in winter ropes | snow |
| 14 | IV Mountain | mount-fuji | Mount Fuji | 富士山 | ふじさん | the mountain | mountain |
| 15 | | nikko-toshogu | Nikko Toshogu | 日光東照宮 | にっこうとうしょうぐう | the shrine | mountain |
| 16 | | kegon-falls | Kegon Falls | 華厳の滝 | けごんのたき | the waterfall | mountain |
| 17 | | kappa-bashi | Kappa-bashi, Kamikochi | 上高地の河童橋 | かみこうちのかっぱばし | the suspension bridge | mountain |
| 18 | | tateyama-kurobe | Yuki-no-Otani | 雪の大谷 | ゆきのおおたに | the Tateyama Kurobe snow corridor | mountain |
| 19 | | koyasan-okunoin | Koyasan Okunoin | 高野山奥之院 | こうやさんおくのいん | the cemetery | mountain |
| 20 | | yoshino-yama | Yoshino-yama | 吉野山 | よしのやま | cherry slopes | meadow |
| 21 | V Marsh | kushiro-shitsugen | Kushiro Wetland | 釧路湿原 | くしろしつげん | the wetland and its cranes | marsh |
| 22 | | oze | Oze | 尾瀬 | おぜ | boardwalks | marsh |
| 23 | | ouchi-juku | Ouchi-juku | 大内宿 | おおうちじゅく | thatched post town | marsh |
| 24 | | yanagawa | Yanagawa river cruise | 柳川の川下り | やながわのかわくだり | canals and boats | marsh |
| 25 | | kawagoe | Kawagoe bell tower | 川越の時の鐘 | かわごえのときのかね | the Toki no Kane bell tower | meadow |
| 26 | | kurashiki-bikan | Kurashiki Bikan Historical Quarter | 倉敷美観地区 | くらしきびかんちく | canal quarter | marsh |
| 27 | VI Forest | jomon-sugi | Jomon Sugi | 縄文杉 | じょうもんすぎ | the ancient cedar | forest |
| 28 | | shiratani-unsuikyo | Shiratani Unsuikyo | 白谷雲水峡 | しらたにうんすいきょう | moss forest | forest |
| 29 | | arashiyama | Arashiyama bamboo grove | 嵐山の竹林 | あらしやまのちくりん | bamboo grove | forest |
| 30 | | nachi-falls | Nachi Falls | 那智の滝 | なちのたき | the falls and pagoda | forest |
| 31 | | meiji-jingu | Meiji Jingu | 明治神宮 | めいじじんぐう | the forest gate | forest |
| 32 | | ise-jingu | Ise Jingu | 伊勢神宮 | いせじんぐう | the shrine | forest |
| 33 | | nikko-cedars | Nikko cedar avenue | 日光杉並木 | にっこうすぎなみき | cedar avenue | forest |
| 34 | VII Volcanic | sakurajima | Sakurajima | 桜島 | さくらじま | the volcano | volcanic |
| 35 | | mount-aso | Mount Aso | 阿蘇山 | あそさん | the caldera | volcanic |
| 36 | | beppu-hells | Beppu hells | 別府地獄めぐり | べっぷじごくめぐり | the hot-spring hells | volcanic |
| 37 | | owakudani | Owakudani | 大涌谷 | おおわくだに | the steaming volcanic valley | volcanic |
| 38 | | jigokudani | Noboribetsu Jigokudani | 登別地獄谷 | のぼりべつじごくだに | hell valley | volcanic |
| 39 | | unzen | Unzen hells | 雲仙地獄 | うんぜんじごく | the hot-spring hells | volcanic |
| 40 | VIII Open sea | gunkanjima | Battleship Island | 軍艦島 | ぐんかんじま | Hashima's abandoned buildings | sea |
| 41 | | ogasawara | Ogasawara | 小笠原 | おがさわら | the islands | sea |
| 42 | | naruto | Naruto whirlpools | 鳴門の渦潮 | なるとのうずしお | the whirlpools | sea |
| 43 | | shuri-castle | Shuri Castle | 首里城 | しゅりじょう | the castle | sea |
| 44 | | yonaguni | Yonaguni Monument | 与那国島海底遺跡 | よなぐにじまかいていいせき | the underwater terraces | sea |
| 45 | | okinoshima | Okinoshima | 沖ノ島 | おきのしま | the island | sea |
| 46 | IX Far north | shiretoko | Shiretoko | 知床 | しれとこ | the peninsula | snow |
| 47 | | otaru-canal | Otaru Canal | 小樽運河 | おたるうんが | the canal | snow |
| 48 | | goryokaku | Goryokaku | 五稜郭 | ごりょうかく | the star fort | snow |
| 49 | | asahiyama | Asahiyama Zoo | 旭山動物園 | あさひやまどうぶつえん | the zoo | snow |
| 50 | | sapporo-tv-tower | Sapporo TV Tower | さっぽろテレビ塔 | さっぽろてれびとう | the tower | snow |

## Open questions

- Acts V to IX each need a biome with its own palette, props and traversal rule, and the matching ability; these should be designed together.
- The names are in `src/app/i18n/` (`landmarkNames`, English and Japanese, all fifty, from the table above; used as the images' alt text). On screen they are the pre-rendered brush images in `public/images/landmark-names/` (made by `scripts/landmark-names.py`): at the end of a landmark's restoration, 1.3 s into its 5.5 s pause, the Japanese name is overlaid vertically in the middle of the screen and, in English, the translation below it; they fade out as the camera returns. A line of text for each landmark is still to do.
- Haiku are linked to the landmark they are about by `landmark` in `content/haiku-scenery.json` (nine so far, from Bashō; the poems are in `content/source/landmark-haiku.json`). The link reaches the text index but does not yet change placement: placing a linked monument near its landmark is still to do.
