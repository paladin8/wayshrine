import * as THREE from "three";
import type { Monument } from "../world";
import { Kind, ParticleLayer } from "./particles";

/** Per monument: one soft halo and several rising motes. */
const MOTES = 5;
const PER_MONUMENT = 1 + 3 * MOTES;
const MAX_MONUMENTS = 8;
/** Violet, drawn with normal blending (additive washes out to white on light ground), so it cannot be mistaken for the warm gold and green of living land. */
const GLIMMER = new THREE.Color(0x7a3cff);
const DEEP = new THREE.Color(0x5a1fd8);
const CORE = new THREE.Color(0xf4eeff);

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
          [p.r, p.g, p.b] = [DEEP.r, DEEP.g, DEEP.b];
          p.alpha = 0.3;
          return;
        }
        // Each mote is three stacked layers, drawn in order: a wide deep-violet halo, a violet body,
        // and a small near-white core, which together read as a glow fading from white to deep violet.
        const layer3 = Math.floor((slot - 1) / MOTES); // 0 halo, 1 body, 2 core
        const k = (slot - 1) % MOTES;
        const angle = clock * 0.8 + (k / MOTES) * Math.PI * 2;
        p.age = 0.5;
        p.x = m.x + Math.cos(angle) * 0.75;
        p.z = m.z + Math.sin(angle) * 0.75;
        p.y = heightAt(m) + 1.5 + Math.sin(angle * 2 + m.variant * 6) * 0.25;
        const twinkle = Math.max(0, Math.sin(clock * 2.4 + k * 1.7));
        const base = 12 + 6 * twinkle;
        const c = layer3 === 0 ? DEEP : layer3 === 1 ? GLIMMER : CORE;
        [p.r, p.g, p.b] = [c.r, c.g, c.b];
        p.size = base * (layer3 === 0 ? 3 : layer3 === 1 ? 1.4 : 0.7);
        p.alpha = layer3 === 0 ? 0.35 + 0.25 * twinkle : layer3 === 1 ? 0.85 : 0.7 + 0.3 * twinkle;
      });
      layer.flush(pixelScale);
    },
    dispose() {
      scene.remove(layer.points);
      layer.dispose();
    },
  };
}
