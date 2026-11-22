# 0006: Landmarks gate abilities
Status: accepted. Supersedes [0003](0003-progression-spine.md).

**Context.** The spine made every shrine on a short path a lock or a key, which does not scale to a world with fifty hand-crafted landmarks, and made progress feel like a chain in one direction. Landmarks are authored; shrines are plentiful.

**Decision.**
- Abilities unlock at **counts of restored landmarks** (boat 3, snowshoes 8, climbing 13). Ordinary shrines restore a region. Restored landmarks always have red minimap stars. With N restored ordinary shrines and M restored landmarks, the map shows up to `max(0, floor(N / 5) - M)` gold stars for unrestored landmarks.
- Landmarks are placed in **acts**, each a ring band whose radius follows the target density (about fourteen regions of area per landmark over the full disc), on a per-act bearing rotated by seed, so growth is radial from the start rather than a chain. The world remains infinite; regions beyond the landmarks are generic.
- Landmarks are not gated by order. A landmark region has a fixed biome, and the planner only chooses regions the player can already walk to with the abilities held when the act begins, and rejects a placement that would cut off an earlier landmark.
- A landmark **is** its region's shrine: it stands at the site, with no torii or lanterns, and is restored by walking up to it like any shrine.
- The start region and everything within `HOME_RADIUS` regions of it are meadow.
- The compass points at the nearest reachable unrestored shrine or landmark.

**Consequences.** Never stuck, by construction: the next landmark is always reachable with the abilities already held, checked by a greedy-player property test over 300 seeds (landmark at region level, and at tile level for sample seeds). Gates are still soft, because random regions may offer bypasses; the invariant is no dead end, not strict order. Placement and unlocks live in `world/landmarks.ts`; changes there, to terrain rules or to traversal must keep those tests green. Save format v4 stores revealed landmark IDs. Loading older saves moves restored landmarks to their new regions by landmark ID and preserves reveal credit for any ordinary shrines replaced by a landmark.
