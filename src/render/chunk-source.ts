import type { MonumentSpec } from "../world";
import type { ChunkRequest, ChunkResponse } from "./chunk-worker";

/** Chunk geometry built on worker threads: ask for a chunk, collect it a few frames later. */
export interface ChunkSource {
  request(cx: number, cz: number): void;
  /** Finished chunks, oldest first, at most `limit` of them. */
  take(limit: number): ChunkResponse[];
  /** Chunks asked for and not yet collected. */
  outstanding(): number;
}

const WORKERS = 2;

/** Starts the workers, or returns null where they are unavailable (the stage then builds chunks itself). */
export function createChunkSource(seed: string, specs: readonly MonumentSpec[]): ChunkSource | null {
  if (typeof Worker === "undefined" || new URLSearchParams(window.location.search).has("noworker")) return null;
  const workers: Worker[] = [];
  const done: ChunkResponse[] = [];
  let outstanding = 0;
  let next = 0;
  try {
    for (let i = 0; i < WORKERS; i++) {
      const worker = new Worker(new URL("./chunk-worker.ts", import.meta.url), { type: "module" });
      worker.onmessage = (event: MessageEvent<ChunkResponse>) => done.push(event.data);
      const init: ChunkRequest = { type: "init", seed, specs };
      worker.postMessage(init);
      workers.push(worker);
    }
  } catch {
    for (const worker of workers) worker.terminate();
    return null;
  }
  return {
    request(cx, cz) {
      outstanding++;
      const message: ChunkRequest = { type: "build", cx, cz };
      workers[next++ % workers.length]!.postMessage(message);
    },
    take(limit) {
      const taken = done.splice(0, limit);
      outstanding -= taken.length;
      return taken;
    },
    outstanding: () => outstanding,
  };
}
