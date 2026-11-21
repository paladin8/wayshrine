# 0004: Layered architecture enforced by test
Status: accepted

**Context.** The project will grow; navigability depends on boundaries staying clean.

**Decision.** Six layers (core, world, game, render, audio, app; audio was added with the music system) with one-way imports, barrel-only cross-layer access, three.js only in render, no DOM or `Math.random` in the pure layers (core, world, game). Cosmetic effects in presentation layers may use `Math.random`; world content never. `architecture.test.ts` fails the build on violations.

**Consequences.** Pure layers stay testable in Node and portable to workers. Cost: some boilerplate in `index.ts` files. Changing the rules means editing the test and ARCHITECTURE.md on purpose.
