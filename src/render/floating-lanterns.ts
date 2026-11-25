import * as THREE from "three";
import { landmarkWaterLevel } from "../world";
import { seaSwell } from "./landmark-effects";

/** Open channels around Matsushima's Godaido islet, in landmark-local coordinates. */
export const MATSUSHIMA_LANTERN_ANCHORS = [
  [-3.2, 5.8], [-1.8, 5.9], [-0.4, 7.2], [-0.7, 9.5], [1.7, 7.9],
  [3.2, 9.1], [3.9, 7.5], [4.7, 6.9], [5.2, 9.2], [7.3, 8.5], [-2.3, 1.5],
] as const;

const SEA_LEVEL = landmarkWaterLevel("sea")!;
const WARM_GLOW = new THREE.Color("#ffbd67");
const DRIFT = 0.28;

function waterGlow(geometry: THREE.PlaneGeometry) {
  const brightness = { value: 0 };
  const material = new THREE.ShaderMaterial({
    uniforms: { brightness, warmth: { value: WARM_GLOW } },
    vertexShader: `
      varying vec2 vRingUv;
      void main() {
        vRingUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 warmth;
      uniform float brightness;
      varying vec2 vRingUv;
      void main() {
        float radius = length((vRingUv - 0.5) * 2.0);
        float glow = max(0.0, 1.0 - radius);
        gl_FragColor = vec4(warmth, brightness * glow * glow);
        #include <colorspace_fragment>
      }
    `,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  return { mesh, brightness };
}

/** The title model's paper lanterns, afloat in the restored bay. */
export function buildMatsushimaLanterns(toro: THREE.Object3D) {
  const group = new THREE.Group();
  group.name = "Matsushima floating lanterns";
  group.visible = false;
  const surface = new THREE.PlaneGeometry(1.6, 1.45);
  const paper = new Set<THREE.MeshStandardMaterial>();
  toro.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material;
    if (material instanceof THREE.MeshStandardMaterial && material.name === "glow_cream") {
      material.emissive.copy(WARM_GLOW);
      paper.add(material);
    }
  });
  const lanterns = MATSUSHIMA_LANTERN_ANCHORS.map(([x, z], i) => {
    const lamp = i === 0 ? toro : toro.clone();
    lamp.name = "Floating paper lantern";
    lamp.rotation.y = i * 1.37;
    const glow = waterGlow(surface);
    group.add(lamp, glow.mesh);
    return { x, z, lamp, glow, phase: i * 1.79, size: 0.86 + (i % 4) * 0.07 };
  });
  const origin = new THREE.Vector3();
  return {
    group,
    update(time: number, life: number): void {
      const light = THREE.MathUtils.smoothstep(life, 0.55, 0.98);
      group.visible = light > 0;
      if (!group.visible) return;
      group.getWorldPosition(origin);
      for (const material of paper) material.emissiveIntensity = light * (0.66 + 0.08 * Math.sin(time * 4.2));
      for (const { x, z, lamp, glow, phase, size } of lanterns) {
        const px = x + Math.sin(time * 0.19 + phase) * DRIFT;
        const pz = z + Math.cos(time * 0.14 + phase * 1.2) * DRIFT * 0.75;
        const y = SEA_LEVEL + seaSwell(time, origin.x + px, origin.z + pz) * life;
        lamp.position.set(px, y + 0.025, pz);
        lamp.scale.setScalar(size * light);
        lamp.rotation.x = Math.sin(time * 1.15 + phase) * 0.045;
        lamp.rotation.z = Math.cos(time * 0.82 + phase) * 0.055;
        glow.mesh.position.set(px, y + 0.037, pz);
        glow.brightness.value = light * (0.28 + 0.05 * Math.sin(time * 5.7 + phase * 3));
      }
    },
  };
}
