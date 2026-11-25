import * as THREE from "three";
import { createRng, type Rng } from "../core";
import { CHUNK_SIZE, MONUMENT_CLEARING, plateauDistance, type Monument, type Terrain } from "../world";
import { biomeArt } from "./biome-art";
import { meshFromData, VitalityBuilder, type MeshData, type Motion, type VitalityMesh } from "./vitality-mesh";

type V = readonly [number, number, number];

const COLORS = {
  poolLight: new THREE.Color(0x9fad88),
  reed: new THREE.Color(0x657d51),
  lily: new THREE.Color(0x88a663),
  duckweed: new THREE.Color(0x809462),
  lilyFlower: new THREE.Color(0xc9b5b2),
  fern: new THREE.Color(0x779968),
  fernCool: new THREE.Color(0x70908a),
  moss: new THREE.Color(0x677a4a),
  mushrooms: new THREE.Color(0x998174),
  bark: new THREE.Color(0x5d5142),
  ember: new THREE.Color(0xd68a53),
  mineral: new THREE.Color(0x765e59),
  vent: new THREE.Color(0x504553),
  chalk: new THREE.Color(0xbcb0a7),
  powder: new THREE.Color(0xb7cbd8),
  grass: new THREE.Color(0x9dab66),
  petals: new THREE.Color(0xd5ae77),
  sand: new THREE.Color(0xc6a876),
  lake: new THREE.Color(0x80c0bb),
  lakeBright: new THREE.Color(0xacd1c6),
  offshore: new THREE.Color(0x527f9b),
  foam: new THREE.Color(0x8eacba),
};

const TAU = Math.PI * 2;

/** Render-only brushwork. Marks are batched into the restoration mesh and carry no collision. */
export function buildBiomeDetails(
  terrain: Terrain, cx: number, cz: number, vitalityOf: (id: string) => number, monuments: readonly Monument[],
): VitalityMesh | null {
  const data = biomeDetailData(terrain, cx, cz, monuments);
  return data ? meshFromData(data, vitalityOf) : null;
}

