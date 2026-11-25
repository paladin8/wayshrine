import { describe, expect, it } from "vitest";
import type { Species } from "./animal-models";
import { swimMotion, wildlifeMotion } from "./wildlife-motion";

function observe(species: Species, radius: number) {
  const speeds = Array.from({ length: 600 }, (_, i) => wildlifeMotion(species, i * 0.05, radius).speed);
  return {
    peak: Math.max(...speeds),
    bursts: speeds.filter((speed, i) => speed > 0.1 && (speeds[i - 1] ?? 0) <= 0.1).length,
    active: speeds.filter(speed => speed > 0.1).length / speeds.length,
  };
}

describe("large wildlife movement", () => {
  it("distinguishes lazy grazing, frequent fox dashes, and infrequent boar charges", () => {
    const deer = observe("deer", 1.7);
    const fox = observe("fox", 2.35);
    const boar = observe("boar", 2.55);
    expect(deer.peak).toBeLessThan(0.75);
    expect(fox.peak).toBeGreaterThan(deer.peak * 4);
    expect(fox.bursts).toBeGreaterThan(boar.bursts * 2);
    expect(boar.peak).toBeGreaterThan(3);
    expect(boar.active).toBeLessThan(deer.active * 0.6);
  });

  it("keeps stride distance continuous between movement cycles", () => {
    for (const species of ["deer", "fox", "boar", "serow", "crane"] as const) {
      let previous = 0;
      for (let i = 0; i < 1200; i++) {
        const motion = wildlifeMotion(species, i * 0.05, 1.7);
        expect(motion.angle - previous).toBeGreaterThanOrEqual(0);
        expect(motion.angle - previous).toBeLessThan(0.12);
        previous = motion.angle;
      }
    }
  });

  it("keeps otters near the surface, dolphins leaping, and whales diving between breaths", () => {
    const samples = (species: Species) => Array.from({ length: 640 }, (_, i) => swimMotion(species, i * 0.05));
    const otter = samples("otter");
    const dolphin = samples("dolphin");
    const whale = samples("whale");
    expect(Math.min(...otter.map(pose => pose.lift))).toBeGreaterThan(-0.21);
    expect(Math.max(...dolphin.map(pose => pose.lift))).toBeGreaterThan(0.75);
    expect(Math.min(...whale.map(pose => pose.lift))).toBeLessThan(-0.8);
    expect(whale.filter(pose => pose.blow > 0).length).toBeLessThan(whale.length / 7);
    expect(whale.some(pose => pose.blow > 0.9)).toBe(true);
  });

  it("keeps a dolphin's leap to a short arc: under a second and a half out of the water, and a few between leaps", () => {
    const step = 0.02;
    const lifts = Array.from({ length: 2000 }, (_, i) => swimMotion("dolphin", i * step).lift);
    const flights: number[] = [];
    let run = 0;
    for (const lift of lifts) {
      if (lift > -0.1) run++;
      else if (run) { flights.push(run * step); run = 0; }
    }
    expect(flights.length).toBeGreaterThan(4);
    for (const flight of flights) {
      expect(flight).toBeGreaterThan(0.6);
      expect(flight).toBeLessThan(1.2);
    }
    // Nose up leaving the water, nose down coming back.
    const rising = swimMotion("dolphin", 2.4 - 0.35 * 6.6 / (Math.PI * 2) + 0.15);
    const falling = swimMotion("dolphin", 2.4 - 0.35 * 6.6 / (Math.PI * 2) + 0.95);
    expect(rising.pitch).toBeLessThan(0);
    expect(falling.pitch).toBeGreaterThan(0);
  });
});
