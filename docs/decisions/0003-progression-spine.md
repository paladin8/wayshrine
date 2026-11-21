# 0003: Lock-and-key progression spine
Status: accepted

**Context.** Capabilities (boat, snowshoes, climbing) gate terrain. A random map could strand the player.

**Decision.** Generate a coarse spine of 4-adjacent regions: keystone meadow (grants capability N), barrier biome (requires N), next keystone beyond, and so on. Start region is the first keystone. Enforced by construction on the region graph and checked by a greedy-player property test over 300 seeds: every capability is obtainable with only earlier ones, and an unrestored shrine is always reachable.

**Consequences.** Never stuck, by construction. Limitation: gates are soft, because random off-spine regions may offer bypasses, so a determined player can sometimes skip ahead. Acceptable: the invariant is no dead end, not strict order. Changes to spine, terrain rules or traversal must keep the property tests green.
