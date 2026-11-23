import { Color } from "three";
import { createNoise, createRng } from "../core";
import type { Biome, Region, Terrain, Tile } from "../world";

import { PATTERNS_BY_BIOME } from "./ground-patterns";

/** Three regional palettes each, from shaded ground through the base to highlights. */
const PALETTES = {
  meadow: [[0x526f3e, 0x86ad5f, 0xc0c77c], [0x536e4a, 0x799e60, 0xacbf85], [0x6a8047, 0x99b05c, 0xd0c383]],
  forest: [[0x142f29, 0x315342, 0x63734e], [0x1b332c, 0x355341, 0x718057], [0x182f31, 0x30524c, 0x607b57]],
  marsh: [[0x3c5044, 0x687c48, 0x9a9b60], [0x3b504e, 0x62754f, 0x96935d], [0x4f5140, 0x777d4b, 0xaaa16c]],
  volcanic: [[0x302930, 0x5a4141, 0x8f5747], [0x2c292c, 0x51474c, 0x97674d], [0x302727, 0x60433c, 0xa2704e]],
  water: [[0x286a7c, 0x479ea3, 0x7ac9bd], [0x2b7784, 0x52acb2, 0x8bd0c2], [0x316878, 0x479fa8, 0x8ac4ba]],
  sea: [[0x172f4d, 0x275577, 0x4986a0], [0x1a3453, 0x306585, 0x6096af], [0x1c324b, 0x2c5b75, 0x53949c]],
  snow: [[0x839bb3, 0xd5e2e9, 0xf2f5f5], [0x8b99b0, 0xd8dfe9, 0xf4f2eb], [0x7e9fa9, 0xd2e2e3, 0xf2f5f3]],
  mountain: [[0x514f58, 0x858181, 0xbeb0a0], [0x514f50, 0x8d837b, 0xc2ad91], [0x535964, 0x868a8b, 0xb8b8ae]],
  dunes: [[0x9f7d51, 0xdabc82, 0xead8aa], [0xaa8257, 0xd3ae7b, 0xe9d3a1], [0xa78757, 0xe0c188, 0xeee0b2]],
} satisfies Readonly<Record<Biome, readonly (readonly [number, number, number])[]>>;

interface ArtProfile {
  readonly palette: number;
  readonly angle: number;
  readonly scale: number;
  readonly phase: number;
  readonly density: number;
  readonly motif: (typeof PATTERNS_BY_BIOME)[Biome][number];
  readonly cos: number;
  readonly sin: number;
}

const colors = Object.fromEntries(Object.entries(PALETTES).map(([biome, palettes]) =>
  [biome, palettes.map((palette) => palette.map((hex) => new Color(hex)))]));
const lakeShallows = new Color(0x9acaba);
const seaShallows = new Color(0x64a3a0);
const poolWater = new Color(0x4b6b68);
const bogInk = new Color(0x3c5455);
const ochre = new Color(0xbb7656);
const ashSand = new Color(0x8b8168);
const lakeSand = new Color(0xd5c594);

