import * as THREE from "three";
import type { Monument } from "../world";
import { Kind, ParticleLayer } from "./particles";

/** Per monument: one soft halo and several rising motes. */
const MOTES = 5;
const PER_MONUMENT = MOTES + 1;
const MAX_MONUMENTS = 8;
/** Cool violet-white, so it cannot be mistaken for the warm gold and green of living land. */
const GLIMMER = new THREE.Color(0xa9b8ff);

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
  const layer = new ParticleLayer(MAX_MONUMENTS * PER_MONUMENT, true);
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
          p.size = 30 + 5 * Math.sin(clock * 1.3 + m.variant * 6);
          p.alpha = 0.3;
          return;
        }
        p.alpha = 1;
        const k = slot - 1;
        // Motes circle the top of the stone in a slow ring, twinkling in turn: a different
        // motion from the drifting fireflies and the rising sparks of living land.
        const angle = clock * 0.8 + (k / MOTES) * Math.PI * 2;
        p.age = 0.5;
        p.x = m.x + Math.cos(angle) * 0.75;
        p.z = m.z + Math.sin(angle) * 0.75;
        p.y = heightAt(m) + 1.5 + Math.sin(angle * 2 + m.variant * 6) * 0.25;
        p.size = 8 + 5 * Math.max(0, Math.sin(clock * 2.4 + k * 1.7));
        p.alpha = 0.5 + 0.5 * Math.max(0, Math.sin(clock * 2.4 + k * 1.7));
      });
      layer.flush(pixelScale);
    },
    dispose() {
      scene.remove(layer.points);
      layer.dispose();
    },
  };
}
