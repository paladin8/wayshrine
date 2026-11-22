# Roadmap

## Done
- Blender reference diorama and animations.
- Project scaffold, layered structure, architecture test.
- World core: seeded RNG and noise, regions, biomes, landmark progression, no-soft-lock property tests (region level and tile level).
- Game state: restore, capabilities, save format, player movement.
- **Monuments and rubbings:** 1,009 Japanese texts on standing stones, spread 0 to 2 per region; worn until the region is restored; a glimmer when one is on screen; reading adds a loose sheet to the rubbing box (B). Haiku match their region's biome. See ADR 0005.
- **Settings and language:** settings dialog (music and sound-effects volume, mute, minimap and compass toggles), English and Japanese, persisted.
- **Music:** audio layer with crossfading player, first track in all biomes, volume/mute controls.
- **Landmarks (structure):** 66 landmarks in nine acts placed in outward ring bands; abilities unlock at 3, 8, 13, 20, 30, 41 and 49 restored landmarks instead of at shrines, and far sight at 56; biomes in patches of a few regions, with marsh, dark forest, volcanic and sea fading in beyond about 11 regions; wide plateau and solid placeholder model per landmark; compass points at the next reachable landmark. See ADRs 0006 and 0007 and `docs/landmarks.md`.
- **Guidance:** compass to the nearest reachable unrestored shrine or landmark, landmark reveals earned at seven rubbings per star, reduced by restored landmarks, in order of distance from the start, exploration tracking, corner map and expanded map (M), and debug reset tools.
- **Scenery:** biome-specific props with clustering, lantern rings at shrines, shared dead-to-alive colour system.
- **Awakening swell:** one-shot cue player, music ducking under it, background music halved.
- **Restoration moment and ambient life:** radial vitality wave from the shrine, camera zooms out to frame the whole region, hold once fully energised, zoom back (E skips). Foliage sway, water ripple, fireflies, petals, snow and shrine sparks scale with vitality.
- **Travel journal:** the landmark counter (or J) opens a notebook with a handwritten entry per restored landmark, two to a page, with a button to travel back; cover-opening and page-turn animations and sounds. With `?debug` all landmarks are listed and travel works for all of them. A pencil sketch per entry is still to do.
- **Vertical slice:** streamed tile terrain per biome, WASD player gated by capabilities, shrines that go from dead to alive (animated vitality), HUD, localStorage saves, `?debug` hooks.

## Next
0. Landmarks: screen-edge glow and compass guidance for revealed landmarks, skyline peek for tall landmarks, real looks, props and player visuals for the later biomes and abilities (placeholders now), more landmark models.
1. Real scenery for the haiku (ponds, bridges, fields) from the tags in `content/haiku-scenery.json`; tie the rubbing collection to technological advancement; biome edge shapes.
2. **Ability acquisition.** The boat prototype announces the unlock at three restored landmarks and uses the first boarding to transition between two themes. Extend the reward and first-use pattern to the other abilities. Give each stage a distinct background score and shrine-activation music. See `docs/music.md`.
3. Advanced-civilisation layer: ruins and structures that appear in restored regions and change generation (see DESIGN).
4. Tile placing: decide whether it earns a place.
5. **Technology thread.** Work out how it fits in. The long-term aim is skyscrapers and a shinkansen, but they have to arrive in a way that feels natural, not as a jump. Related: item 3 and tying the rubbing collection to technological advancement (item 1). Open question; needs a design pass before any building.
6. **Livelier world.** Many more animals, and eventually people. Rare compared with the scenery, but common enough to keep the player interested. Open question whether they need custom models or can reuse a small set.
7. **Player.** A much higher-fidelity player model with real animations, and the abilities (boat, snowshoes, climbing gear and the rest) given the same treatment.
8. **Footsteps.** Moving across different terrain should make different sounds.
9. **Terrain variety.** More diversity in the world and the terrain, to reward exploring. Starting points:
   - Bridges, both the brown wooden arched kind and the vermilion kind famous in Japan, plus plain plank bridges and stepping stones.
   - Rivers and streams, waterfalls, hot-spring pools with steam, and terraced rice paddies.
   - Roadside things: torii lines, stone lanterns along paths, jizo statues, small tea houses and farmsteads, stone steps.
   - Landforms: cliffs, caves, mountain passes, and bamboo or cherry groves as set pieces.
   - Open design question: whether bridges only decorate water that is already crossable or can open new routes. Anything that changes reachability must keep the no-soft-lock property tests passing, and probably needs an ADR.
10. **Biome shrines.** Different biomes should have different shrine models, so the shrine itself says where you are (for example a snow-country shrine, a coastal one, a mountain one), rather than one shared model.

## Known gaps
- Landmarks use one placeholder model; ordinary regions differ only by biome.
- Two background themes, selected by first-voyage progress. Touch input not supported.
- Chunk meshes build on the main thread (2 per frame); move to a worker if hitching appears.