export function createBiomeArt(terrain: Terrain) {
  const root = createRng(terrain.world.seed).fork("biome-art");
  const broad = createNoise(`${terrain.world.seed}:paint`);
  const fine = createNoise(`${terrain.world.seed}:patina`);
  const profiles = new WeakMap<Region, ArtProfile>();

  function profile(region: Region): ArtProfile {
    let art = profiles.get(region);
    if (!art) {
      const rng = root.fork(region.id);
      const palette = rng.int(0, 3);
      const angle = rng.range(0, Math.PI * 2);
      art = {
        palette, angle, scale: rng.range(7, 22), phase: rng.range(0, 12), density: rng.range(0.34, 1.72),
        motif: rng.pick(PATTERNS_BY_BIOME[region.biome]),
        cos: Math.cos(angle), sin: Math.sin(angle),
      };
      profiles.set(region, art);
    }
    return art;
  }

  function pattern(x: number, z: number, space: number): number {
    return broad(x / space, z / space) * 0.8 + fine(x / 3.7, z / 3.7) * 0.2;
  }

  function wetland(x: number, z: number, region: Region): number {
    const art = profile(region);
    const c = Math.cos(art.angle), s = Math.sin(art.angle);
    return broad((x * c + z * s) / (art.scale * 0.92), (z * c - x * s) / 5.9) * 0.86 + fine(x / 3.1, z / 3.1) * 0.14;
  }

  function ashSeam(x: number, z: number, region: Region): number {
    const art = profile(region);
    const across = -Math.sin(art.angle) * x + Math.cos(art.angle) * z;
    const wave = Math.sin(across * 0.39 + art.phase + 7.3 * pattern(x, z, art.scale));
    return Math.max(0, wave) ** 2.5;
  }

  function swell(x: number, z: number, region: Region): number {
    const art = profile(region);
    const direction = -0.65 + Math.sin(art.phase) * 0.42;
    const across = -Math.sin(direction) * x + Math.cos(direction) * z;
    return 0.5 + Math.sin(across * 0.65 + art.phase + pattern(x, z, 18) * 2.4) * 0.5;
  }

  function top(tx: number, tz: number, tile: Tile, region: Region): Color {
    const art = profile(region);
    const field = pattern(tx, tz, art.scale);
    const slope = Math.sin((tx * Math.cos(art.angle) + tz * Math.sin(art.angle)) * 0.23 + art.phase + field * 2.2);
    const shades = colors[tile.biome]![art.palette]!;
    let tone = field;
    switch (tile.biome) {
      case "water": tone = 0.38 + field * 0.23 + slope * 0.05; break;
      case "sea": tone = 0.22 + field * 0.38 + swell(tx, tz, region) * 0.095; break;
      case "marsh": tone = field < 0.47 ? field * 0.52 : field * 0.84 + 0.12; break;
      case "forest": tone = field ** 1.6; break;
      case "volcanic": tone = field * 0.78 + (slope > 0.62 ? 0.14 : 0); break;
      case "snow": tone = 0.43 + field * 0.47 + slope * 0.05; break;
      case "mountain": tone = field * 0.68 + (Math.floor(tile.height * 2.5) % 3) * 0.12; break;
      case "dunes": tone = 0.4 + field * 0.31 + slope * 0.15; break;
      case "meadow": tone = 0.25 + field * 0.55; break;
    }
    const c = tone < 0.5 ? shades[0]!.clone().lerp(shades[1]!, tone * 2) : shades[1]!.clone().lerp(shades[2]!, (tone - 0.5) * 2);
    if (tile.biome === "marsh") {
      const wet = wetland(tx, tz, region);
      // Some regions open into broad flooded channels, others break into small pools.
      const waterline = [0.44, 0.49, 0.52][art.palette]!;
      const pool = Math.max(0, Math.min(1, (wet - waterline) * 7));
      c.lerp(wet > 0.73 ? bogInk : poolWater, pool * 0.94);
    }
    if (tile.biome === "volcanic") {
      const seam = ashSeam(tx, tz, region);
      const ember = Math.max(0, (seam - 0.68) / 0.32) ** 1.8 * (field > 0.49 ? 0.44 : 0.13);
      c.lerp(bogInk, seam * 0.095).lerp(ochre, ember);
    }
    if (tile.biome === region.biome) {
      const { cos, sin, motif } = art;
      const dx = tx - region.site.x;
      const dz = tz - region.site.z;
      const spacing = (tile.biome === "water" || tile.biome === "sea" ? 11 : 5) + art.scale * 0.39;
      const u = (dx * cos + dz * sin) / spacing;
      const v = (dz * cos - dx * sin) / spacing;
      const fade = Math.max(0, Math.min(1, 2.5 - Math.hypot(dx, dz) / 20));
      c.lerp(motif.color, motif.field(u, v, field) * motif.strength * fade);
    }
    if (tile.shoal) c.lerp(tile.biome === "sea" ? seaShallows : lakeShallows, tile.shoal * 0.86);
    if (tile.biome === "meadow" && (region.biome === "water" || region.biome === "sea")) {
      c.lerp(region.biome === "sea" ? ashSand : lakeSand, Math.min(0.95, Math.max(0, 1.16 - tile.height) * 1.6));
    }
    const jitter = (((tx * 73856093) ^ (tz * 19349663)) & 7) / 7;
    return c.offsetHSL(0, 0, (jitter - 0.5) * 0.016);
  }

  return { profile, pattern, top, wetland, ashSeam, swell };
}

const cache = new WeakMap<Terrain, ReturnType<typeof createBiomeArt>>();
export function biomeArt(terrain: Terrain): ReturnType<typeof createBiomeArt> {
  let art = cache.get(terrain);
  if (!art) {
    art = createBiomeArt(terrain);
    cache.set(terrain, art);
  }
  return art;
}
