# Roadmap

## Done
- Blender reference diorama and animations.
- Project scaffold, layered structure, architecture test.
- World core: seeded RNG and noise, regions, biomes, progression spine, no-soft-lock property tests (region level and tile level).
- Game state: restore, capabilities, save format, player movement.
- **Guidance:** compass to the nearest reachable unrestored shrine, exploration tracking, corner map and expanded map (M), debug reset tools.
- **Scenery:** biome-specific props with clustering, lantern rings at shrines, shared dead-to-alive colour system.
- **Vertical slice:** streamed tile terrain per biome, WASD player gated by capabilities, shrines that go from dead to alive (animated vitality), HUD, localStorage saves, `?debug` hooks.

## Next
1. Ambient life that scales with vitality: swaying foliage, drifting blossom, water surface motion, biome edge shapes.
2. Unlock feedback: capability pickup moment, boat/snowshoes/climbing visuals on the player.
3. Advanced-civilisation layer: ruins and structures that appear in restored regions and change generation (see DESIGN).
4. Tile placing: decide whether it earns a place.

## Known gaps
- Off-spine regions differ only by biome; no landmarks or points of interest yet.
- No audio. Touch input not supported.
- Chunk meshes build on the main thread (2 per frame); move to a worker if hitching appears.
