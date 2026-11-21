# 0004: Layered architecture enforced by test
Status: accepted

**Context.** The project will grow; navigability depends on boundaries staying clean.

**Decision.** Five layers (core, world, game, render, app) with one-way imports, barrel-only cross-layer access, three.js only in render, no DOM or `Math.random` in pure layers. `architecture.test.ts` fails the build on violations.

**Consequences.** Pure layers stay testable in Node and portable to workers. Cost: some boilerplate in `index.ts` files. Changing the rules means editing the test and ARCHITECTURE.md on purpose.
