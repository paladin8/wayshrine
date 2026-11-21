# Roadmap

## Done
- Blender reference diorama and animations.
- Project scaffold, layered structure, architecture test.
- World core: seeded RNG and noise, regions, biomes, progression spine, no-soft-lock property tests (region level and tile level).
- Game state: restore, capabilities, save format, player movement.
- **Vertical slice:** streamed tile terrain per biome, WASD player gated by capabilities, shrines that go from dead to alive (animated vitality), HUD, localStorage saves, `?debug` hooks.

## Next
1. Make regions feel distinct: scatter props (trees, rocks, lanterns), biome edge shapes, water surface animation, ambient life that scales with vitality.
2. Unlock feedback: capability pickup moment, boat/snowshoes/climbing visuals on the player.
3. Map/compass: show discovered shrines and the direction of the nearest unrestored one.
4. Advanced-civilisation layer: ruins and structures that appear in restored regions and change generation (see DESIGN).
5. Tile placing: decide whether it earns a place.

## Known gaps
- Off-spine regions are plain biome fill with no unique content.
- No audio. Touch input not supported.
- Chunk meshes build on the main thread (2 per frame); move to a worker if hitching appears.
