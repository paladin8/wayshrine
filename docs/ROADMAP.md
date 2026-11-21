# Roadmap

## Done
- Blender reference diorama and animations.
- Project scaffold, layered structure, architecture test.
- World core: seeded RNG and noise, regions, biomes, progression spine, no-soft-lock property tests (region level and tile level).
- Game state: restore, capabilities, save format, player movement.
- **Settings and language:** settings dialog (music and sound-effects volume, mute, minimap and compass toggles), English and Japanese, persisted.
- **Music:** audio layer with crossfading player, first track in all biomes, volume/mute controls.
- **Guidance:** compass to the nearest reachable unrestored shrine, exploration tracking, corner map and expanded map (M), debug reset tools.
- **Scenery:** biome-specific props with clustering, lantern rings at shrines, shared dead-to-alive colour system.
- **Awakening swell:** one-shot cue player, music ducking under it, background music halved.
- **Restoration moment and ambient life:** radial vitality wave from the shrine, camera zooms out to frame the whole region, hold once fully energised, zoom back (E skips). Foliage sway, water ripple, fireflies, petals, snow and shrine sparks scale with vitality.
- **Vertical slice:** streamed tile terrain per biome, WASD player gated by capabilities, shrines that go from dead to alive (animated vitality), HUD, localStorage saves, `?debug` hooks.

## Next
1. Activation and burst sound effects for the awakening; biome edge shapes.
2. Unlock feedback: capability pickup moment, boat/snowshoes/climbing visuals on the player.
3. Advanced-civilisation layer: ruins and structures that appear in restored regions and change generation (see DESIGN).
4. Tile placing: decide whether it earns a place.

## Known gaps
- Off-spine regions differ only by biome; no landmarks or points of interest yet.
- One music track for every biome; no sound effects. Touch input not supported.
- Chunk meshes build on the main thread (2 per frame); move to a worker if hitching appears.
