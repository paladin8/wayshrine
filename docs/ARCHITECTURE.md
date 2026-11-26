# Architecture

## Principles
1. **Pure core, thin shell.** Everything that decides what the world is lives in layers that run in Node with no browser or GPU. Rendering and input are a shell around them.
2. **Determinism.** A world is a seed plus the player's discoveries ([ADR 0002](decisions/0002-seed-plus-discoveries.md)). Any chunk or region is a pure function of seed and coordinates, never of generation order.
3. **One-way dependencies**, enforced by test ([ADR 0004](decisions/0004-layered-architecture.md)).

## Layers
| Layer | Owns | May import |
| --- | --- | --- |
| `core` | seeded RNG, hashing, seeded value noise | nothing |
| `world` | biomes, capabilities, traversal rules, region graph, landmark placement and progression, tile terrain (`Terrain`, `CHUNK_SIZE`) | core |
| `game` | `GameState` (restored shrines, explored regions, rubbings), derived capabilities, discovery, vitality, save/load, player movement and collision, shrine reach | core, world |
| `render` | three.js stage, chunk streaming and the chunk workers, terrain/shrine/player meshes, palette, camera | core, world, game |
| `audio` | music playback: track registry, biome-to-track choice, crossfading player (browser audio, no three.js) | core, world, game |
| `app` | DOM, input (keyboard, gamepad, touch), HUD, backpack, journal, rubbing box and map, options dialog, translations, frame loop, title screen, save slots and settings, the desktop and Steam bridge, seed from URL | all |

Each layer exposes a public surface through `index.ts`. Other layers import only that.

## Data flow
```
seed ─► world (regions, landmarks) ─┐
                                ├─► game state (restored set) ─► render (vitality, meshes) ─► screen
input ─► app ───────────────────┘ (restore, move)
```
State flows down; `app` turns input into calls on `game` and hands results to `render`.

## Terrain and streaming
- Ground is a grid of 1x1 **tiles**; a **chunk** is 16x16 tiles. `Terrain.tileAt(tx, tz)` returns biome, height and region id as a pure function of seed and tile coordinates (`world/terrain-grid.ts`).
- Heights are quantised so terrain reads as low-poly facets. Land shrines stand on flat terraces. Ordinary lake and sea shrines sit at the waterline with clear approaches for restoration from a boat.
- `render/stage.ts` streams chunks within `LOAD_RADIUS` of the player and unloads beyond `LOAD_RADIUS + 1`. Chunk geometry (terrain, props and details) is built in two Web Workers (`render/chunk-source.ts`, `render/chunk-worker.ts`); the main thread only wraps the transferred typed arrays into geometry, a few chunks per frame. Without `Worker` (or with `?noworker`) the stage builds chunks itself. A chunk mesh keeps alive and dead colours, so restoring a region changes what is drawn without rebuilding geometry.
- Movement (`game/player.ts`) checks the four corners of the player's footprint against tile biomes and slides along obstacles. It is the single place walkability is decided; the tile-level progression test uses the same `canTraverse` rule.

