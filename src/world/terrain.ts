/**
 * Terrain classes and the abilities that open them up.
 *
 * The player starts able to walk on meadow only. Every other biome requires a
 * capability, unlocked by restoring a number of landmarks (see landmarks.ts).
 */

/** Abilities in the order landmarks unlock them. */
export const CAPABILITIES = ["boat", "snowshoes", "climbing"] as const;
export type Capability = (typeof CAPABILITIES)[number];

export const BIOMES = ["meadow", "water", "snow", "mountain"] as const;
export type Biome = (typeof BIOMES)[number];

/** The capability needed to traverse each biome; null means walkable from the start. */
export const BIOME_REQUIRES: Readonly<Record<Biome, Capability | null>> = {
  meadow: null,
  water: "boat",
  snow: "snowshoes",
  mountain: "climbing",
};

export function biomeRequiring(capability: Capability): Biome {
  const biome = BIOMES.find((b) => BIOME_REQUIRES[b] === capability);
  if (!biome) throw new Error(`no biome requires ${capability}`);
  return biome;
}

export function canTraverse(biome: Biome, capabilities: ReadonlySet<Capability>): boolean {
  const needed = BIOME_REQUIRES[biome];
  return needed === null || capabilities.has(needed);
}
