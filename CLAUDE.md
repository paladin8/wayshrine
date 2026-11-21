# Wayshrine: working notes for agents

## Commands
- `npm run dev`: dev server. `?seed=<text>` selects the world; `?debug` shows a debug panel (restore/reset shrines, go to nearest shrine) and exposes `window.wayshrine`. `M` toggles the full map.
- `npm run check`: typecheck, tests, build. Run before declaring anything done.
- `npx vitest run <path>`: a single test file.

## Layout (dependencies point down only)
```
src/core     pure utilities (seeded RNG). imports nothing
src/world    pure procedural world: terrain rules, regions, progression. imports core
src/game     pure game state: restored shrines, capabilities, saves. imports core, world
src/render   three.js: meshes, camera, lighting. imports core, world, game
src/app      browser wiring: input, frame loop. imports everything
src/main.ts  entry point, one line
```
Details and rationale: `docs/ARCHITECTURE.md`.

## Rules (enforced by `src/architecture.test.ts`)
1. Cross-layer imports go through the target layer's `index.ts` only.
2. `three` is imported only in `src/render`.
3. No DOM globals in core, world, game. Pure layers must run in Node.
4. No `Math.random` outside `src/app`. Use `createRng(seed).fork(label)`.
5. A chunk or region is a pure function of (seed, coordinates). Never of generation order.

## Progression invariant
The player must never be stuck. Do not change `world/spine.ts`, `world/terrain.ts` or `world/progression.ts` without re-reading `docs/decisions/0003-progression-spine.md` and keeping the property tests in `world/world.test.ts` green.

## Documentation upkeep
- Changed a layer boundary or added a layer: update `docs/ARCHITECTURE.md` and `architecture.test.ts` together.
- Made a decision that would be costly to reverse: add an ADR in `docs/decisions/` (next number, short, with consequences).
- Shipped or re-scoped a milestone: update `docs/ROADMAP.md`.
- Changed design intent: update `docs/DESIGN.md`. It holds intent only, never implementation.