## Props
- `world/props.ts` places scenery (trees, bushes, flowers, pines, rocks, crags, shrine lanterns) as a pure function of (seed, chunk). Density is clustered by noise and each biome has its own table.
- Props themselves are decorative data. Solidity is a separate layer (see Collision) built from them; walkability for progression stays a function of biomes only, which keeps the guarantee in ADR 0003 provable.
- `render/landmark-mesh.ts` draws a landmark: a placeholder at once, swapped for `public/models/landmarks/<id>.glb` when that has loaded (fetched lazily, parsed per instance so each owns its materials; a missing file, including a dev server's index-page reply, leaves the placeholder). Materials fade dead to alive with the region, `glow_*` parts light up. See `docs/landmarks.md`.
- `render/prop-mesh.ts` merges a chunk's props into one mesh through `VitalityBuilder` (`render/vitality-mesh.ts`), the same alive/dead colour mechanism the terrain uses, so everything in a region fades with its vitality. `render/chunk-mesh.ts` combines ground and props per chunk.

## Guidance, discovery and the map
- `GameState.explored` records regions the player has seen (standing in them, within `DISCOVER_RADIUS` of their shrine, or with ground within `REVEAL_DISTANCE`; all three distances grow once Pilgrim’s Wake is held). It is saved with the game (v3 added `collected`; v4 adds landmark reveals and migrates restored landmarks by ID).
- `game/guidance.ts` (`nextShrine`) picks the nearest unrestored shrine the player can reach with their current capabilities. It never points at a shrine behind terrain they cannot yet cross, and a test proves that following it alone always collects every capability.
- `game/player.ts` (`safePosition`) moves a stranded player to the nearest free ground. The app calls it every frame, so losing a capability (a reset, an old save) cannot trap anyone.
- The map lives in `app/` (DOM and canvas). The map is drawn region by region in the game's rotated screen orientation, using the stage's own ground/screen basis, and unexplored regions stay fogged. Biomes use the map's own colours; ground the player cannot cross yet is hatched, and the expanded map adds a legend of the biomes seen and the gear a blocked one needs. A region counts as explored once any of its ground is within `REVEAL_DISTANCE` of the player. Restored landmarks have red stars. The gold-star count is the number of seven-rubbing milestones minus the number of restored landmarks, with a minimum of zero. Gold stars go to the unrestored landmarks closest to the starting shrine. The expanded map frames explored regions and the landmark stars.

## Audio
`audio/music.ts` is a small manager over `HTMLAudioElement` (injectable for tests): nothing plays until the first user gesture (`unlock()`), tracks crossfade on `setTrack()`, and a finished track pauses a few seconds and repeats. `audio/tracks.ts` is the registry and `musicSetFor` chooses the background theme from the gear the player has used (`MUSIC_SETS`, one theme per ability). Each restoration uses the original swell for its shrine or landmark, regardless of the background track. The first voyage switches themes when the skiff pushes off. Finishing the launch records `boatLaunched`. The first moving step on snow with snowshoes records `snowshoesUsed` and starts the third score. Both fields are optional in v4 saves. `audio/cue-player.ts` plays sound effects and the app ducks the music while one plays. See [music.md](music.md) for assets, cue syncing and how to add tracks.

## Restoration and ambient life
Vitality is a pure field: `game/vitality-field.ts` maps `(progress, distance from shrine)` to life in [0,1] with a smooth front of `FRONT_WIDTH` travelling out to `WAVE_EXTENT` (52 world units). The final 10% also fills in distant edges, including those farther from an offset shrine. Vitality is evaluated on the GPU. Each loaded region owns a slot in a small uniform table (`render/vitality-mesh.ts`: progress, wave extent and wake origin per slot); every vertex stores its slot and its distance to the wave's origin, so a restoration changes a few numbers per frame instead of recolouring and re-uploading vertices. One shared material injects wind sway and water ripple in the vertex shader, scaled by the vertex's life and driven by `uTime`. The wave starts at the shrine's hokora (`waveOriginOf` in `world/hokora.ts`), not at the gate.

`game/awakening.ts` is the pure timeline (zoom out 1.2s, wave 8.8s, hold 1.5s, zoom in 1.6s for an ordinary shrine). The app owns the clock, ignores movement during it and lets E skip to the zoom-in. The stage focuses on the shrine, widens the orthographic view, scales the shadow frustum and streams chunks for the wider view. `render/ambient.ts` runs two particle layers (additive glow, soft normal) gated by `lifeAtPoint`; cosmetic randomness there may use `Math.random`.

## Debugging
`?perf` exposes `window.__wsPerf`, a frame-time probe with per-phase marks (`render/profile.ts`). `?debug` shows a panel (restore all landmarks, reset shrines, reset everything, go to nearest shrine) and exposes `window.wayshrine` with the same actions plus `teleport(x, z)`, `restore(id)` and `setFixedDt(seconds|null)` (fixed sim step, for deterministic screenshots on slow renderers). Resets save immediately and return the player to the start.

## Collision
`world/obstacles.ts` (`createObstacles`) turns the scenery into solid discs: tree and pine trunks, rocks, crags, lanterns, the two pillars of each shrine's torii (the gap between them stays open) and each monument. It derives them from the same `propsInChunk` call, with the same monument clearings, that the renderer draws, so nothing is solid that is not visible. Discs are cached per chunk. Low plants and bushes are not solid, and crowns are ignored, so the player walks under foliage and between trunks. `game/player.ts` slides the player around discs by pushing them radially out of any overlap after each step (`pushOut`), which also frees anyone who starts inside one (a teleport, an old save). The push never carries the player onto ground their capabilities forbid. Walkability for progression is still decided by biomes alone, and a test floods a patch of the world to check that free ground stays one connected expanse, so scenery cannot wall a region off (ADR 0003 still holds).

## Monuments and texts
`content/` holds the source collection and hand-written haiku scenery tags; `scripts/build-content.ts` (`npm run content`) runs the pure transform in `src/content/build.ts` and writes `src/content/texts.json` and `text-index.json`. `src/content/` is deliberately not a layer: `monumentSpecs` (id, kind, biome) ships in the main bundle and `loadTexts()` fetches the texts on first read. `world/monuments.ts` (`planMonuments`) places each text once, ring by ring from the start region, 0 to 2 per region, at least 18 units from shrines and clear of region edges, haiku in regions of their biome. `propsInChunk` takes clearings so scatter leaves room around a stone. `game` holds `collected` (save v3) and the reach and legibility rules (`monumentInReach`, `isLegible`). `render/monument-mesh.ts` draws stones through the vitality pipeline, as part of the chunk, so they fade with their region; `render/glimmer.ts` lights unread stones as the wave reaches them and keeps the glow visible nearby after restoration. `app/monuments-ui.ts` draws the white reading overlay and the rubbing box (B), both using Yuji Syuku and Kaushan Script. Escape dismisses the current reading view.

## Input
`app/input/` puts one layer between devices and the game ([ADR 0009](decisions/0009-input-actions.md)). Game code asks for verbs (`Action`: act, back, menu, map, journal, backpack, box, overview, mute, page turns) and a movement vector; it never sees a key code, a button or a touch.
- `actions.ts` is pure and tested: dead zone and analog scaling (`stickMove`, `walkScale`), spatial focus choice (`nextFocus`), and the `{act}` prompt placeholder (`formatPrompt`).
- `gamepad.ts` polls `navigator.getGamepads()` (standard mapping) through an injectable source: edge-detected buttons, stick and D-pad movement, menu navigation with repeat, and a right stick and triggers for the map.
- `touch.ts` draws the floating joystick, the contextual act button and the small toggle buttons, and unlocks audio on `touchend`.
- `panel-nav.ts` finds the topmost `[role=dialog][aria-modal]`, moves focus among its controls by direction and presses the focused one; `pressKey` sends Escape or the arrows to `window` so existing panels react as they do to a keyboard.
- `index.ts` (`createInput`) combines them and tracks the device used last, which drives the prompts, the touch controls and the welcome hint. Keyboard handling stays in `app.ts`, which routes gamepad and touch verbs through the same handlers (`handleAction`, `act`).
Movement is the stronger of keys and stick, scaled by `walkScale` (keys are always full speed). The expanded map freezes walking; the stick pans it and a reticle picks the nearest waypoint.

## Settings and language
`app/settings.ts` holds the persisted player settings (music and sound-effects volume, mute, minimap visibility, language) as a small store with subscribers; parsing tolerates missing, damaged or older data, and the language defaults to the browser's. `app/settings-panel.ts` is the Options dialog that edits it (gear button, `Esc` or the controller's Menu button): a Settings tab (how to play, audio, display, traveller, language) and a Controls tab listing the controls. While it is open the game ignores movement and action keys. The app applies each change at once: volumes to the music and cue players, visibility to the HUD and minimap.

