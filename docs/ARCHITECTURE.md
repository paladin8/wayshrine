# Architecture

## Principles
1. **Pure core, thin shell.** Everything that decides what the world is lives in layers that run in Node with no browser or GPU. Rendering and input are a shell around them.
2. **Determinism.** A world is a seed plus the player's discoveries ([ADR 0002](decisions/0002-seed-plus-discoveries.md)). Any chunk or region is a pure function of seed and coordinates, never of generation order.
3. **One-way dependencies**, enforced by test ([ADR 0004](decisions/0004-layered-architecture.md)).

## Layers
| Layer | Owns | May import |
| --- | --- | --- |
| `core` | seeded RNG, hashing | nothing |
| `world` | biomes, capabilities, traversal rules, region graph, progression spine, island outline | core |
| `game` | `GameState` (restored shrines), derived capabilities, vitality, save/load | core, world |
| `render` | three.js stage, meshes, palette, camera | core, world, game |
| `app` | DOM, input, frame loop, seed from URL | all |

Each layer exposes a public surface through `index.ts`. Other layers import only that.

## Data flow
```
seed ─► world (regions, spine) ─┐
                                ├─► game state (restored set) ─► render (vitality, meshes) ─► screen
input ─► app ───────────────────┘ (restore, move)
```
State flows down; `app` turns input into calls on `game` and hands results to `render`.

## Key concepts
- **Region:** a Voronoi cell around a jittered grid site (`REGION_SIZE` 64). Has a biome and one shrine.
- **Spine:** the guaranteed path of regions: keystone meadow (grants a capability), barrier biome (needs it), next keystone beyond.
- **Vitality:** 0 to 1 per region; drives saturation, brightness and animation. Dead regions use the same geometry with a muted palette.
- **Fork:** `rng.fork(label)` derives an independent stream from a label, so adding a new consumer never shifts existing output.

## Enforcement
`src/architecture.test.ts` checks import direction, index-only imports, `three` containment, no DOM globals in pure layers, no `Math.random` outside `app`. `world/world.test.ts` checks the progression guarantees over 300 seeds.

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
