# Landmarks

Landmarks are hand-crafted places emblematic of Japan, one per special region, built as models rather than generated. Restoring them (not shrines) unlocks abilities. See [ADR 0006](decisions/0006-landmarks-and-progression.md) for the mechanics.

Sixty-six are planned, in nine **acts**. An act is a band: its landmarks sit in a ring farther from the start than the act before, on a bearing that is rotated per seed, so the world grows outward in a spiral rather than along a chain. Geography is loose: an act's biome is the main constraint, and real-world location only decides order within it.

Status: all 66 are in the code, with their biomes and the abilities they unlock ([ADR 0007](decisions/0007-later-biomes-and-abilities.md)). Models exist for twenty-one; the rest use the placeholder. The looks of the later biomes are still placeholders too. ## Models

A landmark's model is `public/models/landmarks/<id>.glb` (binary glTF, Y up, one unit = one world unit), centred on the region's site and sitting on its flat plateau. Without a file, the landmark shows a plain placeholder. Conventions the loader relies on:

- Author it alive; the dead look is derived per material (as for scenery), so keep one material per colour and name them.
- Parts named `glow_*` (or using a `glow_*` material) light up and flare as the region wakes.
- **Ground.** The terrain under the footprint follows the model's own ground (a heightfield, below), 0.2 lower so the model's grass sits clear of it, and eases from the footprint edge to natural height over 8 units (`LANDMARK_BLEND`). The eased slope is drawn as a smooth surface (a "skirt": per-corner heights, `Terrain.corners`) rather than flat-topped tiles, and the player and props follow it via `Terrain.groundAt`. So the model may have a real hill, but it must come back down inside the footprint: the outer ring of `ground` is exactly 0 (the base height) on every side, so the blend starts from one level, and there are no holes. Prefer `terrainSurface` (no ground mesh of the model's own, the game draws the grass at plateau height) unless the model needs its own landform; keep any water fully inside the footprint behind a land rim, never meeting the open sea at the edge. The exception is a model in a water region that ends in open water: its outer ring is instead exactly the region's water level (`landmarkWaterLevel`, -0.6 for `water`), and wherever its ground is at that level the game draws the region's own water, which the boat sails, so the island slots into the sea (Enoshima). Such a model draws its own sea just below that level, to fill shore tiles the game keeps as land, and needs a landing the boat can reach. Footprints come in three sizes, set by `half` in the sidecar: 9.6 (about 19.2 across) for a single building or feature, the default; 11.2 for a compound, precinct, village, garden or scene with a backdrop (Fushimi Inari, Itsukushima, Himeji Castle, Kiyomizu-dera, Horyu-ji, Hirosaki Castle, Shirakawa-go, Matsumoto Castle, Kenroku-en, Nikko Toshogu, Kegon Falls, Kappa-bashi, Koyasan Okunoin, Yoshino-yama); and larger only for the truly huge (Mount Fuji, 16.8). A model needs a reason to go up a size: fit a backdrop to the footprint rather than growing the footprint for it. The hard limit is `MAX_FOOTPRINT_HALF` (24), which is headroom, not a target: a landmark stands at its cell's centre and its region claims the footprint plus its slope, so the slope never meets another region's ground. Monuments keep clear.
- **Sidecar.** The generator also writes `src/world/landmark-grounds/<id>.json` (register it in `src/world/landmark-ground.ts`): `half`, `step`, `ground` (walkable surface height on a grid, indexed [z][x], game axes: x = Blender x, z = -Blender y), `solids` (discs [x, z, r] for everything the player must not walk through), `interact` (the compass target), the authored `reach` value, and `stand` (where map travel arrives). `content/landmarks/fushimi-inari.py` is the reference. `src/world/landmark-ground.test.ts` fails if the outer ring isn't 0 or if `ground` has zero-height holes.
- **Walkable surfaces.** Anything the player climbs (steps, platforms, bridges) is not terrain: register it in the generator as a floor, `(x0, x1, y0, y1, top)`, so the ground grid includes it, and keep solids to what stands above the floor (the generator takes geometry in a band 0.35 to 1.6 above the local ground; up-facing hill triangles are ignored). Leave a clear arrival spot at `stand`. Landmarks can be activated anywhere on their footprint and up to 3.5 units beyond each edge.
- Without a sidecar, the landmark gets a flat plateau and one solid disc.

Done: fushimi-inari, kinkaku-ji, todai-ji-daibutsu, itsukushima-torii, himeji-castle, kiyomizu-dera, meoto-iwa, enoshima-lighthouse, horyu-ji, hirosaki-castle, shirakawa-go, matsumoto-castle, zao-juhyo, kenroku-en, mount-fuji, nikko-toshogu, kegon-falls, kappa-bashi, tateyama-kurobe, koyasan-okunoin, yoshino-yama. Everything else uses the placeholder.

## Abilities

| Ability | Unlocked at | Opens | Status |
| --- | --- | --- | --- |
| Boat | 3 landmarks | water | in code |
| Snowshoes | 8 | snow | in code |
| Climbing gear | 13 | mountain | in code |
| Geta | 20 | marsh | in code |
| Lantern | 30 | dark forest | in code |
| Ash sandals | 41 | volcanic ground | in code |
| Ship | 49 | open sea | in code |
| Far sight | 56 | nothing: marks every remaining landmark on the map | in code |

Each threshold sits at the end of an act, so an act's landmarks never need the ability they unlock. The HUD shows every threshold in stars. Far sight opens no terrain, so it never constrains placement.

## The list

Names, in English and Japanese, are what people commonly call each place (they are the display names for `src/app/i18n/`), which is not always the formal name: 金閣寺 rather than 鹿苑寺, 奈良の大仏 rather than 東大寺盧舎那仏, 軍艦島 rather than 端島, 雪の大谷 rather than the whole 立山黒部アルペンルート. Readings are in hiragana. *What to model* is the subject of the diorama.

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
| 14 | IV Mountain | mount-fuji | Mount Fuji | 富士山 | ふじさん | the mountain, seen past the Chureito pagoda | mountain |
| 15 | | nikko-toshogu | Nikko Toshogu | 日光東照宮 | にっこうとうしょうぐう | the shrine | mountain |
| 16 | | kegon-falls | Kegon Falls | 華厳の滝 | けごんのたき | the waterfall | mountain |
| 17 | | kappa-bashi | Kappa-bashi, Kamikochi | 上高地の河童橋 | かみこうちのかっぱばし | the suspension bridge | mountain |
| 18 | | tateyama-kurobe | Yuki-no-Otani | 雪の大谷 | ゆきのおおたに | the Tateyama Kurobe snow corridor | mountain |
| 19 | | koyasan-okunoin | Koyasan Okunoin | 高野山奥之院 | こうやさんおくのいん | the cemetery | mountain |
| 20 | | yoshino-yama | Yoshino-yama | 吉野山 | よしのやま | cherry slopes | meadow |
| 21 | V Marsh | kushiro-shitsugen | Kushiro Wetland | 釧路湿原 | くしろしつげん | the wetland and its cranes | marsh |
| 22 | | oze | Oze | 尾瀬 | おぜ | boardwalks across the marsh | marsh |
| 23 | | yanagawa | Yanagawa river cruise | 柳川の川下り | やながわのかわくだり | canals and punt boats | marsh |
| 24 | | kurashiki-bikan | Kurashiki Bikan Historical Quarter | 倉敷美観地区 | くらしきびかんちく | willow-lined canal and white storehouses | marsh |
| 25 | | byodo-in | Byodo-in | 平等院 | びょうどういん | the Phoenix Hall over its pond | water |
| 26 | | senso-ji | Senso-ji | 浅草寺 | せんそうじ | the Kaminarimon lantern gate and pagoda | meadow |
| 27 | | kamakura-daibutsu | Great Buddha of Kamakura | 鎌倉の大仏 | かまくらのだいぶつ | the bronze Buddha sitting in the open | meadow |
| 28 | | tokyo-tower | Tokyo Tower | 東京タワー | とうきょうたわー | the red-and-white lattice tower | meadow |
| 29 | | osaka-castle | Osaka Castle | 大阪城 | おおさかじょう | the keep on its stone walls and moat | meadow |
| 30 | | horyu-ji | Horyu-ji | 法隆寺 | ほうりゅうじ | the oldest wooden pagoda and Golden Hall | meadow |
| 31 | VI Forest | jomon-sugi | Jomon Sugi | 縄文杉 | じょうもんすぎ | the ancient cedar | forest |
| 32 | | shiratani-unsuikyo | Shiratani Unsuikyo | 白谷雲水峡 | しらたにうんすいきょう | moss forest | forest |
| 33 | | arashiyama | Arashiyama bamboo grove | 嵐山の竹林 | あらしやまのちくりん | bamboo grove path | forest |
| 34 | | nachi-falls | Nachi Falls | 那智の滝 | なちのたき | the falls with the vermilion pagoda | forest |
| 35 | | meiji-jingu | Meiji Jingu | 明治神宮 | めいじじんぐう | the great torii in the forest | forest |
| 36 | | ise-jingu | Ise Jingu | 伊勢神宮 | いせじんぐう | plain cypress shrine in cedar forest | forest |
| 37 | | izumo-taisha | Izumo Taisha | 出雲大社 | いずもたいしゃ | the hall and its giant rope | forest |
| 38 | | takachiho | Takachiho Gorge | 高千穂峡 | たかちほきょう | basalt gorge, waterfall and rowboats | forest |
| 39 | | iya-kazurabashi | Iya vine bridge | 祖谷のかずら橋 | いやのかずらばし | the vine bridge over the gorge | forest |
| 40 | | ginkaku-ji | Ginkaku-ji | 銀閣寺 | ぎんかくじ | the Silver Pavilion and sand garden | meadow |
| 41 | | ryoan-ji | Ryoan-ji | 龍安寺 | りょうあんじ | the rock garden | meadow |
| 42 | VII Volcanic | sakurajima | Sakurajima | 桜島 | さくらじま | the smoking volcano across the bay | volcanic |
| 43 | | mount-aso | Mount Aso | 阿蘇山 | あそさん | the caldera | volcanic |
| 44 | | beppu-hells | Beppu hells | 別府地獄めぐり | べっぷじごくめぐり | the hot-spring hells | volcanic |
| 45 | | owakudani | Owakudani | 大涌谷 | おおわくだに | the steaming volcanic valley | volcanic |
| 46 | | kumamoto-castle | Kumamoto Castle | 熊本城 | くまもとじょう | the black keep on curved stone walls | meadow |
| 47 | | dazaifu | Dazaifu Tenmangu | 太宰府天満宮 | だざいふてんまんぐう | the shrine, drum bridge and plum trees | meadow |
| 48 | | dogo-onsen | Dogo Onsen | 道後温泉 | どうごおんせん | the wooden bathhouse | meadow |
| 49 | | kintaikyo | Kintaikyo Bridge | 錦帯橋 | きんたいきょう | five wooden arches over the river | water |
| 50 | VIII Open sea | gunkanjima | Battleship Island | 軍艦島 | ぐんかんじま | Hashima's abandoned buildings | sea |
| 51 | | naruto | Naruto whirlpools | 鳴門の渦潮 | なるとのうずしお | the whirlpools under the bridge | sea |
| 52 | | shuri-castle | Shuri Castle | 首里城 | しゅりじょう | the red main hall | sea |
| 53 | | taketomi | Taketomi Island | 竹富島 | たけとみじま | red-tiled village, coral walls, ox cart | sea |
| 54 | | matsushima | Matsushima | 松島 | まつしま | pine-covered islets in the bay | sea |
| 55 | | amanohashidate | Amanohashidate | 天橋立 | あまのはしだて | the pine sandbar across the bay | sea |
| 56 | | tottori-dunes | Tottori Sand Dunes | 鳥取砂丘 | とっとりさきゅう | dunes running down to the sea | dunes |
| 57 | IX Far north | shiretoko | Shiretoko | 知床 | しれとこ | the peninsula and its lakes | snow |
| 58 | | otaru-canal | Otaru Canal | 小樽運河 | おたるうんが | the canal, warehouses and gas lamps | snow |
| 59 | | goryokaku | Goryokaku | 五稜郭 | ごりょうかく | the star fort | snow |
| 60 | | blue-pond | Biei Blue Pond | 美瑛の青い池 | びえいのあおいいけ | the pond and its dead larches | snow |
| 61 | | furano | Furano lavender fields | 富良野のラベンダー畑 | ふらののらべんだーばたけ | lavender stripes on the hills | meadow |
| 62 | | ouchi-juku | Ouchi-juku | 大内宿 | おおうちじゅく | thatched post town in snow | snow |
| 63 | | ginzan-onsen | Ginzan Onsen | 銀山温泉 | ぎんざんおんせん | the gas-lit onsen street in snow | snow |
| 64 | | chuson-ji | Chuson-ji | 中尊寺 | ちゅうそんじ | the Golden Hall | snow |
| 65 | | yamadera | Yamadera | 山寺 | やまでら | halls on the cliff above the steps | snow |
| 66 | | snow-monkeys | Jigokudani snow monkeys | 地獄谷野猿公苑 | じごくだにやえんこうえん | monkeys in the hot spring | snow |

## Chosen and left out

The aim is the places most Japanese people would name, plus a few that make distinctive dioramas, without regard to biome balance. Acts I to IV are fixed by the code (ids are in saves); Enoshima Sea Candle is the weakest of them, and the Great Buddha of Kamakura would replace it well if those acts are revisited. Mount Fuji is meant to be modelled with the Chureito pagoda, the most familiar view of it.

Left out on purpose:

- The Hiroshima Peace Memorial (原爆ドーム). Among the most famous sites in Japan, but it is kept as a ruin on purpose, and restoring it to life would misread it.
- Duplicates of an idea already in the list: Unzen and Noboribetsu Jigokudani (two more hot-spring hells), the Nikko cedar avenue (a third Nikko entry), Motonosumi Inari (another torii run), Tsumago and Magome (another post town), Hakone Shrine's lake torii (another water torii).
- Places few people could picture: Okinoshima (closed to visitors), the Yonaguni Monument (underwater), the Ogasawara islands.
- Lesser-known picks: Kawagoe bell tower, Asahiyama Zoo, Sapporo TV Tower (Tokyo Tower takes its place).
- Naoshima's pumpkin, which is a copyrighted artwork.

## Open questions

- The later biomes (marsh, dark forest, volcanic ground, open sea, dunes) and their abilities exist in the code with placeholder looks: a palette colour, a height profile and existing props. Each still needs its own props and mood (reeds and still water for marsh, a darker light and a lantern glow for forest, steam and ash for volcanic ground, waves for the sea), and each ability needs a visual on the player (geta, lantern, ash sandals, ship).
- The names are in `src/app/i18n/` (`landmarkNames`, English and Japanese, all 66, from the table above; used as the images' alt text). On screen they are the pre-rendered brush images in `public/images/landmark-names/` (made by `scripts/landmark-names.py`): the vertical Japanese name starts fading in 1.7 s before the restoration wave ends. In English, the translation appears below it. The names stay visible through the 3.5 s pause and fade out as the camera returns. A line of text for each landmark is still to do.
- Haiku are linked to the landmark they are about by `landmark` in `content/haiku-scenery.json` (nine so far, from Bashō; the poems are in `content/source/landmark-haiku.json`). The link reaches the text index and `planMonuments` pins the poem's monument in that landmark's region (clear of the footprint, counting towards the region's two stones), whatever the region's biome. Only a haiku's `landmark` tag decides this; its `biome` tag is then ignored.

## The travel notebook

The landmark counter at the top right opens a travel notebook: a two-page spread with a diary-style entry (`src/content/landmark-notes.json`, English and Japanese, one per landmark) for each restored landmark, two entries to a page, in the order of the list above. Each entry has a "Travel there" button that moves the player to the landmark's stand point (not while a restoration is playing). Left and right arrows turn pages; Esc closes it. With `?debug` every landmark is listed, the unrestored ones grayed out, and travel works for all of them. A pencil sketch beside each entry is left for later.
