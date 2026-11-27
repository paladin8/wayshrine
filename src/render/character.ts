import * as THREE from "three";
import { palette } from "./palette";

export const CHARACTER_VARIANTS = ["female", "male"] as const;
export type CharacterVariant = (typeof CHARACTER_VARIANTS)[number];

/** Gear that shows on the character: each is worn or carried on the biome that needs it. */
export type GearId = "snowshoes" | "geta" | "ashSandals" | "lantern" | "climbing";

/** A foot planted on the ground, where it stands in world space. */
export interface FootStep {
  readonly x: number;
  readonly z: number;
}

export interface LanternLighting {
  readonly progress: number;
  readonly flame: number;
}

export interface Character {
  readonly root: THREE.Group;
  /**
   * Advance the walk cycle. `walk` is 0 (standing) to 1 (walking), `seated` is 0 to 1. Returns the
   * feet that came down flat this frame, in world space.
   */
  update(dt: number, walk: number, seated: number): readonly FootStep[];
  setGear(gear: GearId | null): void;
  /** Draw the walking sticks from the pack: progress 0 to 1, or null when not drawing. */
  setDraw(progress: number | null): void;
  setLanternLighting(lighting: LanternLighting | undefined): void;
  /** Crouch to strap on gear: 0 stands normally, 1 is fully crouched. `fuss` moves the hands about the feet. */
  setCrouch(amount: number, fuss: number): void;
  /** Seated only: lean forward and rest the hands on the lap, 0 to 1. */
  setLapRest(amount: number): void;
  dispose(): void;
}

const SKIN = 0xf0c9a4;
const SHIRT = palette.cream;
const TROUSERS = 0x51695d;
const BOOT = 0x4a3b33;
const WOOD = 0xb98d5c;
const WOOD_DARK = 0x8a6540;
const ROPE = 0xd9c79a;
const ASH = 0x8a7f7c;

/** Walk cycles per second at full speed. */
const CADENCE = 1.45;
const TAU = Math.PI * 2;
const footPoint = new THREE.Vector3();
const smooth = (value: number): number => THREE.MathUtils.smoothstep(value, 0, 1);

const mat = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, flatShading: true, ...extra });

interface Shape {
  /** Half width of the shoulders and radius of the chest. */
  readonly chest: number;
  readonly hip: number;
  readonly headR: number;
  readonly scale: number;
  readonly skirt: boolean;
  readonly hair: number;
}

const SHAPES: Readonly<Record<CharacterVariant, Shape>> = {
  female: { chest: 0.18, hip: 0.194, headR: 0.185, scale: 0.92, skirt: true, hair: 0x3a2a26 },
  male: { chest: 0.235, hip: 0.17, headR: 0.18, scale: 1, skirt: false, hair: 0x4a3c37 },
};

/**
 * A stylised traveller: a wrapped jacket, loose trousers, a scarf and a wooden pack, in the
 * spirit of a wandering herbalist. Built from jointed parts so one walk cycle serves every outfit,
 * with footwear and hand-held gear attached to the feet and right hand.
 */
