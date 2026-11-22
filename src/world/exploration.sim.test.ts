import { it } from "vitest";
import { createWorld } from "./world";
import { capabilitiesForCount, type LandmarkLayout } from "./landmarks";
import { canTraverse } from "./terrain";
import { createRng } from "../core";

function explore(seed: string, layout: LandmarkLayout, find: number) {
  const world = createWorld(seed, layout);
  const rng = createRng(`walk:${seed}`);
  const restored = new Set<string>();
  let x = 0.5, z = 0.5, heading = rng.range(0, 6.283), sinceTurn = 0;
  let steps = 0, last = 0;
  const visited = new Set<string>();
  const out: Array<{ k: number; steps: number; regions: number; radius: number }> = [];
  const lm = world.landmarks.map((r) => ({ r, cx: r.coord.rx + 0.5, cz: r.coord.rz + 0.5 }));
  while (steps < 40000 && restored.size < 40) {
    const caps = capabilitiesForCount(restored.size);
    const nx = x + Math.cos(heading) * 0.5, nz = z + Math.sin(heading) * 0.5;
    const reg = world.region(Math.floor(nx), Math.floor(nz));
    if (!canTraverse(reg.biome, caps)) { heading = rng.range(0, 6.283); sinceTurn = 0; steps++; continue; }
    x = nx; z = nz; steps++; sinceTurn++;
    visited.add(reg.id);
    if (sinceTurn >= 12) { heading = rng.range(0, 6.283); sinceTurn = 0; }
    for (const l of lm) {
      if (restored.has(l.r.id)) continue;
      if (Math.hypot(l.cx - x, l.cz - z) > find) continue;
      if (!canTraverse(l.r.biome, caps)) continue;
      restored.add(l.r.id);
      out.push({ k: restored.size, steps: (steps - last) / 2, regions: visited.size, radius: Math.hypot(l.cx, l.cz) });
      last = steps; visited.clear();
      x = l.cx; z = l.cz;
      break;
    }
  }
  return out;
}

const med = (a: number[]) => [...a].sort((p, q) => p - q)[a.length >> 1] ?? NaN;
const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);

/**
 * Not a test: a simulation of a player who walks in random directions (turning every six regions and
 * whenever blocked), restoring whatever landmark comes within view. Run with `SIM=1 npx vitest run src/world/exploration.sim.test.ts`
 * to see how many regions are walked (and how many distinct regions are seen) per landmark found.
 * `LAYOUTS=compact,close` picks the landmark layouts to compare.
 */
it.skipIf(!process.env.SIM)("exploration", () => {
  for (const layout of (process.env.LAYOUTS ?? "compact,close").split(",") as LandmarkLayout[]) {
    const per: Record<number, { steps: number[]; regions: number[] }> = {};
    let found = 0, runs = 0;
    for (let i = 0; i < 40; i++) {
      const res = explore(`sim-${i}`, layout, 0.75);
      runs++; found += res.length;
      for (const r of res) (per[r.k] ??= { steps: [], regions: [] }, per[r.k]!.steps.push(r.steps), per[r.k]!.regions.push(r.regions));
    }
    const buckets: Array<[string, number, number]> = [["1-3", 1, 3], ["4-8", 4, 8], ["9-13", 9, 13], ["14-20", 14, 20], ["21-30", 21, 30], ["31-40", 31, 40]];
    console.log(`LAYOUT ${layout}: landmarks found per run ${(found / runs).toFixed(1)}`);
    for (const [name, lo, hi] of buckets) {
      const s: number[] = [], rg: number[] = [];
      for (let k = lo; k <= hi; k++) { s.push(...(per[k]?.steps ?? [])); rg.push(...(per[k]?.regions ?? [])); }
      console.log(`  landmarks ${name}: n=${s.length} regions walked per landmark mean ${mean(s).toFixed(0)} median ${med(s).toFixed(0)}; distinct regions seen mean ${mean(rg).toFixed(0)} median ${med(rg).toFixed(0)}`);
    }
  }
}, 600000);
