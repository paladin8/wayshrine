import { writeFileSync } from "node:fs";
import { expect, it } from "vitest";
import type { Mesh } from "three";
import { monumentSpecs } from "./content";
import { createRng } from "./core";
import { buildChunk } from "./render/chunk-mesh";
import { createSightings } from "./render/large-wildlife";
import {
  BIOME_REQUIRES, BIOMES, CAPABILITIES, CAPABILITY_THRESHOLDS, CHUNK_SIZE, LANDMARK_WINDOW,
  PILGRIMS_WAKE_STARS, capabilitiesForCount, createObstacles, createTerrain, createWorld, footprintHalf,
  isWater, landmarksBeforeAct, monumentsAroundChunk, planMonuments, propsInChunk, MONUMENT_CLEARING,
  reachableRegions, standPoint, type Biome, type Capability, type Obstacles, type Point, type Region, type Terrain,
} from "./world";
import {
  blockerAt, capabilitiesOf, deserialize, isLegible, monumentInReach, movePlayer, newGame,
  planBoatLaunch, planShipLaunch, PLAYER_RADIUS, PLAYER_SPEED, restoreShrine, serialize,
  shipLaunchFrame, SHIP_LAUNCH_SECONDS, shrineInReach,
} from "./game";

const CARDINAL = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
const DIRECTIONS = Array.from({ length: 16 }, (_, i) => ({
  x: Math.cos(i * Math.PI / 8), z: Math.sin(i * Math.PI / 8),
}));