export function buildCharacter(variant: CharacterVariant, arrival?: { value: number }): Character {
  const shape = SHAPES[variant];
  const root = new THREE.Group();
  root.scale.setScalar(shape.scale);
  const owned: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const m = (color: number, extra?: Partial<THREE.MeshStandardMaterialParameters>): THREE.MeshStandardMaterial => {
    const made = mat(color, extra);
    if (arrival) {
      made.customProgramCacheKey = () => "shrine-arrival";
      made.onBeforeCompile = (shader) => {
        shader.uniforms.uShrineArrival = arrival;
        shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>
uniform float uShrineArrival;`).replace("#include <opaque_fragment>", `
if (uShrineArrival < 1.0) {
  float grain = fract(52.9829189 * fract(dot(floor(gl_FragCoord.xy), vec2(0.06711056, 0.00583715))));
  float reveal = smoothstep(0.0, 0.74, uShrineArrival);
  if (grain > reveal) discard;
  float ripple = 0.5 + 0.5 * sin(gl_FragCoord.y * 0.67 - uShrineArrival * 28.0);
  float glint = pow(ripple, 4.0) * (1.0 - smoothstep(0.32, 1.0, uShrineArrival));
  outgoingLight = mix(outgoingLight, vec3(0.92, 0.96, 1.0), 0.64 * glint);
}
#include <opaque_fragment>`);
      };
    }
    materials.push(made);
    return made;
  };
  const mesh = (geo: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Mesh => {
    owned.push(geo);
    const out = new THREE.Mesh(geo, material);
    out.position.set(x, y, z);
    out.castShadow = true;
    parent.add(out);
    return out;
  };
  const group = (parent: THREE.Object3D, x = 0, y = 0, z = 0): THREE.Group => {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  /** Join elliptical cross-sections into a tapered piece with broad, readable facets. */
  const tailored = (sections: readonly (readonly [number, number, number, number?])[], sides = 8): THREE.BufferGeometry => {
    const positions: number[] = [];
    const faces: number[] = [];
    for (const [y, width, depth, centre = 0] of sections) {
      for (let i = 0; i < sides; i++) {
        const angle = i * TAU / sides;
        positions.push(Math.sin(angle) * width, y, centre + Math.cos(angle) * depth);
      }
    }
    const top = (sections.length - 1) * sides;
    for (let row = 0; row < top; row += sides) {
      for (let i = 0; i < sides; i++) {
        const a = row + i;
        const b = row + (i + 1) % sides;
        faces.push(a, b, b + sides, a, b + sides, a + sides);
      }
    }
    for (let i = 1; i < sides - 1; i++) faces.push(0, i + 1, i, top, top + i, top + i + 1);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    return geometry;
  };

  /** Lay a flat fold across a piece of clothing, facing forward. */
  const fold = (parent: THREE.Object3D, material: THREE.Material, width: number, points: readonly (readonly [number, number, number])[]): void => {
    const positions: number[] = [];
    const faces: number[] = [];
    for (const [i, [x, y, z]] of points.entries()) {
      const [ax, ay] = points[Math.max(0, i - 1)]!;
      const [bx, by] = points[Math.min(points.length - 1, i + 1)]!;
      const length = Math.hypot(bx - ax, by - ay);
      const dx = (by - ay) * width / (2 * length);
      const dy = (bx - ax) * width / (2 * length);
      positions.push(x + dx, y - dy, z, x - dx, y + dy, z);
      if (i > 0) {
        const j = (i - 1) * 2;
        faces.push(j, j + 2, j + 3, j, j + 3, j + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    mesh(geometry, material, parent);
  };

  const shirt = m(shape.skirt ? 0x899eae : SHIRT);
  const clothEdge = m(shape.skirt ? 0xc5b49b : 0xc4ac80);
  const lining = m(0xf4e8ca);
  const trousers = m(TROUSERS);
  const skin = m(SKIN);
  const boot = m(BOOT);
  const bootSole = m(0x302b26);
  const bootWrap = m(0x887562);
  const scarfMat = m(palette.red);
  const wood = m(WOOD);
  const woodDark = m(WOOD_DARK);

  // --- Legs and pelvis.
  const THIGH = 0.26;
  const SHIN = 0.26;
  const BOOT_H = 0.075;
  const HIP_Y = THIGH + SHIN + BOOT_H;
  const pelvis = group(root, 0, HIP_Y, 0);
  pelvis.name = "pelvis";
  mesh(tailored([[-0.076, shape.hip * 0.91, 0.097], [0.064, shape.hip * 0.86, 0.103]]), trousers, pelvis);

  interface Leg {
    readonly hip: THREE.Group;
    readonly knee: THREE.Group;
    readonly sole: THREE.Group;
  }
  const makeLeg = (side: 1 | -1): Leg => {
    const hip = group(pelvis, side * shape.hip * 0.55, -0.02, 0);
    mesh(tailored([[-0.28, 0.079, 0.073], [-0.18, 0.094, 0.082], [-0.065, 0.104, 0.084], [0.018, 0.086, 0.076]]), trousers, hip);
    const knee = group(hip, 0, -THIGH, 0);
    mesh(tailored([[-0.27, 0.052, 0.055], [-0.18, 0.064, 0.065], [-0.07, 0.079, 0.071], [0.025, 0.077, 0.07]]), trousers, knee);
    const ankle = group(knee, 0, -SHIN, 0);
    mesh(tailored([[-0.065, 0.063, 0.112, 0.039], [-0.049, 0.066, 0.117, 0.039]]), bootSole, ankle);
    mesh(tailored([[-0.05, 0.064, 0.115, 0.038], [-0.019, 0.061, 0.109, 0.037], [0.014, 0.054, 0.09, 0.025], [0.075, 0.051, 0.057]]), boot, ankle);
    mesh(tailored([[0.025, 0.055, 0.061], [0.043, 0.054, 0.06]]), bootWrap, ankle);
    const sole = group(ankle, 0, -BOOT_H + 0.01, 0.04);
    return { hip, knee, sole };
  };
  const legs = [makeLeg(1), makeLeg(-1)] as const;

  // --- Torso.
  const torso = group(pelvis, 0, 0.05, 0);
  const waist = shape.hip * (shape.skirt ? 0.76 : 0.88);
  const lowerHem = shape.skirt ? -0.152 : -0.08;
  const chestFront = shape.skirt ? 0.026 : 0;
  mesh(tailored([
    [lowerHem, shape.hip * (shape.skirt ? 1.24 : 1.09), 0.126, 0.013],
    [0.015, shape.hip * 1.02, 0.126, 0.007],
    [0.12, waist, 0.119],
    [0.29, shape.chest * 0.96, 0.142, chestFront],
    [0.365, shape.chest * 1.04, 0.136],
    [0.421, 0.103, 0.094],
  ]), shirt, torso);
  mesh(tailored([
    [lowerHem - 0.011, shape.hip * (shape.skirt ? 1.25 : 1.1), 0.127, 0.013],
    [lowerHem + 0.014, shape.hip * (shape.skirt ? 1.24 : 1.09), 0.13, 0.013],
  ]), clothEdge, torso);

  // A crossed collar and a broad woven sash give the jacket a distinct shape at game scale.
  fold(torso, lining, 0.054, [[-0.07, 0.403, 0.093], [-0.058, 0.348, 0.133], [0.055, 0.235, 0.146 + chestFront * 0.75]]);
  fold(torso, clothEdge, 0.032, [[0.077, 0.402, 0.094], [0.052, 0.349, 0.134], [-0.018, 0.279, 0.153 + chestFront], [-0.073, 0.19, 0.136]]);
  const sash = m(shape.skirt ? 0x574760 : 0x504d40);
  mesh(tailored([[0.061, waist + 0.026, 0.129], [0.105, waist + 0.013, 0.124]]), sash, torso);
  if (shape.skirt) {
    mesh(tailored([[0.076, waist + 0.023, 0.129], [0.083, waist + 0.021, 0.128]]), clothEdge, torso);
  }

  // --- Head.
  const neck = group(torso, 0, 0.42, 0);
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 6), skin, neck, 0, 0.02, 0);
  const head = group(neck, 0, 0.17, 0);
  const r = shape.headR;
  mesh(tailored([
    [-r * 0.87, r * 0.47, r * 0.49, 0.027],
    [-r * 0.57, r * 0.77, r * 0.73, 0.016],
    [-r * 0.12, r * 0.91, r * 0.85, 0.006],
    [r * 0.43, r * 0.89, r * 0.84],
    [r * 0.78, r * 0.63, r * 0.62, -0.003],
    [r * 0.91, r * 0.29, r * 0.32, -0.009],
  ], 12), skin, head);
  const eye = m(0x322822);
  const brow = m(0x6b4b3a);
  const cheek = m(0xe5ab8d);
  for (const side of [1, -1]) {
    const bead = mesh(new THREE.SphereGeometry(1, 6, 4), eye, head, side * 0.061, -0.015, r * 0.83);
    bead.scale.set(0.012, 0.018, 0.009);
    const arch = mesh(new THREE.BoxGeometry(0.032, 0.009, 0.009), brow, head, side * 0.061, 0.026, r * 0.83);
    arch.rotation.z = side * -0.11;
    const ear = mesh(new THREE.IcosahedronGeometry(1, 0), skin, head, side * r * 0.86, -0.034, -0.004);
    ear.scale.set(0.027, 0.041, 0.025);
  }
  const nose = mesh(new THREE.IcosahedronGeometry(1, 0), skin, head, 0, -0.043, r * 0.85);
  nose.scale.set(0.022, 0.032, 0.032);
  const mouth = mesh(new THREE.BoxGeometry(0.029, 0.008, 0.01), cheek, head, 0.003, -0.092, r * 0.744);
  mouth.rotation.z = 0.09;

  let ponytail: { readonly base: THREE.Group; readonly upper: THREE.Group; readonly lower: THREE.Group } | null = null;
  const hairMat = m(shape.hair);
  const highlight = m(variant === "female" ? 0x49332b : 0x4e3a30);
  // The face stays open. The crown is swept across the forehead and drops around the nape.
  const hairPositions: number[] = [];
  const hairFaces: number[] = [];
  const hairSides = 16;
  const hairRings = 4;
  for (let row = 0; row < hairRings; row++) {
    for (let i = 0; i < hairSides; i++) {
      const angle = i * TAU / hairSides;
      const back = (1 - Math.cos(angle)) * 0.5;
      const sweep = (shape.skirt ? 0.2 : 0.35) * Math.sin(angle + 0.26) * (1 - back);
      const hairline = 1.21 + back * (shape.skirt ? 1.16 : 0.92) + sweep;
      const polar = hairline * (1 - row / hairRings);
      hairPositions.push(
        r * 1.075 * Math.sin(polar) * Math.sin(angle) - row * 0.003,
        0.013 + r * Math.cos(polar) * 1.02 + (shape.skirt ? 0 : 0.028 * Math.cos(polar) ** 2),
        -0.012 + r * 1.075 * Math.sin(polar) * Math.cos(angle),
      );
      if (row > 0) {
        const a = (row - 1) * hairSides + i;
        const b = (row - 1) * hairSides + (i + 1) % hairSides;
        hairFaces.push(a, b, b + hairSides, a, b + hairSides, a + hairSides);
      }
    }
  }
  const crown = hairRings * hairSides;
  hairPositions.push(-0.016, 0.013 + r * 1.02 + (shape.skirt ? 0 : 0.028), -0.013);
  for (let i = 0; i < hairSides; i++) hairFaces.push(crown - hairSides + i, crown - hairSides + (i + 1) % hairSides, crown);
  const hair = new THREE.BufferGeometry();
  hair.setAttribute("position", new THREE.Float32BufferAttribute(hairPositions, 3));
  hair.setIndex(hairFaces);
  hair.computeVertexNormals();
  mesh(hair, hairMat, head);

  const fringe = mesh(tailored([[-0.077, 0.008, 0.014], [-0.037, 0.034, 0.023], [0.04, 0.048, 0.028], [0.071, 0.03, 0.019]], 6),
    highlight, head, 0.081, 0.103, 0.132);
  fringe.rotation.z = 0.44;
  fringe.rotation.x = -0.38;
  if (variant === "female") {
    // Side locks keep the haircut visible from the front, even when the pack hides the tail.
    for (const side of [-1, 1]) {
      const lock = mesh(tailored([[-0.164, 0.007, 0.009], [-0.106, 0.025, 0.023], [-0.034, 0.039, 0.028], [0.047, 0.034, 0.031]], 7),
        hairMat, head, side * 0.151, 0.056, 0.076);
      lock.rotation.z = side * 0.15;
      lock.rotation.x = side * 0.10;
    }
    const ponyBase = group(head, 0.058, 0.097, -0.158);
    ponyBase.rotation.z = 0.24;
    mesh(new THREE.IcosahedronGeometry(0.069, 0), hairMat, ponyBase);
    const tie = m(0xd39659);
    mesh(tailored([[-0.046, 0.055, 0.050], [-0.022, 0.063, 0.055]], 7), tie, ponyBase);
    const upper = group(ponyBase, 0.008, -0.036, -0.016);
    mesh(tailored([[-0.156, 0.045, 0.041, -0.017], [-0.073, 0.056, 0.049, -0.013], [0.011, 0.047, 0.043]], 7), hairMat, upper);
    const lower = group(upper, 0, -0.145, -0.016);
    mesh(tailored([[-0.163, 0.006, 0.008, -0.028], [-0.093, 0.03, 0.028, -0.009], [0.018, 0.047, 0.043]], 7), hairMat, lower);
    ponytail = { base: ponyBase, upper, lower };
  }

  // A knotted rust scarf reads as a single accent from both sides.
  const scarfFold = m(0xb64e3c);
  mesh(tailored([[0.386, 0.113, 0.105], [0.437, 0.104, 0.103], [0.47, 0.081, 0.075]]), scarfMat, torso);
  const knot = mesh(new THREE.IcosahedronGeometry(0.055, 0), scarfMat, torso, 0.025, 0.412, 0.102);
  knot.scale.set(1.15, 0.75, 0.62);
  fold(torso, scarfFold, 0.056, [[0.041, 0.413, 0.136], [0.042, 0.367, 0.137], [0.059, 0.326, 0.146 + chestFront * 0.63]]);
  const scarfTail = group(torso, 0.05, 0.423, -0.095);
  mesh(tailored([[-0.165, 0.043, 0.012, -0.009], [-0.095, 0.05, 0.012], [0.01, 0.039, 0.012]]), scarfMat, scarfTail);
  const scarfTip = group(scarfTail, 0, -0.154, -0.007);
  mesh(tailored([[-0.127, 0.031, 0.009, -0.036], [-0.069, 0.043, 0.01, -0.013], [0.009, 0.042, 0.011]]), scarfFold, scarfTip);

  // --- Arms.
  interface Arm {
    readonly shoulder: THREE.Group;
    readonly elbow: THREE.Group;
    readonly hand: THREE.Group;
  }
  const makeArm = (side: 1 | -1): Arm => {
    const shoulder = group(torso, side * (shape.chest + 0.03), 0.38, 0);
    mesh(tailored([[-0.21, 0.058, 0.059], [-0.078, 0.071, 0.068], [0.0, 0.076, 0.072], [0.03, 0.05, 0.05]]), shirt, shoulder);
    const elbow = group(shoulder, 0, -0.19, 0);
    mesh(tailored([[-0.156, 0.055, 0.054], [-0.117, 0.064, 0.062], [0.027, 0.057, 0.058]]), shirt, elbow);
    mesh(tailored([[-0.166, 0.053, 0.052], [-0.143, 0.057, 0.055]]), clothEdge, elbow);
    const hand = group(elbow, 0, -0.18, 0);
    const palm = mesh(new THREE.IcosahedronGeometry(0.05, 0), skin, hand, 0, -0.008, 0.004);
    palm.scale.set(0.78, 1.02, 0.91);
    return { shoulder, elbow, hand };
  };
  const arms = [makeArm(1), makeArm(-1)] as const;

  // --- Pack: a slatted wooden travel chest with a rolled blanket and cloth harness.
  const pack = group(torso, 0, 0.2, -shape.chest * 0.72 - 0.1);
  const binding = m(0x635146);
  const brass = m(0xc69b5e);
  const lightWood = m(0xc59a69);
  const blanket = m(0x708879);
  const blanketEdge = m(0x516b60);
  mesh(new THREE.BoxGeometry(0.276, 0.303, 0.145), wood, pack, 0, -0.011, 0);
  for (const [i, x] of [-0.105, -0.035, 0.035, 0.105].entries()) {
    mesh(new THREE.BoxGeometry(0.067, 0.276, 0.014), i % 2 === 0 ? lightWood : wood, pack, x, -0.009, -0.074);
  }
  mesh(new THREE.BoxGeometry(0.308, 0.044, 0.177), woodDark, pack, 0, -0.158, -0.003);
  mesh(new THREE.BoxGeometry(0.316, 0.044, 0.184), wood, pack, 0, 0.149, -0.003);
  mesh(new THREE.BoxGeometry(0.306, 0.013, 0.181), woodDark, pack, 0, 0.12, -0.003);
  const roll = new THREE.CylinderGeometry(0.064, 0.064, 0.316, 9);
  roll.rotateZ(Math.PI / 2);
  mesh(roll, blanket, pack, 0, 0.218, -0.013);
  for (const side of [1, -1]) {
    const x = side * 0.1;
    const strap = mesh(new THREE.TorusGeometry(0.062, 0.009, 4, 9), binding, pack, x, 0.218, -0.013);
    strap.rotation.y = Math.PI / 2;
    mesh(new THREE.BoxGeometry(0.026, 0.282, 0.018), binding, pack, x, -0.004, -0.087);
    mesh(new THREE.BoxGeometry(0.036, 0.031, 0.012), brass, pack, x, 0.066, -0.101);
    const end = mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.007, 8), blanketEdge, pack, side * 0.16, 0.218, -0.013);
    end.rotation.z = Math.PI / 2;

    const harnessX = side * shape.chest * 0.67;
    fold(torso, binding, 0.027, [[harnessX, 0.393, 0.082], [harnessX, 0.337, 0.124],
      [harnessX, 0.244, 0.122], [side * shape.hip * 0.62, 0.113, 0.111]]);
    mesh(new THREE.BoxGeometry(0.028, 0.027, 0.011), brass, torso, harnessX, 0.283, 0.128);
    const over = mesh(new THREE.BoxGeometry(0.028, 0.026, 0.183), binding, torso, harnessX, 0.385, -0.019);
    over.rotation.x = -0.09;
  }

  // --- Gear.
  const gearGroups: Partial<Record<GearId, THREE.Group[]>> = {};
  const registerGear = (id: GearId, groups: THREE.Group[]): void => {
    gearGroups[id] = groups;
    for (const g of groups) g.visible = false;
  };

  const snowshoe = (parent: THREE.Object3D): THREE.Group => {
    const g = group(parent);
    const netMat = m(ROPE, { side: THREE.DoubleSide });
    const net = new THREE.CircleGeometry(1, 12);
    net.rotateX(-Math.PI / 2);
    net.scale(0.1, 1, 0.3);
    mesh(net, netMat, g, 0, -0.035, -0.06);
    const rim = new THREE.TorusGeometry(1, 0.03, 4, 14);
    rim.rotateX(Math.PI / 2);
    rim.scale(0.1, 1, 0.3);
    mesh(rim, woodDark, g, 0, -0.035, -0.06);
    for (const z of [-0.14, 0.05]) mesh(new THREE.BoxGeometry(0.2, 0.025, 0.025), woodDark, g, 0, -0.03, z);
    mesh(new THREE.BoxGeometry(0.13, 0.03, 0.05), scarfMat, g, 0, 0.005, 0.0); // binding across the boot
    return g;
  };
  registerGear("snowshoes", legs.map((l) => snowshoe(l.sole)));

  const geta = (parent: THREE.Object3D): THREE.Group => {
    const g = group(parent);
    mesh(new THREE.BoxGeometry(0.13, 0.03, 0.26), wood, g, 0, -0.025, 0);
    for (const z of [-0.07, 0.08]) mesh(new THREE.BoxGeometry(0.13, 0.07, 0.035), woodDark, g, 0, -0.075, z);
    mesh(new THREE.BoxGeometry(0.14, 0.03, 0.04), scarfMat, g, 0, 0.005, 0.03);
    // The thong (hanao): a loop rising from the toe post that the big toe hooks.
    const thong = new THREE.TorusGeometry(0.05, 0.012, 4, 8, Math.PI);
    thong.rotateZ(Math.PI);
    thong.scale(1, 0.7, 1);
    mesh(thong, scarfMat, g, 0, 0.01, 0.05);
    mesh(new THREE.BoxGeometry(0.02, 0.025, 0.02), woodDark, g, 0, -0.005, 0.07);
    return g;
  };
  registerGear("geta", legs.map((l) => geta(l.sole)));

  // Waraji-style ash sandals: a thick woven sole over a charred underlayer, an upturned toe guard, cords that cross
  // the instep and wrap the ankle in sulphur-yellow cloth.
  const charcoal = m(0x2f2b2c);
  const strawAsh = m(ASH);
  const cord = m(0xd0a647);
  const sandal = (parent: THREE.Object3D): THREE.Group => {
    const g = group(parent);
    mesh(new THREE.BoxGeometry(0.12, 0.016, 0.265), charcoal, g, 0, -0.022, 0.01);
    mesh(new THREE.BoxGeometry(0.13, 0.03, 0.27), strawAsh, g, 0, -0.003, 0.01);
    for (const z of [-0.08, -0.02, 0.04, 0.1]) mesh(new THREE.BoxGeometry(0.134, 0.008, 0.018), charcoal, g, 0, 0.014, z); // woven ridges
    const toe = mesh(new THREE.BoxGeometry(0.12, 0.03, 0.05), strawAsh, g, 0, 0.012, 0.15);
    toe.rotation.x = -0.45; // the toe curls up against the ash
    for (const side of [1, -1]) {
      const strap = mesh(new THREE.BoxGeometry(0.018, 0.012, 0.15), cord, g, side * 0.03, 0.045, 0.01);
      strap.rotation.set(0.0, -side * 0.28, -side * 0.35);
    }
    const cuff = new THREE.TorusGeometry(0.068, 0.014, 4, 10);
    cuff.rotateX(Math.PI / 2);
    mesh(cuff, cord, g, 0, 0.1, -0.01);
    mesh(new THREE.BoxGeometry(0.03, 0.04, 0.02), cord, g, 0, 0.07, 0.06); // knot
    return g;
  };
  registerGear("ashSandals", legs.map((l) => sandal(l.sole)));

  // A chōchin with pleated paper, bamboo ribs, dark caps, and a loop handle.
  const lantern = group(arms[0].hand);
  const frame = m(0x4c3026);
  const bamboo = m(0xa77345);
  const paper = m(0xd9ba83, { emissive: 0xffad4b, emissiveIntensity: 0 });
  const pleats = [
    [0.075, -0.349], [0.092, -0.332], [0.119, -0.297], [0.134, -0.259],
    [0.139, -0.219], [0.134, -0.179], [0.119, -0.141], [0.092, -0.106], [0.075, -0.089],
  ];
  mesh(new THREE.LatheGeometry(pleats.map(([radius, y]) => new THREE.Vector2(radius, y)), 12), paper, lantern);
  for (const [radius, y] of pleats.slice(2, -1).filter((_, i) => i % 2 === 0)) {
    const rib = new THREE.TorusGeometry(radius, 0.005, 4, 12);
    rib.rotateX(Math.PI / 2);
    mesh(rib, bamboo, lantern, 0, y, 0);
  }
  mesh(new THREE.CylinderGeometry(0.074, 0.091, 0.026, 12), frame, lantern, 0, -0.085, 0);
  mesh(new THREE.CylinderGeometry(0.092, 0.073, 0.030, 12), frame, lantern, 0, -0.352, 0);
  mesh(new THREE.TorusGeometry(0.072, 0.009, 4, 14, Math.PI), frame, lantern, 0, -0.079, 0);
  const lanternLight = new THREE.PointLight(0xffb15e, 0, 4.6);
  lanternLight.position.y = -0.25;
  lantern.add(lanternLight);
  registerGear("lantern", [lantern]);

  // Two walking sticks, pilgrim style, and a coil of rope, shown only on mountains. The sticks are held
  // in the hands; the rope hangs on the pack.
  const makeStick = (): THREE.Group => {
    const g = group(root);
    const shaft = new THREE.CylinderGeometry(0.017, 0.021, 0.9, 5);
    shaft.translate(0, -0.15, 0);
    mesh(shaft, wood, g);
    mesh(new THREE.IcosahedronGeometry(0.032, 0), woodDark, g, 0, 0.31, 0);
    mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.035, 6), scarfMat, g, 0, -0.06, 0);
    const tip = new THREE.ConeGeometry(0.02, 0.06, 5);
    tip.rotateX(Math.PI);
    mesh(tip, m(0x9a9aa0), g, 0, -0.63, 0);
    return g;
  };
  const sticks = [makeStick(), makeStick()] as const;
  const rope = group(pack, 0, -0.1, -0.1);
  const coilGeo = new THREE.TorusGeometry(0.1, 0.028, 5, 12);
  mesh(coilGeo, m(ROPE), rope);
  mesh(new THREE.BoxGeometry(0.05, 0.05, 0.03), scarfMat, rope, 0, 0.0, 0.0);
  sticks.forEach((stick, i) => {
    arms[i]!.hand.add(stick);
    stick.position.set(0, 0.02, 0.01);
  });
  let stickState: "hidden" | "held" = "hidden";
  const placeSticks = (next: "hidden" | "held"): void => {
    rope.visible = next === "held";
    sticks.forEach((stick) => (stick.visible = next === "held"));
    stickState = next;
  };
  placeSticks("hidden");

  let gear: GearId | null = null;
  let phase = 0;
  let walkSmooth = 0;
  let seatedSmooth = 0;
  let crouch = 0;
  let fuss = 0;
  let draw: number | null = null;
  let lighting: LanternLighting | undefined;
  let lanternTime = 0;
  let lapRest = 0;
  const refreshSticks = (): void => placeSticks(gear === "climbing" ? "held" : "hidden");
  /** How far gear raises the feet, so the hips follow it. */
  const FOOT_LIFT: Readonly<Partial<Record<GearId, number>>> = { geta: 0.095, snowshoes: 0.03, ashSandals: 0.012 };

  const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

  return {
    root,
    setGear(next) {
      gear = next;
      for (const [id, groups] of Object.entries(gearGroups) as Array<[GearId, THREE.Group[]]>) {
        for (const g of groups) g.visible = id === next;
      }
      refreshSticks();
    },
    setDraw(progress) {
      draw = progress;
    },
    setLanternLighting(next) {
      lighting = next;
    },
    setLapRest(amount) {
      lapRest = amount;
    },
    setCrouch(amount, fussing) {
      crouch = amount;
      fuss = fussing;
    },
    update(dt, walk, seated) {
      const k = Math.min(1, dt * 9);
      walkSmooth += (walk - walkSmooth) * k;
      seatedSmooth += (seated - seatedSmooth) * Math.min(1, dt * 10);
      const w = walkSmooth * (1 - seatedSmooth);
      const before = phase;
      phase += dt * Math.PI * 2 * CADENCE * walkSmooth;
      const s = Math.sin(phase);
      const c = Math.cos(phase);
      const wide = gear === "snowshoes" ? 1.5 : 1;
      const stride = gear === "snowshoes" ? 0.55 : gear === "geta" ? 0.45 : 0.68;
      const lift = (gear && FOOT_LIFT[gear]) || 0;
      const t = seatedSmooth;
      const resting = lapRest * t;

      legs.forEach((leg, i) => {
        const side = i === 0 ? 1 : -1;
        const ph = i === 0 ? s : -s;
        const phc = i === 0 ? c : -c;
        const thigh = -ph * stride * w;
        const shin = Math.max(0, phc) * (gear === "snowshoes" ? 1.25 : 0.95) * w + 0.12 * w;
        leg.hip.rotation.x = lerp(thigh, -1.4, t);
        leg.hip.rotation.z = side * (wide - 1) * 0.09 * w;
        leg.hip.position.x = side * shape.hip * 0.55 * (1 + (wide - 1) * 0.5);
        leg.knee.rotation.x = lerp(shin, 1.4, t);
        // Keep the sole level while the leg swings (snowshoes and geta stay flat, boots toe off a little).
        const level = gear === "snowshoes" || gear === "geta" ? 0.85 : 0.55;
        leg.sole.rotation.x = lerp(-(thigh + shin) * level, -(leg.hip.rotation.x + leg.knee.rotation.x) * 0.4, t);
      });

      for (const [i, arm] of arms.entries()) {
        const ph = i === 0 ? s : -s;
        // Arms swing against the legs: the right arm goes forward with the left leg.
        arm.shoulder.rotation.x = lerp(ph * 0.8 * w, -0.7, t);
        arm.shoulder.rotation.z = (i === 0 ? -1 : 1) * 0.08;
        arm.elbow.rotation.x = lerp(-0.3 - 0.5 * Math.max(0, -ph) * w, -0.55, t);
        if (resting > 0) {
          const side = i === 0 ? 1 : -1;
          // Bring the elbows in and let one hand sit slightly ahead of the other.
          arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, -0.18 - side * 0.045, resting);
          arm.shoulder.rotation.z = lerp(arm.shoulder.rotation.z, -side * (shape.skirt ? 0.29 : 0.39), resting);
          arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, -0.67 - side * 0.025, resting);
        }
      }

      const bob = (0.5 - 0.5 * Math.cos(phase * 2)) * 0.045 * w;
      const sit = HIP_Y - 0.17;
      pelvis.position.y = lerp(HIP_Y + lift + bob, sit + lift * 0.3, t);
      pelvis.rotation.y = s * 0.13 * w;
      pelvis.position.x = c * 0.025 * w;
      torso.rotation.y = -s * 0.17 * w + 0.045 * resting;
      torso.rotation.x = 0.05 * w + 0.12 * t + 0.25 * resting;
      torso.rotation.z = -c * 0.06 * w;
      head.rotation.x = -0.04 * w - 0.08 * t - 0.15 * resting;
      head.rotation.y = -(torso.rotation.y + pelvis.rotation.y) * 0.7;
      head.rotation.z = c * 0.03 * w;
      pack.rotation.z = -c * 0.03 * w;
      if (ponytail) {
        // The tail hangs back and swings, the tip lagging behind the base.
        ponytail.base.rotation.x = 0.32 + 0.26 * w - 0.40 * t;
        ponytail.base.rotation.z = 0.24 - s * 0.1 * w;
        ponytail.upper.rotation.x = 0.1 + Math.sin(phase * 2 + 0.6) * 0.14 * w;
        ponytail.upper.rotation.z = -s * 0.1 * w;
        ponytail.lower.rotation.x = 0.12 + Math.sin(phase * 2 + 1.5) * 0.24 * w + Math.sin(performance.now() / 900) * 0.02;
        ponytail.lower.rotation.z = -s * 0.16 * w;
      }
      const breeze = Math.sin(performance.now() / 700);
      scarfTail.rotation.x = 0.28 + 0.45 * w + Math.sin(phase * 2 + 1) * 0.13 * w + breeze * 0.025;
      scarfTail.rotation.z = -s * 0.08 * w;
      scarfTip.rotation.x = 0.14 + w * Math.sin(phase * 2 - 0.2) * 0.21 + breeze * 0.045;
      scarfTip.rotation.z = -s * 0.11 * w;

      if (crouch > 0) {
        // Squat and reach for the feet, overriding the walk.
        const a = crouch;
        for (const [i, leg] of legs.entries()) {
          leg.hip.rotation.x = lerp(leg.hip.rotation.x, -1.15, a);
          leg.knee.rotation.x = lerp(leg.knee.rotation.x, 1.7, a);
          leg.hip.rotation.z *= 1 - a;
          leg.sole.rotation.x = lerp(leg.sole.rotation.x, -0.55, a);
          const reach = i === 0 ? 1 : -1;
          arms[i]!.shoulder.rotation.x = lerp(arms[i]!.shoulder.rotation.x, -0.95 + fuss * 0.18 * reach, a);
          arms[i]!.elbow.rotation.x = lerp(arms[i]!.elbow.rotation.x, -0.55 + fuss * 0.12 * reach, a);
        }
        pelvis.position.y = lerp(pelvis.position.y, HIP_Y * 0.67 + lift * 0.5, a);
        pelvis.position.x *= 1 - a;
        pelvis.rotation.y *= 1 - a;
        torso.rotation.x = lerp(torso.rotation.x, 0.85, a);
        torso.rotation.y *= 1 - a;
        head.rotation.x = lerp(head.rotation.x, -0.55, a);
      }

      if (draw !== null) {
        // Reach back for the sticks, bring them round, then plant them a couple of times.
        const sm = (x: number): number => {
          const u = Math.min(1, Math.max(0, x));
          return u * u * (3 - 2 * u);
        };
        const reachW = sm(draw / 0.16) * (1 - sm((draw - 0.24) / 0.1));
        const plantW = sm((draw - 0.3) / 0.12) * (1 - sm((draw - 0.88) / 0.1));
        const tap = (draw - 0.5) * Math.PI * 9;
        for (const [i, arm] of arms.entries()) {
          const alt = i === 0 ? Math.max(0, Math.sin(tap)) : Math.max(0, -Math.sin(tap));
          arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, 2.4, reachW);
          arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, -0.45, reachW);
          arm.shoulder.rotation.x = lerp(arm.shoulder.rotation.x, -0.85 + alt * 0.3, plantW);
          arm.elbow.rotation.x = lerp(arm.elbow.rotation.x, -0.5, plantW);
        }
        torso.rotation.x += 0.18 * plantW - 0.12 * reachW;
        head.rotation.x -= 0.1 * plantW;
      }
      if (gear === "lantern" || lighting) {
        lanternTime += dt;
        const right = arms[0];
        const left = arms[1];
        const progress = lighting?.progress ?? 1;
        const raise = smooth(progress / 0.22);
        const inspect = smooth((progress - 0.14) / 0.18) * (1 - smooth((progress - 0.72) / 0.25));
        const shield = smooth((progress - 0.12) / 0.15) * (1 - smooth((progress - 0.38) / 0.23));
        right.shoulder.rotation.x = lerp(right.shoulder.rotation.x, -0.52 - inspect * 0.36 + s * 0.05 * w, raise);
        right.shoulder.rotation.z -= inspect * 0.15;
        right.elbow.rotation.x = lerp(right.elbow.rotation.x, -0.92 - inspect * 0.32, raise);
        left.shoulder.rotation.x = lerp(left.shoulder.rotation.x, -0.75, shield);
        left.shoulder.rotation.z = lerp(left.shoulder.rotation.z, 0.63, shield);
        left.elbow.rotation.x = lerp(left.elbow.rotation.x, -1.03, shield);
        head.rotation.y += inspect * 0.32;
        head.rotation.x += inspect * 0.13;
        lantern.rotation.x = -(right.shoulder.rotation.x + right.elbow.rotation.x + torso.rotation.x) + 0.09 * Math.sin(lanternTime * 3.1);
        lantern.rotation.z = -right.shoulder.rotation.z + 0.07 * Math.sin(lanternTime * 2.2);
        const flame = smooth(lighting?.flame ?? 1) * (0.95 + 0.03 * Math.sin(lanternTime * 13) + 0.02 * Math.sin(lanternTime * 21));
        paper.emissiveIntensity = flame * 1.5;
        lanternLight.intensity = flame * 10;
      }
      if (stickState === "held") {
        // Keep each stick at a steady angle from the ground whatever the arm is doing.
        sticks.forEach((stick, i) => {
          const arm = arms[i]!;
          stick.rotation.x = -(arm.shoulder.rotation.x + arm.elbow.rotation.x + torso.rotation.x) - 0.3;
        });
      }

      // A foot is flat under the hip when its swing crosses zero: the right leg at half a cycle, the left at a full one.
      const steps: FootStep[] = [];
      if (w > 0.5 && phase > before) {
        const crossed = (at: number): boolean => Math.floor((phase - at) / TAU) > Math.floor((before - at) / TAU);
        legs.forEach((leg, i) => {
          if (!crossed(i === 0 ? Math.PI : 0)) return;
          root.updateWorldMatrix(true, true);
          leg.sole.getWorldPosition(footPoint);
          steps.push({ x: footPoint.x, z: footPoint.z });
        });
      }
      return steps;
    },
    dispose() {
      owned.forEach((g) => g.dispose());
      materials.forEach((x) => x.dispose());
    },
  };
}
