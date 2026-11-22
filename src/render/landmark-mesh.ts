import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { lifeAt } from "../game";
import type { ShrineMesh } from "./shrine-mesh";
import { palette } from "./palette";
import { deadOf } from "./vitality-mesh";

const DEAD_STONE = new THREE.Color(0x77736f);
const DEAD_RED = new THREE.Color(0x77716e);

/** Where a landmark's model lives: public/models/landmarks/<id>.glb */
function modelUrl(id: string): string {
  return `${import.meta.env.BASE_URL}models/landmarks/${id}.glb`;
}

/** Raw model files, fetched once; each landmark instance parses its own copy so it owns its materials. */
const files = new Map<string, Promise<ArrayBuffer | null>>();
function fetchModel(id: string): Promise<ArrayBuffer | null> {
  let hit = files.get(id);
  if (!hit) {
    hit = fetch(modelUrl(id))
      .then(async (r) => {
        if (!r.ok) return null;
        const buffer = await r.arrayBuffer();
        // A dev server answers a missing file with its index page; only accept real binary glTF.
        return new TextDecoder().decode(buffer.slice(0, 4)) === "glTF" ? buffer : null;
      })
      .catch(() => null);
    files.set(id, hit);
  }
  return hit;
}

/** Light glows and the like: nodes the artist named `glow_*` are lit up as the region wakes. */
const isGlow = (name: string): boolean => name.startsWith("glow_");

interface Tinted {
  readonly material: THREE.MeshStandardMaterial;
  readonly alive: THREE.Color;
  readonly dead: THREE.Color;
  readonly glows: boolean;
}

/**
 * Applies a crafted model: every material fades from a desaturated dead colour
 * to its authored one with the region's life (as props do), and `glow_*`
 * parts light up and flare while it wakes.
 */
function adopt(root: THREE.Object3D): { tinted: Tinted[] } {
  const tinted = new Map<THREE.Material, Tinted>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.castShadow = true;
    o.receiveShadow = true;
    const material = o.material as THREE.MeshStandardMaterial;
    const glows = isGlow(o.name) || isGlow(material.name);
    const seen = tinted.get(material);
    if (seen) return;
    material.flatShading = true;
    if (glows) material.emissive = material.color.clone();
    tinted.set(material, { material, alive: material.color.clone(), dead: deadOf(material.color), glows });
  });
  return { tinted: [...tinted.values()] };
}

/**
 * A landmark's visual. It is drawn as a plain placeholder at once, and swapped
 * for the crafted model as soon as that has loaded (if the landmark has one).
 * The landmark is the region's shrine, so there is no torii; it is solid within
 * the landmark's footprint.
 */
export function buildLandmark(id: string): ShrineMesh {
  const group = new THREE.Group();
  const stand = buildPlaceholder();
  group.add(stand.group);
  let model: { tinted: Tinted[] } | null = null;
  let progress = 0;

  const apply = (): void => {
    const v = lifeAt(progress, 0);
    const flare = progress > 0 && progress < 0.35 ? Math.sin((progress / 0.35) * Math.PI) : 0;
    stand.setVitality(progress);
    if (!model) return;
    for (const t of model.tinted) {
      t.material.color.copy(t.dead).lerp(t.alive, v);
      if (t.glows) t.material.emissiveIntensity = 0.9 * v + 3.0 * flare;
    }
  };

  void fetchModel(id).then((buffer) => {
    if (!buffer) return;
    new GLTFLoader().parse(
      buffer,
      "",
      (gltf) => {
        // The landmark may have been streamed out again while the file was loading.
        if (!group.parent) return;
        group.remove(stand.group);
        group.add(gltf.scene);
        model = adopt(gltf.scene);
        apply();
      },
      () => undefined,
    );
  });

  return {
    group,
    setVitality(p) {
      progress = p;
      apply();
    },
    tick(seconds) {
      if (!model) stand.tick(seconds);
    },
  };
}

/**
 * Stand-in for a landmark without a model yet: a stepped plinth, a spire and a
 * floating gem. Deliberately plain so it is never mistaken for a crafted one.
 */
function buildPlaceholder(): ShrineMesh {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color: palette.rock, flatShading: true });
  const red = new THREE.MeshStandardMaterial({ color: palette.red, flatShading: true });
  const gem = new THREE.MeshStandardMaterial({
    color: palette.cream,
    emissive: palette.glow,
    emissiveIntensity: 0,
    flatShading: true,
  });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, y: number): THREE.Mesh => {
    const m = new THREE.Mesh(geo, mat);
    m.position.y = y;
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(3.0, 3.2, 0.5, 8), stone, 0.25);
  add(new THREE.CylinderGeometry(2.3, 2.5, 0.5, 8), stone, 0.75);
  add(new THREE.CylinderGeometry(1.6, 1.8, 0.5, 8), stone, 1.25);
  add(new THREE.BoxGeometry(1.1, 5.2, 1.1), stone, 4.1);
  add(new THREE.ConeGeometry(0.95, 1.2, 4), stone, 7.3).rotation.y = Math.PI / 4;
  add(new THREE.BoxGeometry(1.3, 0.4, 1.3), red, 3.2);
  add(new THREE.BoxGeometry(1.3, 0.4, 1.3), red, 5.2);
  const orb = add(new THREE.IcosahedronGeometry(0.55, 0), gem, 8.7);

  const aliveStone = new THREE.Color(palette.rock);
  const aliveRed = new THREE.Color(palette.red);
  let life = 0;
  return {
    group,
    setVitality(progress) {
      const v = lifeAt(progress, 0);
      const flare = progress > 0 && progress < 0.35 ? Math.sin((progress / 0.35) * Math.PI) : 0;
      life = v;
      stone.color.copy(DEAD_STONE).lerp(aliveStone, v);
      red.color.copy(DEAD_RED).lerp(aliveRed, v);
      gem.emissiveIntensity = 1.4 * v + 3.5 * flare;
      orb.scale.setScalar(0.4 + 0.6 * v + 0.8 * flare);
    },
    tick(seconds) {
      orb.position.y = 8.7 + Math.sin(seconds * 1.6) * 0.15 * life;
      orb.rotation.y = seconds * 0.6;
    },
  };
}
