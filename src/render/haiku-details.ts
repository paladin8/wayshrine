import * as THREE from "three";
import type { Rng } from "../core";
import { branch, TAU, type Scenery } from "./haiku-scenery";

export type LocalGround = (x: number, z: number) => number;

/** A soft, low cloud that the camera can see from either side. */
export function mistBank(art: Scenery, color: number) {
  const material = new THREE.ShaderMaterial({
    uniforms: { shade: { value: new THREE.Color(color) }, strength: { value: 0 } },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: `
      varying vec2 cloudUv;
      void main() {
        cloudUv = uv * 2.0 - 1.0;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec2 cloudUv;
      uniform vec3 shade;
      uniform float strength;
      void main() {
        vec2 uv = cloudUv + vec2(0.0, 0.13 * sin(cloudUv.x * 8.0));
        float edge = 1.0 - smoothstep(0.08, 1.0, length(uv));
        gl_FragColor = vec4(shade, strength * edge * edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
  const mist = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material);
  mist.rotation.set(-0.34, 0.64, 0);
  art.root.add(mist);
  return mist;
}

export function mistDrift(art: Scenery, rng: Rng, ground: LocalGround, color: number, count: number, strength: number) {
  const banks = Array.from({ length: count }, (_, i) => ({
    mist: mistBank(art, color), z: rng.range(-1, 1.1), height: rng.range(0.21, 0.88), phase: i / count,
  }));
  return (life: number, age: number) => {
    for (const { mist, z, height, phase } of banks) {
      const u = (age * 0.13 + phase) % 1;
      const x = -2.1 + 4.2 * u;
      mist.visible = life > 0;
      mist.position.set(x, ground(x, z) + height, z + 0.18 * Math.sin(u * TAU));
      mist.scale.set(1.15 + u * 1.7, 0.52 + u * 0.36, 1);
      mist.material.uniforms.strength.value = life * strength * Math.sin(u * Math.PI);
    }
  };
}

export function particles(
  art: Scenery, rng: Rng, ground: LocalGround,
  options: { count: number; color: number; radius: number; height: number; stretch?: number; speed: number; wind: number },
) {
  const motes = Array.from({ length: options.count }, () => {
    const r = options.radius * rng.range(0.75, 1.38);
    const mote = art.facet(options.color, 0, 0, 0, r, r * (options.stretch ?? 1), r);
    return { mote, phase: rng.next(), x: rng.range(-1.8, 1.8), z: rng.range(-1.55, 1.5), speed: options.speed * rng.range(0.72, 1.39) };
  });
  return (life: number, age: number) => {
    for (const { mote, phase, x, z, speed } of motes) {
      const t = (age * speed + phase) % 1;
      mote.visible = life > phase;
      mote.position.set(x + t * options.wind, ground(x, z) + 0.05 + (1 - t) * options.height, z + 0.12 * Math.sin(t * TAU + phase));
      mote.rotation.z = options.stretch ? options.wind * 0.41 : age * (1.4 + phase);
    }
  };
}

/** Small figures for distant vignettes. The two arms and legs can be posed independently. */
export function figure(art: Scenery, coat: number, headwear: number, seated = false) {
  const person = new THREE.Group();
  const waist = seated ? 0.25 : 0.50;
  const skin = 0xd9ad8e, dark = 0x504844;
  person.add(art.facet(coat, 0, waist + 0.16, 0, 0.19, 0.24, 0.13));
  person.add(art.facet(skin, 0, waist + 0.46, 0.029, 0.095, 0.108, 0.09));
  person.add(art.facet(headwear, 0, waist + 0.53, -0.01, 0.102, 0.070, 0.102));
  const arms = [-1, 1].map((side) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.142, waist + 0.29, 0.007);
    arm.add(branch(art, new THREE.Vector3(), new THREE.Vector3(side * 0.035, -0.24, 0.055), 0.056, coat, false));
    arm.add(art.facet(skin, side * 0.039, -0.244, 0.054, 0.041, 0.053, 0.041));
    person.add(arm);
    return arm;
  });
  const legs = [-1, 1].map((side) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.088, waist + 0.01, 0);
    leg.add(branch(art, new THREE.Vector3(), new THREE.Vector3(0, seated ? -0.145 : -0.46, seated ? 0.22 : 0.016), 0.074, dark, false));
    leg.add(art.facet(dark, 0, seated ? -0.195 : -0.475, seated ? 0.23 : 0.040, 0.065, 0.043, 0.086));
    person.add(leg);
    return leg;
  });
  art.root.add(person);
  return { person, arms, legs };
}

export function ringOnWater(art: Scenery, color: number) {
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 24), new THREE.MeshBasicMaterial({
    color, depthWrite: false, transparent: true, side: THREE.DoubleSide,
  }));
  ring.rotation.x = -Math.PI / 2;
  art.root.add(ring);
  return ring;
}
