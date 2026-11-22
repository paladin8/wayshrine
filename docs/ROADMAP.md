# Roadmap

## Done
- Blender reference diorama and animations.
- Project scaffold, layered structure, architecture test.
- World core: seeded RNG and noise, regions, biomes, landmark progression, no-soft-lock property tests (region level and tile level).
- Game state: restore, capabilities, save format, player movement.
- **Monuments and rubbings:** 1,009 Japanese texts on standing stones, spread 0 to 2 per region; worn until the region is restored; a glimmer when one is on screen; reading collects it into a book (B). Haiku match their region's biome. See ADR 0005.
- **Settings and language:** settings dialog (music and sound-effects volume, mute, minimap and compass toggles), English and Japanese, persisted.
- **Music:** audio layer with crossfading player, first track in all biomes, volume/mute controls.
- **Landmarks (structure):** 66 landmarks in nine acts placed in outward ring bands; abilities unlock at 3, 8, 13, 20, 30, 41 and 49 restored landmarks instead of at shrines, and far sight at 56; marsh, dark forest, volcanic, sea and dune biomes fade in beyond 14 regions; wide plateau and solid placeholder model per landmark; compass points at the next reachable landmark. See ADRs 0006 and 0007 and `docs/landmarks.md`.
- **Guidance:** compass to the nearest reachable unrestored shrine or landmark, landmark reveals earned at seven rubbings per star, reduced by restored landmarks, in order of distance from the start, exploration tracking, corner map and expanded map (M), and debug reset tools.
- **Scenery:** biome-specific props with clustering, lantern rings at shrines, shared dead-to-alive colour system.
- **Awakening swell:** one-shot cue player, music ducking under it, background music halved.
- **Restoration moment and ambient life:** radial vitality wave from the shrine, camera zooms out to frame the whole region, hold once fully energised, zoom back (E skips). Foliage sway, water ripple, fireflies, petals, snow and shrine sparks scale with vitality.
- **Vertical slice:** streamed tile terrain per biome, WASD player gated by capabilities, shrines that go from dead to alive (animated vitality), HUD, localStorage saves, `?debug` hooks.

## Next
0. Landmarks: screen-edge glow and compass guidance for revealed landmarks, skyline peek for tall landmarks, real looks, props and player visuals for the later biomes and abilities (placeholders now), more landmark models.
1. Real scenery for the haiku (ponds, bridges, fields) from the tags in `content/haiku-scenery.json`; tie the book to technological advancement; biome edge shapes.
2. Unlock feedback: capability pickup moment, boat/snowshoes/climbing visuals on the player.
3. Advanced-civilisation layer: ruins and structures that appear in restored regions and change generation (see DESIGN).
4. Tile placing: decide whether it earns a place.

## Known gaps
- Landmarks use one placeholder model; ordinary regions differ only by biome.
- One music track for every biome. Touch input not supported.
- Chunk meshes build on the main thread (2 per frame); move to a worker if hitching appears.
