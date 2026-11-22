# 0007: Later biomes, abilities and the outer mix
Status: accepted. Extends [0006](0006-landmarks-and-progression.md).

**Context.** The landmark list grew to 66 in nine acts ([landmarks.md](../landmarks.md)). Acts V to IX need terrain that did not exist: marsh, dark forest, volcanic ground and open sea, plus a one-off sand biome for Tottori. They also need the abilities that open them. Ambient biomes are picked independently per region, and the planner only places a landmark where the player can already walk (ADR 0006), so the mix of biomes decides whether the later acts can be placed at all.

**Decision.**
- **Biomes and abilities.** Each biome needs one ability, held when its act begins (the ability is unlocked by the end of the act before).

| Biome | Needs | At | First act | Rule |
| --- | --- | --- | --- | --- |
| marsh | geta | 20 | V | low, wet ground; props are reeds and bushes |
| forest | lantern | 30 | VI | the dark forest: dense trees |
| volcanic | ash sandals | 41 | VII | basalt and ash, rock and crags |
| sea | ship | 49 | VIII | like water, deeper; a shrine stands on an islet |
| dunes | nothing | | VIII | sand; only ever a landmark's own region (Tottori) |

- **Far sight.** At 56 restored landmarks (the end of act VIII) every unrestored landmark is marked on the map. It opens no terrain, so the planner is unaffected. Travel from the expanded map to restored shrines already exists and is not gated.
- **Outer mix.** Near the start the biome weights are unchanged (meadow 40%, water, snow and mountain 20% each). From 14 regions out the later biomes fade in over 3 regions, up to 45% of regions (marsh 33%, forest 27%, volcanic and sea 20% of that share), the original four scaling down to match. So acts I to IV are placed as before and the later acts have somewhere to go.
- **Search window.** The planner and the compass search 28 regions (Chebyshev) around the start; the 66th landmark sits about 17 regions out (see [0008](0008-clustered-biomes-and-closer-landmarks.md); the window leaves room for detours).

**Evidence.** A simulation over 200 seeds measured, per act, the regions of its ring band that can be walked to with the abilities held when it begins:
- With the new biomes at fixed global weights, 1% of the act I band and 3% of act II were reachable (5% and 38% to 43% before). The planner would have had to put landmarks next to wherever the reachable cluster happened to end.
- With the outer mix, act I to III were as before and every later act had at least 144 reachable regions in its band at the 10th percentile, against at most 11 landmarks.

**Consequences.**
- Regions more than 14 regions from the start get different biomes than in earlier builds. Landmarks are matched in saves by id, and places that far out are rarely visited; shrines restored there keep their region ids.
- Creating a world takes about 150 ms (the planner floods a 57 by 57 grid for each candidate), and the property tests over 300 seeds take several minutes.
- Each later biome needs its own look and props. The first pass reuses existing meshes and palette colours; per-biome props and ability visuals are still to do.
