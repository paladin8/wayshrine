# Roadmap

## Done
- Blender reference diorama and animations.
- Project scaffold, layered structure, architecture test.
- World core: seeded RNG and noise, regions, biomes, landmark progression, no-soft-lock property tests (region level and tile level).
- Game state: restore, capabilities, save format, player movement.
- **Monuments and rubbings:** 1,209 Japanese texts on monuments, spread 0 to 2 per region with a find near every landmark; worn until the region is restored; a glimmer when one is on screen; reading adds a loose sheet to the rubbing box (B). Haiku match their region's biome. See ADR 0005.
- **Haiku scenery:** all 59 tagged haiku have an authored scene beside their rubbing site. Local motion, lighting and effects follow the restoration wave.
- **Title screen and save slots:** scenic title with placeholder logo, Continue, New game with optional seed, Load game (unlimited slots), Options, Credits; the player's position is saved about once a second.
- **Settings and language:** settings dialog (music and sound-effects volume, mute, minimap toggle), English and Japanese, persisted.
- **Music:** audio layer with crossfading player, eight unlockable scores tied to gear and ability progression, volume/mute controls.
- **Landmarks (structure):** 66 landmarks in nine acts placed in outward ring bands; abilities unlock at 3, 8, 14, 22, 30, 39 and 48 restored landmarks instead of at shrines, and Pilgrim’s Wake at 58; biomes in patches of a few regions, with marsh, dark forest, volcanic and sea fading in beyond about 11 regions; wide plateau and solid placeholder model per landmark; the map marks the next reachable landmark. See ADRs 0006 and 0007 and `docs/landmarks.md`.
- **Guidance:** debug mode marks the nearest reachable unrestored shrine or landmark and offers travel to it, landmark reveals earned at seven rubbings per star, reduced by restored landmarks, in story order with a seeded order within each act, exploration tracking, corner map and expanded map (M), and debug reset tools.
- **Ability acquisition.** Each piece of gear has an unlock notice, a first-use animation, and a matching soundtrack transition. Pilgrim’s Wake uses the 58th landmark ceremony to introduce its final theme. See `docs/music.md`.
- **Ordinary shrines:** biome-specific gates and shelters. Land shrines sit on flat terraces that blend into the surrounding hill, lake shrines stand on pilings, and coastal torii rise directly from the sea. Water shrines can be restored from the boat.
- **Tokyo Tower:** the tower anchors a walkable city district at landmark 46. The district gains color as restoration reaches the streets.
- **Ginzan Onsen:** a seeded downstream route leads to baths and footbridges. Each bath warms up after Ginzan and its local shrine are restored.
- **Scenery:** seeded regional palettes and brushwork, cedar forests, reed beds and marsh pools, basalt and ash seams, separate lake ripples and ocean breakers. Lighting, mist, spray, and cinders vary by biome; the restoration wave brings the details to life.
- **Regional variety:** changing boundary shapes, biome-specific relief, island and shoal forms, and lake and seabed colour patterns. Restored regions mix clustered plant species with local birds and fish. Rubbings use a wider range of stone, wood, ceramic, and bronze forms.
- **Rare wildlife:** roughly one in four regions has a seeded large-animal sighting after restoration. Sika deer graze and stroll, foxes dart, and boars rest between charges. Serow pick their way along slopes, cranes wade and peck, otters paddle in bursts, dolphins leap, and whales surface and dive. Nara and Itsukushima share the sika deer model with wild herds.
- **Awakening swell:** one-shot cue player, music ducking under it, background music halved.
- **Restoration moment and ambient life:** radial vitality wave from the shrine, camera zooms out to frame the whole region, hold once fully energised, zoom back (E skips). Foliage sway, water ripple, fireflies, petals, snow and shrine sparks scale with vitality.
- **Travel journal:** the landmark counter (or J) opens a notebook with a handwritten entry per restored landmark, two to a page, with a button to travel back; cover-opening and page-turn animations and sounds. With `?debug` all landmarks are listed and travel works for all of them. A pencil sketch per entry is still to do.
- **Landmark finale:** when the final restoration settles, the Far Sight star chart returns as a celebration showing every landmark in map orientation. Completed worlds can reopen the chart from the travel journal.
- **Vertical slice:** streamed tile terrain per biome, WASD player gated by capabilities, shrines that go from dead to alive (animated vitality), HUD, localStorage saves, `?debug` hooks.

## Next
0. Landmarks: screen-edge glow for revealed landmarks, skyline peek for tall landmarks, real looks, props and player visuals for the later biomes and abilities (placeholders now), more landmark models.
1. Refine biome edge shapes.
2. Advanced-civilisation layer: ruins and structures that appear in restored regions and change generation (see DESIGN).
3. Tile placing: decide whether it earns a place.
4. **Technology thread.** Mount Fuji is the scenic railway. Its five-region corridor echoes the ride with trackside farmhouses, paddies, and cherry trees. See the [scenic railway plan](railway-plan.md).
5. **Livelier world.** Extend rare sightings with responses to nearby players, and eventually add people.
6. **Player.** A much higher-fidelity player model with real animations, and the abilities (boat, snowshoes, walking sticks and the rest) given the same treatment.
7. **Footsteps.** Moving across different terrain should make different sounds.
8. **Terrain variety.** More diversity in the world and the terrain, to reward exploring. Starting points:
   - Bridges, both the brown wooden arched kind and the vermilion kind famous in Japan, plus plain plank bridges and stepping stones.
   - Rivers and streams, waterfalls, hot-spring pools with steam, and terraced rice paddies.
   - Roadside things: torii lines, stone lanterns along paths, jizo statues, small tea houses and farmsteads, stone steps.
   - Landforms: cliffs, caves, mountain passes, and bamboo or cherry groves as set pieces.
   - Open design question: whether bridges only decorate water that is already crossable or can open new routes. Anything that changes reachability must keep the no-soft-lock property tests passing, and probably needs an ADR.
9. **Biome shrines.** Add regional variants of the existing gates and shelters.

## Known gaps
- Some landmarks still use placeholder models.
- Touch input not supported.
- Chunk meshes build on the main thread (2 per frame); move to a worker if hitching appears.
