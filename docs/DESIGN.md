# Design notes

## Vision

- An open-ended game: the map keeps extending as you explore.
- Progression comes from discovery, and discoveries change the nature of the
  procedural generation, not just what is on screen.
- Sessions can be 5 minutes or 5 hours.
- No combat. Exploration needs a discovery/achievement angle strong enough that it
  does not go stale (undecided, see below).
- Visual style: the low-poly isometric shrine diorama (flat shading, small palette,
  soft sun shadow, translucent water). Polytopia is a loose reference for the vibe,
  with much less complexity.

## Architecture direction (initial)

- **A world is a seed plus discoveries**, never stored geometry.
- **A chunk is a pure function** of (world seed, chunk coordinates, discovery state).
  Chunk RNG streams come from `rng.fork("chunk:x,z")`, so generation order does not
  matter and chunks can be generated in workers.
- **Generation regimes** are selected by discovery state. New discoveries unlock new
  generators or change parameters (islands, structures, biomes), which is how
  progression changes the world.
- **Rendering stays cheap:** flat shading, a shared palette, instancing for repeated
  props, animation in vertex shaders.

## Open questions

- What is the core discovery/achievement loop? Candidates to explore: a codex of
  discovered things, restoring shrines/landmarks, charting regions, unlocking new
  kinds of places.
- How does the player move: free walking, a boat/raft between islands, or both?
- What does a discovery unlock in generation terms (new tile types, new structures,
  new biomes, different island shapes)?
- Where does the tile-placing idea fit, if at all?
