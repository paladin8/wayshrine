# Design

Design intent only. How it is built lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Pillars
- **Open-ended, no combat.** The map extends as you explore. A session can be five minutes or five hours.
- **Restoration is the core loop.** Each shrine is the energy source of its region. Restoring it takes the region from dead, dark and muted to lively and colourful. The reward is visible on the land itself. The moment is staged: energy radiates outward from the shrine, the camera pulls back to show the whole region waking, then holds on the fully lit region before returning to the player.
- **Discovery changes the world.** What you find changes what the generator produces next, so exploration stays fresh.
- **Never stuck.** Terrain is opened by capabilities, and the world is built so the next capability is always reachable ([ADR 0003](decisions/0003-progression-spine.md)).
- **Look.** Low-poly, flat-shaded, isometric diorama, from the Blender shrine reference.

## Movement and terrain
Free walking by default. Capabilities unlock terrain: **boat** (water), **snowshoes** (snow), **climbing gear** (mountain).

## Narrative thread
The shrines are older than the land suggests. Restoring them uncovers a more advanced, more complex civilisation, powered by the same shrine energy. Pacing of this reveal is open.

## Open questions
- Tile placing: only if an idea fits the restoration loop.
- What the advanced-civilisation layers change in generation, beyond biomes.
- Rest-and-return loop for short sessions.
