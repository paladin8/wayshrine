import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { lifeAt } from "../game";
import type { Obstacle } from "../world";
import { appendAnimalObstacles } from "./animal-collision";
import { createAnimalModels, type AnimalKind, type AnimalModel } from "./animal-models";
import { disposeObject } from "./dispose";
import { buildMatsushimaLanterns } from "./floating-lanterns";
import { extractPuffs, type Puffs } from "./landmark-effects";
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
function fetchModel(url: string): Promise<ArrayBuffer | null> {
  let hit = files.get(url);
  if (!hit) {
    hit = fetch(url, { cache: "no-cache" })
      .then(async (r) => {
        if (!r.ok) return null;
        const buffer = await r.arrayBuffer();
        // A dev server answers a missing file with its index page; only accept real binary glTF.
        return new TextDecoder().decode(buffer.slice(0, 4)) === "glTF" ? buffer : null;
      })
      .catch(() => null);
    files.set(url, hit);
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

interface ModelCollider {
  readonly node: THREE.Object3D;
  readonly radius: number;
  readonly halfLength: number;
}

/**
 * Applies a crafted model: every material fades from a desaturated dead colour
 * to its authored one with the region's life (as props do), and `glow_*`
 * parts light up and flare while it wakes.
 */
function adopt(root: THREE.Object3D, replaced: ReadonlySet<THREE.Object3D>): { tinted: Tinted[]; colliders: ModelCollider[] } {
  const tinted = new Map<THREE.Material, Tinted>();
  const colliders: ModelCollider[] = [];
  root.traverse((o) => {
    const { collisionRadius, collisionHalfLength } = o.userData;
    if (!replaced.has(o) && typeof collisionRadius === "number" && collisionRadius > 0 && typeof collisionHalfLength === "number") {
      colliders.push({ node: o, radius: collisionRadius, halfLength: collisionHalfLength });
    }
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
  return { tinted: [...tinted.values()], colliders };
}

const ANIMAL_NODE = /^(deer|crane|macaque|bear|horse|camel|buffalo)_\d+$/;

/** Metres the animal's own gait covers per stride, before the anchor's scale. */
const STRIDE: Readonly<Record<AnimalKind, number>> = {
  deer: 0.64, serow: 0.6, boar: 0.5, crane: 0.5, fox: 0.45, otter: 0.4, dolphin: 1, whale: 1,
  macaque: 0.4, bear: 0.62, horse: 0.9, camel: 0.9, buffalo: 0.6,
};

interface LandmarkAnimal {
  readonly anchor: THREE.Object3D;
  readonly species: AnimalKind;
  readonly model: AnimalModel;
  readonly previous: THREE.Vector3;
  readonly seed: number;
  readonly restY: number;
  phase: number;
}

/**
 * The authored animals are anchors (`deer_1`, `crane_3`, `macaque_2`...) that carry a collider and, where the
 * animal walks, the path it follows. The visible body is the shared model, the one the wild animals use, so a
 * landmark's animals match those in the world. Any child geometry on an anchor is retired along with its tracks.
 */
function replaceLandmarkAnimals(root: THREE.Object3D) {
  const anchors: THREE.Object3D[] = [];
  root.traverse(node => {
    if (ANIMAL_NODE.test(node.name) && typeof node.userData.collisionRadius === "number") anchors.push(node);
  });
  const retiredTracks = new Set<string>();
  if (!anchors.length) return { animals: [] as LandmarkAnimal[], retiredTracks };
  const models = createAnimalModels();
  const count = new Map<string, number>();
  const animals: LandmarkAnimal[] = anchors.map((anchor, i) => {
    for (const child of [...anchor.children]) {
      child.traverse(node => {
        retiredTracks.add(node.name);
        retiredTracks.add(node.uuid);
      });
      anchor.remove(child);
    }
    const species = anchor.name.slice(0, anchor.name.indexOf("_")) as AnimalKind;
    const nth = count.get(species) ?? 0;
    count.set(species, nth + 1);
    const model = models.build(species, nth === 0, { resting: !!anchor.userData.resting, snowcap: !!anchor.userData.snowcap, saddle: !!anchor.userData.saddle });
    // Blender's authored paths point along local X. The shared model faces local Z.
    model.group.rotation.y = Math.PI / 2;
    anchor.add(model.group);
    const seed = i * 2.3;
    return { anchor, species, model, previous: anchor.position.clone(), seed, restY: anchor.position.y, phase: seed };
  });
  return { animals, retiredTracks };
}

function poseLandmarkAnimals(animals: readonly LandmarkAnimal[], time: number, dt: number): void {
  animals.forEach((animal, index) => {
    const { position, scale } = animal.anchor;
    const travel = dt > 0 ? Math.hypot(position.x - animal.previous.x, position.z - animal.previous.z) : 0;
    const gait = dt > 0 ? Math.min(1, travel / (dt * 1.15)) : 0;
    animal.phase = dt > 0 ? animal.phase + travel * 2 * Math.PI / (STRIDE[animal.species] * scale.x) : animal.seed;
    const lift = Math.min(1, Math.max(0, (position.y - animal.restY) / (0.4 * Math.max(scale.y, 0.01))));
    animal.model.pose(time + index * 2.1, gait, animal.phase, lift);
    animal.previous.copy(position);
  });
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
  let model: ReturnType<typeof adopt> | null = null;
  const scratch = new THREE.Vector3();
  let progress = 0;
  let mixer: THREE.AnimationMixer | null = null;
  let animationStart: number | null = null;
  let lastAnimationTime = 0;
  let animals: readonly LandmarkAnimal[] = [];
  let puffs: Puffs | null = null;
  let lanterns: ReturnType<typeof buildMatsushimaLanterns> | null = null;

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

  void fetchModel(modelUrl(id)).then((buffer) => {
    if (!buffer) return;
    new GLTFLoader().parse(
      buffer,
      "",
      (gltf) => {
        // The landmark may have been streamed out again while the file was loading.
        if (!group.parent) return;
        group.remove(stand.group);
        group.add(gltf.scene);
        // Steam and smoke are pulled out first, so they are not tinted with the rest of the model.
        puffs = extractPuffs(gltf.scene, id);
        const replacement = replaceLandmarkAnimals(gltf.scene);
        animals = replacement.animals;
        model = adopt(gltf.scene, new Set(animals.map(animal => animal.anchor)));
        if (gltf.animations.length) {
          mixer = new THREE.AnimationMixer(gltf.scene);
          for (const clip of gltf.animations) {
            if (!replacement.animals.length) {
              mixer.clipAction(clip).play();
              continue;
            }
            const tracks = clip.tracks.filter(track =>
              !replacement.retiredTracks.has(THREE.PropertyBinding.parseTrackName(track.name).nodeName),
            );
            if (tracks.length) mixer.clipAction(new THREE.AnimationClip(clip.name, clip.duration, tracks, clip.blendMode)).play();
          }
          mixer.setTime(0);
        }
        poseLandmarkAnimals(animals, 0, 0);
        apply();
        if (id === "matsushima") {
          void fetchModel(`${import.meta.env.BASE_URL}models/title/toro.glb`).then(async (asset) => {
            if (!asset || !group.parent) return;
            const { scene } = await new GLTFLoader().parseAsync(asset, "");
            const toro = scene.getObjectByName("toro");
            if (!toro || !group.parent) {
              disposeObject(scene);
              return;
            }
            lanterns = buildMatsushimaLanterns(toro);
            group.add(lanterns.group);
          }).catch(() => undefined);
        }
      },
      () => undefined,
    );
  });

  return {
    group,
    modelReady: () => model !== null,
    appendObstaclesNear(x, z, reach, out: Obstacle[]) {
      if (!model) return;
      for (const animal of animals) appendAnimalObstacles(animal.model.group, animal.species, x, z, reach, out);
      for (const { node, radius, halfLength } of model.colliders) {
        node.updateWorldMatrix(true, false);
        const r = radius * scratch.setFromMatrixScale(node.matrixWorld).x;
        // Use the axis specified by the authored collider.
        for (const dx of [-halfLength, 0, halfLength]) {
          scratch.set(dx, 0, 0).applyMatrix4(node.matrixWorld);
          if (Math.hypot(x - scratch.x, z - scratch.z) <= reach + r) {
            out.push({ x: scratch.x, z: scratch.z, r });
          }
        }
      }
    },
    setVitality(p) {
      progress = p;
      apply();
    },
    tick(seconds) {
      if (!model) stand.tick(seconds);
      const vitality = lifeAt(progress, 0);
      puffs?.update(seconds, vitality);
      lanterns?.update(seconds, vitality);
      if (progress >= 1) {
        animationStart ??= seconds;
        const time = seconds - animationStart;
        mixer?.setTime(time);
        poseLandmarkAnimals(animals, time, time - lastAnimationTime);
        lastAnimationTime = time;
      } else if (animationStart !== null) {
        animationStart = null;
        lastAnimationTime = 0;
        mixer?.setTime(0);
        poseLandmarkAnimals(animals, 0, 0);
      }
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
