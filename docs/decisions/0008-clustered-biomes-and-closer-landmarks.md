# 0008: Clustered biomes and closer landmarks
Status: accepted. Refines [0006](0006-landmarks-and-progression.md) and [0007](0007-later-biomes-and-abilities.md).

**Context.** Ambient biomes were drawn independently per region, so the map looked like a checkerboard: no terrain ever read as a wall that says "not yet". And landmarks, at radii 20% inside the first spread layout, still felt far to find.

**Decision.**
- **Clusters.** Regions belong to the nearest of a jittered grid of cluster sites (one per 3 by 3 regions), and a cluster takes one biome, drawn with the usual weights at the site's distance from the start. One region in ten ignores its cluster and draws its own, which keeps the edges ragged. Patches are a few regions wide, and a patch of water, snow or mountain is a wall until the matching ability arrives. The start stays meadow within `HOME_RADIUS`. The outer mix of [0007](0007-later-biomes-and-abilities.md) is keyed on the cluster site, so the later biomes appear from about 11 regions out.
- **Landmark patches.** Every landmark can grow its biome along shared edges up to three regions from its center. The outer mix controls ambient biomes. Landmark patches can grow inside that boundary wherever they preserve the starting meadow and routes needed for progression.
- **Closer landmarks.** The ring radii shrink by another 20% (layout `close`: start 3.2 regions, 9.2 regions of area per landmark, so the 66th landmark sits about 17 regions out instead of 21). `spread` (the first layout) and `compact` (the previous default) stay for reproducing old worlds.

**Evidence.** `src/world/exploration.sim.test.ts` (run with `SIM=1`) walks a player at random: straight for six regions, then a new random heading, or sooner when blocked, restoring whatever landmark comes within three quarters of a region. Over 40 seeds, regions walked per landmark found (the median, since a few long wanders drag the mean up):

| landmarks found | `compact` | `close` |
| --- | --- | --- |
| 1 to 3 | 43 | 23 |
| 4 to 8 | 93 | 62 |
| 9 to 13 | 80 | 36 |
| 14 to 20 | 54 | 26 |
| 21 to 30 | 62 | 26 |
| 31 to 40 | 48 | 37 |

Distinct regions seen (shrines passed) between landmarks go from 22 to 52 to 14 to 36 at the median. A 20% cut in radius cuts the search time by a quarter to more than half, since the area to cover scales with the square.

**Consequences.**
- A random walker is a pessimistic model: a real player has the compass, rubbing-earned stars and eyes. Landmarks are denser than the 5 to 10 shrines of [0006](0006-landmarks-and-progression.md) targeted; if that feels wrong, `close` is one table entry to revisit.
- Every region's biome changed, so saves from earlier builds describe a different world. Start a new game.
- Walls lengthen the detours the property tests allow for: the tile-level reachability test now floods once per act with a 640-tile margin (it used to search per landmark with 256).
- The map shows what blocks the player: biomes in their own colours (not the game's palette), unrestored regions only partly drained of colour, hatching on ground the player cannot cross yet, and in the expanded map a legend naming each biome seen and the gear a blocked one needs. A region also counts as seen once any of its ground is within 28 units of the player.
