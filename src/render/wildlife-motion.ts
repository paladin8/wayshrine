import type { Species } from "./animal-models";

const TAU = Math.PI * 2;

interface Rhythm {
  readonly period: number;
  readonly start: number;
  readonly duration: number;
  readonly turn: number;
  readonly drift: number;
  readonly stride: number;
  readonly fullGait: number;
}

const RHYTHMS: Readonly<Record<Species, Rhythm>> = {
  deer:    { period: 13,  start: 2.4, duration: 3.9, turn: 0.92, drift: 0,    stride: 0.64, fullGait: 0.8 },
  fox:     { period: 3.4, start: 0.5, duration: 1.38, turn: 1.52, drift: 0,   stride: 0.95, fullGait: 3.7 },
  boar:    { period: 14,  start: 5.1, duration: 1.52, turn: 1.78, drift: 0,   stride: 0.76, fullGait: 3.5 },
  serow:   { period: 7.7, start: 1.8, duration: 2.50, turn: 1.02, drift: 0,   stride: 0.65, fullGait: 1.25 },
  crane:   { period: 9.1, start: 2.1, duration: 2.70, turn: 0.65, drift: 0,   stride: 0.46, fullGait: 0.55 },
  otter:   { period: 6.0, start: 1.6, duration: 1.55, turn: 0.76, drift: 0.11, stride: 0.61, fullGait: 2.5 },
  dolphin: { period: 6.6, start: 0.6, duration: 2.20, turn: 0.85, drift: 0.62, stride: 1.72, fullGait: 5.9 },
  whale:   { period: 16,  start: 1.4, duration: 4.80, turn: 0.39, drift: 0.19, stride: 3.9, fullGait: 2.3 },
};

const ease = (t: number): number => t * t * (3 - 2 * t);

/** Phase comes from distance traveled, so the feet settle when the animal stops. */
export function wildlifeMotion(species: Species, time: number, radius: number) {
  const { period, start, duration, turn, drift, stride, fullGait } = RHYTHMS[species];
  const cycles = Math.floor(time / period);
  const local = time - cycles * period;
  const step = Math.max(0, Math.min(1, (local - start) / duration));
  const angle = time * drift + (cycles + ease(step)) * turn;
  const speed = (drift + 6 * step * (1 - step) * turn / duration) * radius;
  const gait = Math.min(1, speed / fullGait);
  const phase = angle * radius * TAU / stride;
  return { angle, speed, gait, phase };
}

export function swimMotion(species: Species, t: number) {
  if (species === "whale") {
    const surfacing = (0.5 + 0.5 * Math.sin(t * TAU / 15 + 0.95)) ** 2;
    return { lift: -0.83 + surfacing * 1.24, pitch: -Math.cos(t * TAU / 15 + 0.95) * 0.19, blow: Math.max(0, (surfacing - 0.96) / 0.04) };
  }
  if (species === "dolphin") {
    const phase = t * TAU / 6.6 + 0.35;
    const leap = Math.max(0, Math.sin(phase)) ** 1.6;
    return { lift: -0.36 + leap * 1.17, pitch: -Math.cos(phase) * leap * 0.72, blow: 0 };
  }
  const roll = Math.sin(t * TAU / 6 + 0.45);
  return { lift: 0.025 - Math.max(0, -roll) ** 5 * 0.22, pitch: Math.cos(t * 2) * 0.08, blow: 0 };
}
