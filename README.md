# Wayshrine

An open-ended, non-combat exploration game on an endlessly extending map of low-poly
isometric islands. Working title.

Built with TypeScript, [Three.js](https://threejs.org) and [Vite](https://vitejs.dev).

## Run

```sh
npm install
npm run dev        # http://localhost:5173  (add ?seed=anything to pick a world)
npm test           # unit tests (vitest)
npm run build      # typecheck + production build into dist/
```

Drag to pan.

## Layout

```
src/core/    deterministic RNG (seed -> independent streams)
src/world/   palette and procedural island generation
src/main.ts  renderer, isometric camera, lighting, input
docs/        design notes
```

See [docs/DESIGN.md](docs/DESIGN.md) for the vision and open questions.