function hasExit(terrain: Terrain, obstacles: Obstacles, region: Region, caps: ReadonlySet<Capability>, arrival: Point): boolean {
  const distance = footprintHalf(region.landmark!) + 1;
  const walkable = (p: Point): boolean => blockerAt(terrain, caps, p.x, p.z) === null
    && obstacles.near(p.x, p.z, PLAYER_RADIUS).every((o) => Math.hypot(o.x - p.x, o.z - p.z) >= o.r + PLAYER_RADIUS - 1e-8);
  const outside = (p: Point): boolean => Math.max(Math.abs(p.x - region.shrine.x), Math.abs(p.z - region.shrine.z)) > distance
    && (!isWater(region.biome) || terrain.tileAtPoint(p.x, p.z).biome === region.biome);
  if (!walkable(arrival)) return false;
  if (DIRECTIONS.some((dir) => outside(movePlayer(arrival, dir, (distance * 2 + 3) / PLAYER_SPEED, terrain, caps, obstacles).pos))) return true;

  // A straight move may fail when the way out turns. Try paths around the scenery
  // using the same quarter-unit collision scale as normal movement.
  const queue: Array<[number, number]> = [[0, 0]];
  const seen = new Set(["0,0"]);
  for (const [dx, dz] of queue) {
    const point = { x: arrival.x + dx / 4, z: arrival.z + dz / 4 };
    if (outside(point)) return true;
    for (const [sx, sz] of CARDINAL) {
      const nx = dx + sx;
      const nz = dz + sz;
      if (Math.max(Math.abs(nx), Math.abs(nz)) > (distance * 2 + 12) * 4) continue;
      const key = `${nx},${nz}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const next = { x: arrival.x + nx / 4, z: arrival.z + nz / 4 };
      if (walkable(next) && walkable({ x: (point.x + next.x) / 2, z: (point.z + next.z) / 2 })) queue.push([nx, nz]);
    }
  }
  return false;
}

/** Ordinary shrines are restored behind the gate. Search nearby paths with the normal collision rules. */
function canApproachShrine(terrain: Terrain, obstacles: Obstacles, field: Region, caps: ReadonlySet<Capability>, arrival: Point): boolean {
  const queue = [arrival];
  const visited = new Set(["0,0"]);
  for (const at of queue) {
    if (shrineInReach(terrain, at)?.id === field.id) return true;
    for (const [x, z] of CARDINAL) {
      const next = movePlayer(at, { x, z }, 0.5 / PLAYER_SPEED, terrain, caps, obstacles).pos;
      if (Math.max(Math.abs(next.x - arrival.x), Math.abs(next.z - arrival.z)) > 10) continue;
      const key = `${Math.round((next.x - arrival.x) * 4)},${Math.round((next.z - arrival.z) * 4)}`;
      if (visited.has(key)) continue;
      visited.add(key);
      queue.push(next);
    }
  }
  return false;
}

// Run with WAYSHRINE_QUALITY_PASS=1 npm test -- src/quality-pass.sim.test.ts.
// QUALITY_GEOMETRY=1 also builds and checks the production chunk at every stop.
// Set QUALITY_REPORT to an output path for the per-location evidence.
it.skipIf(!process.env.WAYSHRINE_QUALITY_PASS)("visits 100 independent locations in each of 100 seeded worlds", () => {
  const report: Array<{
    seed: string;
    visits: Array<{ label: string; region: string; biome: Biome; stage: number; x: number; z: number; props: number; sighting: boolean; triangles?: number }>;
    issues: Array<{ kind: string; label: string; x?: number; z?: number }>;
  }> = [];
  const seeds = Number(process.env.QUALITY_WORLDS ?? 100);
  const start = Number(process.env.QUALITY_START ?? 0);
  const checkGeometry = process.env.QUALITY_GEOMETRY === "1";
  for (let n = start; n < start + seeds; n++) {
    const seed = `quality-pass-${String(n).padStart(3, "0")}`;
    const rng = createRng(seed).fork("visits");
    const world = createWorld(seed);
    const terrain = createTerrain(world);
    const monuments = planMonuments(terrain, monumentSpecs);
    const obstacles = createObstacles(terrain, monuments);
    const sightings = createSightings(terrain);
    const cases: (typeof report)[number] = { seed, visits: [], issues: [] };
    report.push(cases);
    const issue = (kind: string, label: string, point?: Point): void => { cases.issues.push({ kind, label, ...point }); };
    const visit = (label: string, region: Region, stage: number, point: Point): void => {
      const tile = terrain.tileAtPoint(point.x, point.z);
      const cx = Math.floor(point.x / CHUNK_SIZE);
      const cz = Math.floor(point.z / CHUNK_SIZE);
      const clearings = monumentsAroundChunk(monuments, cx, cz).map((m) => ({ x: m.x, z: m.z, radius: MONUMENT_CLEARING }));
      const props = propsInChunk(terrain, cx, cz, clearings);
      const sample = { label, stage, region: region.id, x: point.x, z: point.z, biome: tile.biome, props: props.length, sighting: sightings(region) !== null };
      if (checkGeometry) {
        const chunk = buildChunk(terrain, cx, cz, () => 0, monuments);
        let triangles = 0;
        try {
          chunk.applyVitality(() => 1);
          chunk.object.traverse((object) => {
            const mesh = object as Mesh;
            if (!mesh.isMesh) return;
            const geometry = mesh.geometry;
            const position = geometry.getAttribute("position");
            triangles += (geometry.index?.count ?? position.count) / 3;
            if (!position.array.every(Number.isFinite)) issue("invalid-mesh", label, point);
            const life = geometry.getAttribute("aLife");
            if (life && !life.array.every((value) => value === 1)) issue("incomplete-mesh-restoration", label, point);
          });
          if (triangles === 0) issue("missing-terrain-mesh", label, point);
        } finally {
          chunk.dispose();
        }
        cases.visits.push({ ...sample, triangles });
      } else {
        cases.visits.push(sample);
      }
      if (!Number.isFinite(terrain.groundAt(point.x, point.z))) issue("invalid-height", label, point);
      if (blockerAt(terrain, capabilitiesForCount(stage), point.x, point.z)) issue("blocked-arrival", label, point);
      if (obstacles.near(point.x, point.z, PLAYER_RADIUS).some((o) => Math.hypot(point.x - o.x, point.z - o.z) < o.r + PLAYER_RADIUS - 1e-8)) issue("solid-arrival", label, point);
    };
    let state = newGame(seed);
    const reachByGear = new Map<number, Set<string>>();
    const reachedAt: Map<string, number> = new Map();
    for (const region of world.landmarks) {
      const stage = state.restored.size;
      const caps = capabilitiesOf(state, world);
      let reached = reachByGear.get(caps.size);
      if (!reached) {
        reached = new Set(reachableRegions(world, caps, LANDMARK_WINDOW).map((r) => r.id));
        reachByGear.set(caps.size, reached);
        for (const id of reached) if (!reachedAt.has(id)) reachedAt.set(id, stage);
      }
      const label = region.landmark!.id;
      const point = standPoint(region);
      visit(label, region, stage, point);
      if (shrineInReach(terrain, point)?.id !== region.id) issue("interaction-out-of-reach", label, point);
      if (!reached.has(region.id)) issue("region-unreachable", label, point);
      if (!hasExit(terrain, obstacles, region, capabilitiesForCount(landmarksBeforeAct(region.landmark!.act)), point)) issue("no-local-exit", label, point);
      state = restoreShrine(state, region);
      const expected = CAPABILITIES.filter((cap) => CAPABILITY_THRESHOLDS[cap] <= stage + 1);
      if (expected.some((cap) => !capabilitiesOf(state, world).has(cap)) || capabilitiesOf(state, world).size !== expected.length) issue("wrong-unlock", label);
      if (expected.length !== caps.size || stage + 1 === PILGRIMS_WAKE_STARS || stage + 1 === world.landmarks.length) {
        const reloaded = deserialize(serialize(state), world);
        if (reloaded.restored.size !== state.restored.size || capabilitiesOf(reloaded, world).size !== expected.length) issue("save-progression", label);
      }
    }
    const haiku = monumentSpecs.filter((spec) => spec.kind === "haiku");
    for (const spec of haiku) {
      const stone = monuments.byId(spec.id);
      if (!stone?.scene) issue("missing-scene", spec.id);
      if (!stone) continue;
      const region = world.regionById(stone.regionId);
      if (spec.landmark && spec.landmark !== region.landmark?.id) issue("wrong-landmark-haiku", spec.id, { x: stone.x, z: stone.z });
      if (!spec.landmark && spec.biome !== region.biome) issue("wrong-biome-haiku", spec.id, { x: stone.x, z: stone.z });
    }
    const haikuOrder = haiku.map((spec) => ({ spec, order: rng.next() })).sort((a, b) => a.order - b.order);
    for (const { spec } of haikuOrder.slice(0, 24)) {
      const stone = monuments.byId(spec.id)!;
      const region = world.regionById(stone.regionId);
      const requirement = BIOME_REQUIRES[region.biome];
      const stage = reachedAt.get(region.id) ?? (requirement ? CAPABILITY_THRESHOLDS[requirement] : 0);
      const caps = capabilitiesForCount(stage);
      const candidates = DIRECTIONS.map(({ x, z }) => ({ x: stone.x + x * 1.3, z: stone.z + z * 1.3 }));
      const point = candidates.find(({ x, z }) => blockerAt(terrain, caps, x, z) === null && obstacles.near(x, z, PLAYER_RADIUS).length === 0) ?? candidates[0]!;
      visit(`haiku:${stone.scene}`, region, stage, point);
      const before = newGame(seed);
      if (monumentInReach(monuments, point)?.id !== stone.id || isLegible(before, stone) || !isLegible(restoreShrine(before, region), stone)) issue("rubbing-interaction", spec.id, point);
    }
    for (const [i, biome] of [...BIOMES, "meadow" as const].entries()) {
      const matching = [...reachedAt].map(([id]) => world.regionById(id)).filter((r) => !r.landmark && r.biome === biome);
      const field = i === BIOMES.length ? world.region(0, 0) : rng.pick(matching);
      const stage = reachedAt.get(field.id) ?? 0;
      const point = standPoint(field);
      visit(`shrine:${i}:${biome}`, field, stage, point);
      if (!canApproachShrine(terrain, obstacles, field, capabilitiesForCount(stage), point)) issue("interaction-out-of-reach", field.id, point);
    }
    // Exercise vessel planners on actual water-to-land and lake-to-sea seams.
    for (const biome of ["water", "sea"] as const) {
      const cap = BIOME_REQUIRES[biome]!;
      const caps = capabilitiesForCount(CAPABILITY_THRESHOLDS[cap]);
      const opposite = [...reachedAt.keys()].map((id) => world.regionById(id));
      let launches = 0;
      for (const wet of opposite.filter((r) => !r.landmark && r.biome === biome)) {
        for (const [dx, dz] of CARDINAL) {
          const dry = world.region(wet.coord.rx + dx, wet.coord.rz + dz);
          if (dry.biome === biome || (biome === "water" && isWater(dry.biome)) || (BIOME_REQUIRES[dry.biome] && !caps.has(BIOME_REQUIRES[dry.biome]!))) continue;
          const len = Math.hypot(wet.site.x - dry.site.x, wet.site.z - dry.site.z);
          const dir = { x: (wet.site.x - dry.site.x) / len, z: (wet.site.z - dry.site.z) / len };
          let from = dry.site;
          for (let d = 1; d < len; d++) {
            const current = { x: dry.site.x + dir.x * d, z: dry.site.z + dir.z * d };
            if (terrain.tileAtPoint(current.x, current.z).biome !== biome) { from = current; continue; }
            const entry = movePlayer(from, dir, 1 / PLAYER_SPEED, terrain, caps, obstacles).pos;
            if (terrain.tileAtPoint(entry.x, entry.z).biome !== biome || blockerAt(terrain, caps, entry.x, entry.z)) break;
            const label = `${dry.biome}->${biome}`;
            if (biome === "sea") {
              const path = planShipLaunch(terrain, caps, obstacles, from, entry);
              const frame = shipLaunchFrame(path, SHIP_LAUNCH_SECONDS);
              if (terrain.tileAtPoint(frame.rider.x, frame.rider.z).biome !== biome) issue("launch-lands-on-wrong-biome", label, entry);
              if (terrain.tileAtPoint(path.approach.x, path.approach.z).biome !== biome) issue("ship-approach-through-lake", label, entry);
            } else {
              const path = planBoatLaunch(terrain, caps, obstacles, from, entry);
              if (terrain.tileAtPoint(path.afloat.x, path.afloat.z).biome !== biome) issue("launch-lands-on-wrong-biome", label, entry);
            }
            launches++;
            break;
          }
        }
        if (launches >= 12) break;
      }
    }
  }
  const counts: Record<string, number> = {};
  for (const run of report) for (const { kind } of run.issues) counts[kind] = (counts[kind] ?? 0) + 1;
  if (process.env.QUALITY_REPORT) writeFileSync(process.env.QUALITY_REPORT, JSON.stringify({ counts, worlds: report }));
  console.log(JSON.stringify({ counts, worlds: report.length, visits: report.reduce((sum, run) => sum + run.visits.length, 0) }));
  for (const run of report) {
    expect(run.visits, run.seed).toHaveLength(100);
    expect(new Set(run.visits.map(({ x, z }) => `${x},${z}`)).size, run.seed).toBe(100);
    expect(run.issues, run.seed).toEqual([]);
  }
}, 1_800_000);
