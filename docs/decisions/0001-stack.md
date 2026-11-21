# 0001: Three.js, TypeScript, Vite
Status: accepted

**Context.** Needed an engine for a low-poly isometric game that is easy to share and iterate on with an AI-assisted workflow. Alternative: Godot.

**Decision.** Three.js with TypeScript, built with Vite, running in the browser.

**Consequences.** Zero-install play and trivial hosting; whole project is text, easy to test headlessly. No editor tooling; we build our own camera, chunking and UI. Performance ceiling is the browser's.
