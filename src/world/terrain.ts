/**
 * Terrain classes and the abilities that open them up.
 *
 * The player starts able to walk on meadow only. Every other biome requires a
 * capability, unlocked by restoring a number of landmarks (see landmarks.ts).
 */

/** Abilities in the order landmarks unlock them. */
export const CAPABILITIES = ["boat", "snowshoes", "climbing", "geta", "lantern", "ashSandals", "ship"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const BIOMES = ["meadow", "water", "snow", "mountain", "marsh", "forest", "volcanic", "sea", "dunes"] as const;
export type Biome = (typeof BIOMES)[number];

/** The capability needed to traverse each biome; null means walkable from the start. */
export const BIOME_REQUIRES: Readonly<Record<Biome, Capability | null>> = {
  meadow: null,
  water: "boat",
  snow: "snowshoes",
  mountain: "climbing",
  marsh: "geta",
  forest: "lantern",
  volcanic: "ashSandals",
  sea: "ship",
  // Sand is walkable from the start: Tottori's dunes are a one-off landmark biome, not a gate.
  dunes: null,
};

/** Water (boat) and open sea (ship) are drawn, and shored up around landmarks, the same way. */
export function isWater(biome: Biome): boolean {
  return biome === "water" || biome === "sea";
}

export function biomeRequiring(capability: Capability): Biome {
  const biome = BIOMES.find((b) => BIOME_REQUIRES[b] === capability);
  if (!biome) throw new Error(`no biome requires ${capability}`);
  return biome;
}

export function canTraverse(biome: Biome, capabilities: ReadonlySet<Capability>): boolean {
  const needed = BIOME_REQUIRES[biome];
  return needed === null || capabilities.has(needed);
}