/** The brushwork of one chunk as plain data (it casts no shadow), or null if there is none. */
export function biomeDetailData(
  terrain: Terrain, cx: number, cz: number, monuments: readonly Monument[],
): MeshData | null {
  const builder = new VitalityBuilder((id) => terrain.world.regionById(id).shrine);
  const art = biomeArt(terrain);
  const rng = createRng(terrain.world.seed).fork(`brushwork:${cx},${cz}`);
  const x0 = cx * CHUNK_SIZE, z0 = cz * CHUNK_SIZE;

  for (let iz = 1; iz < CHUNK_SIZE; iz += 3) {
    for (let ix = 1; ix < CHUNK_SIZE; ix += 3) {
      const x = x0 + ix + rng.range(-0.75, 0.75);
      const z = z0 + iz + rng.range(-0.75, 0.75);
      const tile = terrain.tileAtPoint(x, z);
      if (tile.ginzanSurface) continue;
      if (tile.tokyoSurface === "street" || tile.tokyoSurface === "sidewalk") continue;
      const { biome, regionId } = tile;
      const region = terrain.world.regionById(regionId);
      const profile = art.profile(region);
      if (tile.skirt || plateauDistance(region, x, z) < 2 || monuments.some(m => Math.hypot(m.x - x, m.z - z) < MONUMENT_CLEARING + 0.4)) continue;
      const field = art.pattern(x, z, profile.scale);
      const density = profile.density;
      const y = tile.height + 0.024;
      const turn = rng.range(0, TAU);
      const paint = (positions: readonly V[], color: THREE.Color, motion?: Motion) =>
        builder.addTriangles(positions.flat(), color, regionId, motion);
      const grow = (height: number): Motion => ({ sway: { baseY: y, height }, bloomBase: y });
      const disc = (px: number, pz: number, rx: number, rz: number, color: THREE.Color, rise = 0.025): void => {
        const vertices: V[] = [];
        for (let j = 0; j < 6; j++) {
          const a = j * TAU / 6 + turn;
          const b = (j + 1) * TAU / 6 + turn;
          vertices.push([px, y + rise, pz], [px + Math.cos(b) * rx, y + rise, pz + Math.sin(b) * rz], [px + Math.cos(a) * rx, y + rise, pz + Math.sin(a) * rz]);
        }
        paint(vertices, color, { bloomBase: y });
      };
      const strip = (length: number, width: number, angle: number, height: number, color: THREE.Color, water?: "water" | "sea"): void => {
        const dx = Math.cos(angle), dz = Math.sin(angle);
        const edge: V[] = [];
        for (let j = 0; j < 5; j++) {
          const t = (j - 2) / 2;
          const offset = width * 0.7 * Math.sin(t * 2.35);
          const px = x + dx * length * t - dz * offset;
          const pz = z + dz * length * t + dx * offset;
          const w = width * (0.12 + 0.88 * (1 - t * t));
          const sample = terrain.tileAtPoint(px, pz);
          if (sample.biome !== biome || sample.regionId !== regionId || sample.skirt || plateauDistance(region, px, pz) < 1) return;
          const py = sample.height + height;
          edge.push([px - dz * w, py, pz + dx * w], [px + dz * w, py, pz - dx * w]);
        }
        const vertices: V[] = [];
        for (let j = 0; j < 8; j += 2) vertices.push(edge[j]!, edge[j + 2]!, edge[j + 1]!, edge[j + 1]!, edge[j + 2]!, edge[j + 3]!);
        paint(vertices, color, water ? { water } : undefined);
      };

      switch (biome) {
        case "forest":
          if (field > 0.42 && rng.chance(density * 0.71)) {
            const leaves = profile.palette === 2 ? COLORS.fernCool : COLORS.fern;
            blades(rng, x, y, z, turn, 6, rng.range(0.38, 0.71), rng.range(0.73, 1.17), (v) => paint(v, leaves, grow(0.45)));
            if (rng.chance(0.42)) {
              disc(x + 0.16, z - 0.22, 0.15, 0.13, COLORS.mushrooms, 0.13);
              disc(x + 0.31, z - 0.36, 0.10, 0.09, COLORS.mushrooms, 0.09);
            }
          } else if (field < 0.37 && rng.chance(0.37)) {
            strip(rng.range(0.55, 1.4), 0.09, turn, 0.085, COLORS.bark);
            disc(x - 0.32, z + 0.24, 0.33, 0.22, COLORS.moss);
          }
          break;
        case "marsh": {
          const wet = art.wetland(x, z, region);
          if (wet > 0.61) {
            if (rng.chance(density * 0.79)) {
              disc(x, z, rng.range(0.27, 0.46), rng.range(0.26, 0.45), COLORS.lily);
              if (profile.palette !== 1) disc(x + 0.37, z + 0.23, 0.20, 0.18, COLORS.duckweed);
              if (rng.chance(0.39)) disc(x + 0.15, z - 0.08, 0.12, 0.115, COLORS.lilyFlower);
            }
            if (rng.chance(0.45)) strip(rng.range(0.25, 1.0), 0.025, profile.angle, 0.029, COLORS.poolLight);
          } else if (wet > 0.36 && rng.chance(density * 1.12)) {
            blades(rng, x, y, z, turn, 5, rng.range(0.52, 1.09), 0.59, (v) => paint(v, COLORS.reed, grow(0.85)));
          }
          break;
        }
        case "volcanic": {
          const seam = art.ashSeam(x, z, region);
          if (seam > 0.59 && rng.chance(0.48 + 0.22 * density)) {
            strip(rng.range(0.65, 1.57), 0.11, profile.angle, 0.042, COLORS.mineral);
            if (seam > 0.73) strip(rng.range(0.34, 0.86), rng.range(0.024, 0.06), profile.angle + 0.22, 0.061, COLORS.ember);
            if (seam > 0.88 && field > 0.56 && rng.chance(0.34)) {
              for (let k = 0; k < 6; k++) {
                const a = k * TAU / 6, b = (k + 1) * TAU / 6;
                const point = (ang: number, r: number, h: number): V => [x + Math.cos(ang) * r, y + h, z + Math.sin(ang) * r];
                const lowerA = point(a, 0.46, 0), lowerB = point(b, 0.46, 0);
                const topA = point(a, 0.24, 0.25), topB = point(b, 0.24, 0.25);
                paint([lowerA, topA, lowerB, topA, topB, lowerB], COLORS.vent);
              }
              disc(x, z, 0.23, 0.23, COLORS.mineral, 0.243);
            }
          }
          break;
        }
        case "water":
          if (rng.chance(density * (field < 0.54 ? 0.19 : 0.58))) {
            strip(rng.range(0.35, 1.12), rng.range(0.026, 0.061), -0.76 + Math.sin(profile.phase) * 0.26, 0.045, tile.shoal ? COLORS.lakeBright : COLORS.lake, "water");
          }
          break;
        case "sea":
          const swell = art.swell(x, z, region);
          if (swell > 0.42 && rng.chance(density * 0.58)) {
            const breaker = Boolean(tile.shoal) || (swell > 0.83 && field > 0.43);
            strip(rng.range(1.02, breaker ? 2.45 : 1.95), rng.range(0.045, breaker ? 0.13 : 0.084),
              -0.65 + Math.sin(profile.phase) * 0.42, 0.071, breaker ? COLORS.foam : COLORS.offshore, "sea");
          }
          break;
        case "meadow":
          if (field > 0.51 && rng.chance(density * 0.49)) {
            blades(rng, x, y, z, turn, 4, rng.range(0.21, 0.42), 0.42, (v) => paint(v, COLORS.grass, grow(0.4)));
            if (field > 0.64 && rng.chance(0.49)) disc(x + 0.16, z + 0.1, 0.19, 0.12, COLORS.petals);
          }
          break;
        case "snow":
          if (field < 0.53 && rng.chance(density * 0.43)) strip(rng.range(0.5, 1.38), 0.10, profile.angle, 0.035, COLORS.powder);
          break;
        case "mountain":
          if (field > 0.42 && rng.chance(density * 0.46)) strip(rng.range(0.45, 1.1), 0.12, profile.angle, 0.036, COLORS.chalk);
          break;
        case "dunes":
          if (rng.chance(density * 0.56)) strip(rng.range(0.65, 1.28), 0.063, profile.angle - 0.7, 0.040, COLORS.sand);
          break;
      }
    }
  }
  return builder.finish(false);
}

/** A loose radial fan of faceted leaves. Their stems are sunk during restoration. */
function blades(rng: Rng, x: number, y: number, z: number, turn: number, total: number, height: number, spread: number, add: (v: V[]) => void): void {
  for (let j = 0; j < total; j++) {
    const ang = turn + j * TAU / total + rng.range(-0.17, 0.17);
    const dx = Math.cos(ang), dz = Math.sin(ang);
    const reach = spread * rng.range(0.56, 1.12);
    const h = height * rng.range(0.65, 1.2);
    const width = reach * 0.13;
    const base: V = [x + dx * 0.035, y, z + dz * 0.035];
    const mid: V = [x + dx * reach * 0.51, y + h, z + dz * reach * 0.51];
    const right: V = [mid[0] + dz * width, mid[1] - 0.055, mid[2] - dx * width];
    const left: V = [mid[0] - dz * width, mid[1] - 0.055, mid[2] + dx * width];
    const tip: V = [x + dx * reach, y + h * 0.71, z + dz * reach];
    add([base, mid, right, base, left, mid, mid, tip, right, left, tip, mid]);
  }
}
