# Scenic Railway Plan

Wayshrine's technology thread takes the form of five short rail lines. Each has two stations, an existing landmark at its heart, and a view designed for the window seat. The player discovers the stations through ordinary exploration and restores the shrines that power them. A ride is an optional reward and a chance to see a familiar place from a different angle.

The Mount Fuji line runs in generated worlds. The hand-placed `fuji-rail` seed is also available for comparison. All lines share a small local train and rural Japanese stations. The starting kit is a two-car train, at-grade single platforms, timber waiting shelters, pitched tile roofs, a bench, and warm platform lamps. Fujikyu's wooden stations at Mitsutoge and Higashi-Katsura are useful references. [Fujikyu station guide](https://www.fujikyu-railway.jp/en/stroll-map/)

## Station discovery and restoration

1. Spot a platform roof, signal, or stretch of track while exploring. The station and track are visible while dormant, so the player can recognize them on a return visit.
2. Restore the nearby shrine. The usual restoration wave brings the platform, its lights, and the local stretch of track back to life. Each station has its own nearby shrine.
3. Restore the regions the track crosses, both station shrines, and the landmark in any order. Once the entire route has power, the signals show that the train is running. Board from either platform when ready.
4. Watch the landscape from the seat, then step onto the destination platform and resume normal exploration. A glimpse of a bridge, path, or courtyard can suggest somewhere to investigate after arrival.

Both ends are reachable with the gear the player has when they reach Mount Fuji. Service depends on the set of regions touched by the track bed, the station regions, and the defining landmark. Landmark restoration continues to unlock gear. Rubbings keep their role in reading and map discovery. Use the same station interaction on all five lines so the player knows what to look for after the first ride.

## Proposed lines and window views

| Landmark | Window view |
| --- | --- |
| **Enoshima Sea Candle** | An Enoden-inspired local train slips between houses, then the shore opens and the restored lighthouse comes into view across the water. Introduces the station routine in the Shore act. [Enoshima Electric Railway](https://enoden.co.jp/en/) |
| **Mount Fuji** | Villages and riverside trees give way to open paddies and a long view of Fuji. Cherry branches frame the mountain on the approach to the far village. |
| **Tokyo Tower** | A local train approaches from the outskirts. The tower appears between rooftops before the whole skyline opens above a small shrine courtyard. |
| **Naruto whirlpools** | Girders flick past on a bridge crossing. The window looks down long enough to see a whirlpool form in the strait. |
| **Ginzan Onsen** | A slow winter train rounds a wooded bend. Warm inn windows and lamps come into view one by one along the river. |

The five anchors come from the [existing landmark roster](landmarks.md).

## Map placement and window scenery

The Mount Fuji line reserves five regions around the seed's existing landmark. The two outer regions hold at-grade platforms and ordinary shrines. The track passes through the two inner approaches and skirts the landmark in the middle.

Each route has an authored 3D scene for the window. Its camera follows the ride's progress in either direction. This gives the ride its own length, sightlines, and scenery. Boarding and arrival take place on the actual platforms.

### Seeded placement

1. Try seed-specific bearings and offsets around Fuji. Trace two regions in each direction and check that the full track bed touches exactly those five regions. Both platforms fit inside their station regions, and the route clears the surrounding shrines and landmark footprints.
2. Prefer open meadow and mountain terrain and look for stations on dry ground first. Check all five regions against the traversal gear available in Fuji's act. A difficult coastline seed can use a short rail bridge or a walkable bank under its waterside station, accessible by boat. If the search cannot fit a safe corridor, that world has no Fuji line.
3. Reserve and grade the corridor before placing props and monuments. The land around the track blends back into each region's own terrain. This keeps the seed's existing regional biomes, shrines, and landmarks in place. [Seed determinism](decisions/0002-seed-plus-discoveries.md) · [Progression and reachability](decisions/0006-landmarks-and-progression.md)

## Mount Fuji ride

Run `npm run dev` and open `/?debug`. Choose **Preview Mount Fuji ride** to try the roughly 44-second sequence. The preview returns you to your starting point. In normal play, restore the five crossed regions, including Fuji and the two station shrines. Press **E** at either station to ride to the other platform. **E**, **Esc**, or **Skip ride** ends the sequence.

The ride leaves a village, crosses a wooded river, eases through an open paddy valley with Fuji in view, and passes a trackside cherry grove before arriving at the next village. The blossom section takes its cue from Kotobuki, where the local tourism guide describes seeing the flowers and Fuji together through the train window. Fujikyu highlights the Katsura River and the gradual reveal. One rider describes the mountain appearing and disappearing as the line turns, and another recalls the train slowing around a viewing spot. [Kotobuki Station](https://en.fujiyoshida.net/spot/index.php?p=60) · [Fujikyu viewpoints](https://www.fujikyu-railway.jp/en/fujisan-view-express/view-spot/) · [Family ride account](https://note.com/kopanda_mama/n/nee406e1aa155?hl=en) · [Fujisan View Express ride account](https://plaza.rakuten.co.jp/thanarail/diary/201801210001/)

The scene uses the `fuji_mountain` node from the landmark GLB as its distant backdrop. [Train window scene](../src/render/fuji-vista.ts) · [Countryside models](../src/render/fuji-countryside.ts)
