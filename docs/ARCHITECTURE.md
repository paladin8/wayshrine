# Architecture

## Principles
1. **Pure core, thin shell.** Everything that decides what the world is lives in layers that run in Node with no browser or GPU. Rendering and input are a shell around them.
2. **Determinism.** A world is a seed plus the player's discoveries ([ADR 0002](decisions/0002-seed-plus-discoveries.md)). Any chunk or region is a pure function of seed and coordinates, never of generation order.
3. **One-way dependencies**, enforced by test ([ADR 0004](decisions/0004-layered-architecture.md)).

## Layers
| Layer | Owns | May import |
| --- | --- | --- |
| `core` | seeded RNG, hashing, seeded value noise | nothing |
| `world` | biomes, capabilities, traversal rules, region graph, progression spine, tile terrain (`Terrain`, `CHUNK_SIZE`) | core |
| `game` | `GameState` (restored shrines), derived capabilities, vitality, save/load, player movement and collision, shrine reach | core, world |
| `render` | three.js stage, chunk streaming, terrain/shrine/player meshes, palette, camera | core, world, game |
| `app` | DOM, keyboard input, HUD, frame loop, localStorage saves, seed from URL | all |

Each layer exposes a public surface through `index.ts`. Other layers import only that.

## Data flow
```
seed ─► world (regions, spine) ─┐
                                ├─► game state (restored set) ─► render (vitality, meshes) ─► screen
input ─► app ───────────────────┘ (restore, move)
```
State flows down; `app` turns input into calls on `game` and hands results to `render`.

## Terrain and streaming
- Ground is a grid of 1x1 **tiles**; a **chunk** is 16x16 tiles. `Terrain.tileAt(tx, tz)` returns biome, height and region id as a pure function of seed and tile coordinates (`world/terrain-grid.ts`).
- Heights are quantised so terrain reads as low-poly facets. Within `PLATEAU_RADIUS` of a shrine the ground is flat; a shrine in a water region stands on a meadow islet, reachable only by boat.
- `render/stage.ts` streams chunks within `LOAD_RADIUS` of the player (2 built per frame after the first) and unloads beyond `LOAD_RADIUS + 1`. A chunk mesh keeps alive and dead vertex colours, so restoring a region recolours it without rebuilding geometry.
- Movement (`game/player.ts`) checks the four corners of the player's footprint against tile biomes and slides along obstacles. It is the single place walkability is decided; the tile-level progression test uses the same `canTraverse` rule.

## Props
- `world/props.ts` places scenery (trees, bushes, flowers, pines, rocks, crags, shrine lanterns) as a pure function of (seed, chunk). Density is clustered by noise and each biome has its own table.
- Props are **decorative and never block movement**. Walkability stays a function of biomes only, which keeps the progression guarantee (ADR 0003) provable. If solid props are ever wanted, the tile-level progression test must account for them.
- `render/prop-mesh.ts` merges a chunk's props into one mesh through `VitalityBuilder` (`render/vitality-mesh.ts`), the same alive/dead colour mechanism the terrain uses, so everything in a region fades with its vitality. `render/chunk-mesh.ts` combines ground and props per chunk.

## Key concepts
- **Region:** a Voronoi cell around a jittered grid site (`REGION_SIZE` 64). Has a biome and one shrine.
- **Spine:** the guaranteed path of regions: keystone meadow (grants a capability), barrier biome (needs it), next keystone beyond.
- **Vitality:** 0 to 1 per region; drives saturation, brightness and animation. Dead regions use the same geometry with a muted palette.
- **Fork:** `rng.fork(label)` derives an independent stream from a label, so adding a new consumer never shifts existing output.

## Enforcement
`src/architecture.test.ts` checks import direction, index-only imports, `three` containment, no DOM globals in pure layers, no `Math.random` outside `app`. `world/world.test.ts` checks the progression guarantees at region level over 300 seeds, and `game/player.test.ts` checks them again at tile level (BFS over real tiles) on a few seeds.

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
