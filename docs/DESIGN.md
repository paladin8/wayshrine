# Design

Design intent only. How it is built lives in [ARCHITECTURE.md](ARCHITECTURE.md).

## Pillars
- **Open-ended, no combat.** The map extends as you explore. A session can be five minutes or five hours.
- **Restoration is the core loop.** Each shrine is the energy source of its region. Restoring it takes the region from dead, dark and muted to lively and colourful. The reward is visible on the land itself. The moment is staged: energy radiates outward from the shrine, the camera pulls back to show the region waking, then holds before returning to the player. Landmark restorations use a gentler pullback and a closer view of the landmark.
- **Discovery changes the world.** What you find changes what the generator produces next, so exploration stays fresh.
- **Never stuck.** Terrain is opened by capabilities, and the world is built so the next capability is always reachable ([ADR 0006](decisions/0006-landmarks-and-progression.md)); abilities come from restoring landmarks, the hand-crafted places in [landmarks.md](landmarks.md).
- **Look.** Low-poly, flat-shaded, isometric diorama, from the Blender shrine reference.

## Movement and terrain
Free walking by default. Capabilities unlock terrain: **boat** (water), **snowshoes** (snow), **walking sticks** (mountain), **geta** (marsh), **lantern** (dark forest), **ash sandals** (volcanic ground) and **ship** (open sea). The final ability, **Pilgrim’s Wake**, brings dormant regions back to life as the traveller walks into them. The wave starts at their footsteps and spreads while they keep moving.

## Monuments
A thousand texts (haiku, proverbs, sayings) stand on stones scattered thinly across the world, at most two to a region, so finding one is a small expedition. In a dead region the inscription is worn away; restoring the land makes it legible. A faint glimmer shows an unread stone once it is on screen; nothing points to it from afar. The traveler keeps loose sheets of collected rubbings in a rubbing box. Haiku are placed where their scenery belongs. In Japanese the text stands alone; in English it comes with a translation that stays close to the Japanese and keeps its image, rather than swapping in an English saying. The world is allowed to feel peacefully empty.

## Narrative thread
The shrines are older than the land suggests. Restoring them uncovers a more advanced, more complex civilisation, powered by the same shrine energy. Pacing of this reveal is open.

## Open questions
- Tile placing: only if an idea fits the restoration loop.
- What the advanced-civilisation layers change in generation, beyond biomes.
- Rest-and-return loop for short sessions.
