import * as THREE from "three";
import type { Monument } from "../world";
import { Kind, ParticleLayer } from "./particles";

/** Per monument: one soft halo and several rising motes. */
const MOTES = 5;
const PER_MONUMENT = 1 + 2 * MOTES;
const MAX_MONUMENTS = 8;
/** Violet, drawn with normal blending (additive washes out to white on light ground), so it cannot be mistaken for the warm gold and green of living land. */
const GLIMMER = new THREE.Color(0x8a4fff);

/**
 * A faint rising glimmer over monuments that have not been read yet, so that an
 * explorer who comes within sight of one notices it. Drawn only for the monuments
 * handed in each frame (those on screen), so there is no compass and no map marker.
 */
export interface Glimmer {
  update(clock: number, pixelScale: number, monuments: readonly Monument[], heightAt: (m: Monument) => number): void;
  dispose(): void;
}

export function createGlimmer(scene: THREE.Scene): Glimmer {
  const layer = new ParticleLayer(MAX_MONUMENTS * PER_MONUMENT, false);
  scene.add(layer.points);
  for (const p of layer.particles) {
    p.kind = Kind.Spark;
    p.maxAge = 1;
    [p.r, p.g, p.b] = [GLIMMER.r, GLIMMER.g, GLIMMER.b];
    p.alpha = 1;
  }
  return {
    update(clock, pixelScale, monuments, heightAt) {
      layer.particles.forEach((p, i) => {
        const m = monuments[Math.floor(i / PER_MONUMENT)];
        p.active = m !== undefined;
        if (!m) return;
        const slot = i % PER_MONUMENT;
        if (slot === 0) {
          // A slow-breathing halo around the top of the stone, so it reads from across the screen.
          p.age = 0.5 * p.maxAge;
          p.x = m.x;
          p.z = m.z;
          p.y = heightAt(m) + 1.3;
          p.size = 34 + 5 * Math.sin(clock * 1.3 + m.variant * 6);
          p.alpha = 0.3;
          return;
        }
        // Slots 1..MOTES are the bright cores; the next MOTES are wide soft halos on the same paths, which give the glow.
        const isHalo = slot > MOTES;
        const k = (isHalo ? slot - MOTES : slot) - 1;
        // Motes circle the top of the stone in a slow ring, twinkling in turn: a different
        // motion from the drifting fireflies and the rising sparks of living land.
        const angle = clock * 0.8 + (k / MOTES) * Math.PI * 2;
        p.age = 0.5;
        p.x = m.x + Math.cos(angle) * 0.75;
        p.z = m.z + Math.sin(angle) * 0.75;
        p.y = heightAt(m) + 1.5 + Math.sin(angle * 2 + m.variant * 6) * 0.25;
        const twinkle = Math.max(0, Math.sin(clock * 2.4 + k * 1.7));
        p.size = (12 + 6 * twinkle) * (isHalo ? 2.6 : 1);
        p.alpha = isHalo ? 0.3 + 0.2 * twinkle : 0.75 + 0.25 * twinkle;
      });
      layer.flush(pixelScale);
    },
    dispose() {
      scene.remove(layer.points);
      layer.dispose();
    },
  };
}
