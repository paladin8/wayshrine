import * as THREE from "three";
import type { Biome } from "../world";

interface Lighting {
  readonly sun: THREE.Color;
  readonly sky: THREE.Color;
  readonly ground: THREE.Color;
  readonly strength: number;
}

function light(sun: number, sky: number, ground: number, strength: number): Lighting {
  return { sun: new THREE.Color(sun), sky: new THREE.Color(sky), ground: new THREE.Color(ground), strength };
}

const DAYLIGHT = light(0xffffff, 0xffffff, 0xcfc4a8, 2.4);
const LIGHT: Partial<Record<Biome, Lighting>> = {
  forest: light(0xecf1da, 0xcbdde0, 0x97a88c, 2.03),
  marsh: light(0xf6ecca, 0xd6e0cd, 0xabb4a0, 2.15),
  volcanic: light(0xf6dfcb, 0xd8cbd1, 0xa69088, 2.37),
  sea: light(0xe7eff6, 0xe2eff5, 0x9da8b7, 2.37),
  snow: light(0xfdf8f0, 0xd9e7f4, 0xa1b7ca, 2.45),
  dunes: light(0xffeac7, 0xf0e9d8, 0xe4c497, 2.53),
};

/** Ease the scene's local light through a biome boundary with no new lights or draw calls. */
export function lightBiome(sun: THREE.DirectionalLight, fill: THREE.HemisphereLight, biome: Biome, dt: number): void {
  const target = LIGHT[biome] ?? DAYLIGHT;
  const amount = 1 - Math.exp(-dt * 1.5);
  sun.color.lerp(target.sun, amount);
  sun.intensity = THREE.MathUtils.lerp(sun.intensity, target.strength, amount);
  fill.color.lerp(target.sky, amount);
  fill.groundColor.lerp(target.ground, amount);
}