`app/title-screen.ts` is the first thing a player sees (skipped when the URL carries `?seed=`): a 3D scene (`render/title-scene.ts`) with the logo image, Continue (the most recently played save), New game with an optional seed (blank generates a random one), Load game (play or delete any save), Options (the settings dialog) and Credits. `app/saves.ts` stores any number of save slots: an index (`wayshrine:slots`), the last-played id, one body per slot (`wayshrine:slot:<id>`) and the player's position (`wayshrine:slotPosition:<id>`, written about once a second while the player is free to walk). A slot appears in the list after its first write. Saves from before slots existed (`wayshrine:save:<seed>`) are copied into slots on first run. The settings dialog has a Return to title button during play.

`app/i18n/` holds the catalogs. `Messages` (in `messages.ts`) is the single shape of all player-facing text, with `en.ts` and `ja.ts` each implementing it, so a missing string is a compile error and `i18n.test.ts` also checks both languages have identical coverage. Sentences with inserted values are functions, so each language controls word order. The HUD and minimap take the current `Messages` every frame and only touch the DOM when text changes, which makes a language switch instant. The debug panel is deliberately untranslated.

## Key concepts
- **Shrine:** a torii gate with a small hokora (祠) 2.5 units behind it (`world/hokora.ts`). The hokora is what the player restores (`HOKORA_REACH`, shared by monuments), and travel arrives in front of the gate.
- **Region:** a Voronoi cell around a jittered grid site (`REGION_SIZE` 64). Has a biome and one shrine. Ordinary shrines can sit up to 14 units from the site, with room for the plateau and approach.
- **Landmark:** a special region with a fixed biome and a hand-crafted model; restoring a number of them unlocks each capability. Planned in outward ring bands, always reachable with the abilities already held.
- **Vitality:** 0 to 1 per region; drives saturation, brightness and animation. Dead regions use the same geometry with a muted palette.
- **Fork:** `rng.fork(label)` derives an independent stream from a label, so adding a new consumer never shifts existing output.

## Enforcement
`src/architecture.test.ts` checks import direction, index-only imports, `three` containment, no DOM globals in pure layers, no `Math.random` in the pure layers (presentation layers may use it for purely cosmetic effects such as particles). `world/world.test.ts` checks the progression guarantees at region level over 300 seeds, and `game/player.test.ts` checks them again at tile level (BFS over real tiles) on a few seeds.

## Conventions
- Pure functions and immutable state in `world` and `game`.
- Tests live beside the code as `*.test.ts`.
- Names: `kebab-case.ts` files, one concept per file.

## Adding a feature
1. Decide the layer by what it needs: rules and generation go in `world`, player-changeable state in `game`, anything visual in `render`, input and timing in `app`.
2. Write the pure part first with a test.
3. Export through that layer's `index.ts`.
4. Run `npm run check`.
5. Update ROADMAP; add an ADR if the choice is costly to reverse.
