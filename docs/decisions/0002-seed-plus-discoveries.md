# 0002: A world is a seed plus discoveries
Status: accepted

**Context.** The map is unbounded and must be consistent however the player explores.

**Decision.** World content is a pure function of seed and coordinates, using label-derived RNG forks. The only stored state is the seed plus what the player changed (restored shrines). Saves contain just that.

**Consequences.** Tiny saves, reproducible bugs, chunks can be generated in any order or in workers. Generation code must never read mutable global state or depend on call order; tests assert determinism. Discoveries that alter later generation must enter as explicit inputs.
