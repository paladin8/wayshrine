import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { lifeAt } from "../game";
import type { Biome, Obstacle, Point } from "../world";
import { palette } from "./palette";
import { modelHokora, modelShrine, type ShrineParts } from "./shrine-styles";
import { deadOf } from "./vitality-mesh";

export interface ShrineMesh {
  readonly group: THREE.Group;
  /** Restoration progress: 0 is dead and grey with the orb dark; 1 is restored and glowing. */
  setVitality(progress: number): void;
  /** True when a streamed landmark has installed its model. */
  modelReady?(): boolean;
  /** Append colliders attached to the current model pose. */
  appendObstaclesNear?(x: number, z: number, reach: number, out: Obstacle[]): void;
  /** Animates the shrine or landmark. */
  tick(seconds: number): void;
}

/**
 * A biome-specific gate with a floating orb. All static parts use one vertex-coloured mesh. With a
 * hokora (at `hokora`, relative to the gate), the hokora is drawn behind the gate and the orb hovers above it.
 */
export function buildShrine(biome: Biome, hokora: Point | null = null): ShrineMesh {
  const group = new THREE.Group();
  group.name = `${biome} shrine`;
  const pieces: THREE.BufferGeometry[] = [];
  const dormant: number[] = [];

  const piece = (geo: THREE.BufferGeometry, hex: number, x: number, y: number, z: number): void => {
    geo.translate(x, y, z);
    const color = new THREE.Color(hex);
    const dead = deadOf(color);
    const count = geo.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      color.toArray(colors, i * 3);
      dormant.push(dead.r, dead.g, dead.b);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    pieces.push(geo);
  };

  const parts = geometryParts(piece);
  modelShrine(biome, parts);
  const ridge = hokora ? modelHokora(biome, parts, hokora.x, hokora.z) : 0;

  const geometry = mergeGeometries(pieces);
  for (const part of pieces) part.dispose();
  const gate = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true }));
  gate.castShadow = true;
  gate.receiveShadow = true;
  group.add(gate);
  const colors = geometry.getAttribute("color") as THREE.BufferAttribute;
  colors.setUsage(THREE.DynamicDrawUsage);
  const restored = colors.array.slice();

  const orbMat = new THREE.MeshStandardMaterial({
    color: palette.cream,
    emissive: palette.glow,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 0), orbMat);
  // Between the gate's posts, or just above the hokora's ridge.
  const orbY = hokora ? ridge + 0.5 : 1.4;
  orb.position.set(hokora?.x ?? 0, orbY, hokora?.z ?? 0);
  orb.castShadow = true;
  group.add(orb);

  let vitality = 0;
  const setVitality = (progress: number): void => {
    // The shrine sits at the centre of the field, so it wakes first.
    const v = lifeAt(progress, 0);
    vitality = v;
    for (let i = 0; i < restored.length; i++) colors.array[i] = THREE.MathUtils.lerp(dormant[i]!, restored[i]!, v);
    colors.needsUpdate = true;
    // While the energy is being released the orb flares, then settles.
    const flare = progress > 0 && progress < 0.35 ? Math.sin((progress / 0.35) * Math.PI) : 0;
    orbMat.emissiveIntensity = 1.2 * v + 3.2 * flare;
    orb.scale.setScalar(0.4 + 0.6 * v + 0.9 * flare);
  };
  setVitality(0);

  return {
    group,
    setVitality,
    tick: (seconds) => {
      orb.position.y = orbY + Math.sin(seconds * 2) * 0.08 * vitality;
      orb.rotation.y = seconds * 0.8;
    },
  };
}

type AddPiece = (geo: THREE.BufferGeometry, hex: number, x: number, y: number, z: number) => void;

/** Shrine parts that build three.js geometry, handing each piece to `add` with its colour and position. */
function geometryParts(add: AddPiece): ShrineParts {
  const xAxis = new THREE.Vector3(1, 0, 0);
  return {
    box(w, h, d, color, x, y, z, pitch = 0) {
      add(new THREE.BoxGeometry(w, h, d).rotateX(pitch), color, x, y, z);
    },
    round(top, bottom, h, sides, color, x, y, z) {
      add(new THREE.CylinderGeometry(top, bottom, h, sides), color, x, y, z);
    },
    timber(start, end, w, d, color) {
      const a = new THREE.Vector3(...start);
      const b = new THREE.Vector3(...end);
      const direction = b.clone().sub(a);
      const geo = new THREE.BoxGeometry(direction.length(), w, d);
      geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(xAxis, direction.normalize()));
      const centre = a.lerp(b, 0.5);
      add(geo, color, centre.x, centre.y, centre.z);
    },
  };
}

/**
 * A hokora on its own, restored, as one vertex-coloured mesh with its base at the origin and its doorway
 * facing +z: for scenes outside the world, such as the title screen. The caller disposes it.
 */
export function buildHokora(biome: Biome): THREE.Mesh {
  const pieces: THREE.BufferGeometry[] = [];
  modelHokora(biome, geometryParts((geo, hex, x, y, z) => {
    geo.translate(x, y, z);
    const color = new THREE.Color(hex);
    const count = geo.getAttribute("position").count;
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) color.toArray(colors, i * 3);
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    pieces.push(geo);
  }), 0, 0);
  const geometry = mergeGeometries(pieces);
  for (const part of pieces) part.dispose();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
  mesh.name = `${biome} hokora`;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
