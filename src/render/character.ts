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
  dispose(): void;
}

const SKIN = 0xf0c9a4;
const SHIRT = palette.cream;
const TROUSERS = 0x56715c;
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
  female: { chest: 0.185, hip: 0.185, headR: 0.185, scale: 0.92, skirt: true, hair: 0x3a2a26 },
  male: { chest: 0.235, hip: 0.17, headR: 0.18, scale: 1, skirt: false, hair: 0x4a3c37 },
};

/**
 * A stylised traveller: pale shirt, loose trousers, a scarf and a wooden pack on the back, in the
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
  /** A limb segment hanging down from its pivot. */
  const limb = (rTop: number, rBottom: number, length: number, material: THREE.Material, parent: THREE.Object3D): THREE.Mesh => {
    const geo = new THREE.CylinderGeometry(rTop, rBottom, length, 6);
    geo.translate(0, -length / 2, 0);
    return mesh(geo, material, parent);
  };

  const shirt = m(SHIRT);
  const trousers = m(TROUSERS);
  const skin = m(SKIN);
  const boot = m(BOOT);
  const scarfMat = m(palette.red);
  const wood = m(WOOD);
  const woodDark = m(WOOD_DARK);

  // --- Legs and pelvis.
  const THIGH = 0.26;
  const SHIN = 0.26;
  const BOOT_H = 0.075;
  const HIP_Y = THIGH + SHIN + BOOT_H;
  const pelvis = group(root, 0, HIP_Y, 0);
  mesh(new THREE.CylinderGeometry(shape.hip, shape.hip * 0.9, 0.14, 6), trousers, pelvis, 0, 0.0, 0);

  interface Leg {
    readonly hip: THREE.Group;
    readonly knee: THREE.Group;
    readonly sole: THREE.Group;
  }
  const makeLeg = (side: 1 | -1): Leg => {
    const hip = group(pelvis, side * shape.hip * 0.55, -0.02, 0);
    limb(0.1, 0.08, THIGH, trousers, hip);
    const knee = group(hip, 0, -THIGH, 0);
    limb(0.08, 0.06, SHIN, trousers, knee);
    const ankle = group(knee, 0, -SHIN, 0);
    mesh(new THREE.BoxGeometry(0.115, BOOT_H, 0.22), boot, ankle, 0, -BOOT_H / 2 + 0.01, 0.045);
    const sole = group(ankle, 0, -BOOT_H + 0.01, 0.04);
    return { hip, knee, sole };
  };
  const legs = [makeLeg(1), makeLeg(-1)] as const;

  // --- Torso.
  const torso = group(pelvis, 0, 0.05, 0);
  const chestGeo = new THREE.CylinderGeometry(shape.chest, shape.hip * 0.85, 0.42, 6);
  chestGeo.translate(0, 0.21, 0);
  const chest = mesh(chestGeo, shirt, torso);
  chest.scale.z = 0.82;
  if (shape.skirt) {
    // A loose tunic hem that swings out over the thighs.
    const skirtGeo = new THREE.CylinderGeometry(shape.hip * 0.95, shape.hip * 1.45, 0.2, 6, 1, true);
    skirtGeo.translate(0, -0.06, 0);
    const skirt = mesh(skirtGeo, m(SHIRT, { side: THREE.DoubleSide }), torso);
    skirt.scale.z = 0.8;
  }
  // Waist sash.
  const sash = mesh(new THREE.CylinderGeometry(shape.hip * 0.9, shape.hip * 0.9, 0.06, 6), m(palette.roof), torso, 0, 0.04, 0);
  sash.scale.z = 0.78;

  // --- Head.
  const neck = group(torso, 0, 0.42, 0);
  mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.08, 6), skin, neck, 0, 0.02, 0);
  const head = group(neck, 0, 0.17, 0);
  mesh(new THREE.IcosahedronGeometry(shape.headR, 1), skin, head);
  const eye = m(0x2a2424);
  for (const side of [1, -1]) {
    mesh(new THREE.BoxGeometry(0.03, 0.045, 0.02), eye, head, side * 0.065, 0.0, shape.headR * 0.93);
  }
  let ponytail: { readonly base: THREE.Group; readonly upper: THREE.Group; readonly lower: THREE.Group } | null = null;
  const hairMat = m(shape.hair);
  const cap = new THREE.SphereGeometry(shape.headR * 1.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.56);
  cap.rotateX(-0.28);
  mesh(cap, hairMat, head, 0, 0.012, -0.012);
  if (variant === "female") {
    // Hair swept back and gathered into a high ponytail: smooth back of the scalp, a tie, and a tail
    // in two segments that swings with the walk (see `ponytail` in `update`).
    mesh(new THREE.BoxGeometry(0.3, 0.17, 0.09), hairMat, head, 0, 0.0, -0.12);
    for (const side of [1, -1]) mesh(new THREE.BoxGeometry(0.04, 0.17, 0.09), hairMat, head, side * 0.155, -0.04, -0.03);
    const ponyBase = group(head, 0, 0.075, -0.2);
    mesh(new THREE.IcosahedronGeometry(0.055, 0), hairMat, ponyBase, 0, 0, 0.0);
    mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.03, 6), scarfMat, ponyBase, 0, -0.03, 0); // hair tie
    const upper = group(ponyBase, 0, -0.04, 0);
    const upperGeo = new THREE.CylinderGeometry(0.06, 0.05, 0.17, 6);
    upperGeo.translate(0, -0.085, 0);
    mesh(upperGeo, hairMat, upper);
    const lower = group(upper, 0, -0.17, 0);
    const lowerGeo = new THREE.ConeGeometry(0.05, 0.2, 6);
    lowerGeo.rotateX(Math.PI);
    lowerGeo.translate(0, -0.1, 0);
    mesh(lowerGeo, hairMat, lower);
    ponytail = { base: ponyBase, upper, lower };
  } else {
    for (const [x, rz] of [[-0.08, 0.3], [0.06, -0.2], [0.13, -0.5]] as const) {
      const tuft = mesh(new THREE.ConeGeometry(0.045, 0.12, 4), hairMat, head, x, 0.17, 0.04);
      tuft.rotation.z = rz;
    }
    mesh(new THREE.BoxGeometry(0.3, 0.12, 0.08), hairMat, head, 0, -0.01, -0.13);
  }

  // --- Scarf, with a tail that streams behind.
  mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.07, 6), scarfMat, torso, 0, 0.42, 0);
  const scarfTail = group(torso, 0.07, 0.42, -0.1);
  const scarfGeo = new THREE.BoxGeometry(0.07, 0.3, 0.025);
  scarfGeo.translate(0, -0.15, 0);
  mesh(scarfGeo, scarfMat, scarfTail);

  // --- Arms.
  interface Arm {
    readonly shoulder: THREE.Group;
    readonly elbow: THREE.Group;
    readonly hand: THREE.Group;
  }
  const makeArm = (side: 1 | -1): Arm => {
    const shoulder = group(torso, side * (shape.chest + 0.03), 0.38, 0);
    limb(0.065, 0.058, 0.19, shirt, shoulder);
    const elbow = group(shoulder, 0, -0.19, 0);
    limb(0.058, 0.045, 0.17, shirt, elbow);
    const hand = group(elbow, 0, -0.18, 0);
    mesh(new THREE.IcosahedronGeometry(0.05, 0), skin, hand);
    return { shoulder, elbow, hand };
  };
  const arms = [makeArm(1), makeArm(-1)] as const;

  // --- Pack: a wooden box frame carried on the back, with a bedroll and shoulder straps.
  const pack = group(torso, 0, 0.2, -shape.chest * 0.72 - 0.1);
  mesh(new THREE.BoxGeometry(0.3, 0.34, 0.16), wood, pack);
  mesh(new THREE.BoxGeometry(0.32, 0.03, 0.18), woodDark, pack, 0, 0.0, 0);
  mesh(new THREE.BoxGeometry(0.03, 0.34, 0.18), woodDark, pack, 0.1, 0, 0);
  mesh(new THREE.BoxGeometry(0.03, 0.34, 0.18), woodDark, pack, -0.1, 0, 0);
  const roll = new THREE.CylinderGeometry(0.06, 0.06, 0.34, 7);
  roll.rotateZ(Math.PI / 2);
  mesh(roll, m(0x6f8f78), pack, 0, 0.23, 0);
  mesh(new THREE.BoxGeometry(0.31, 0.025, 0.05), m(palette.roof), pack, 0, 0.23, 0.01);
  for (const side of [1, -1]) {
    mesh(new THREE.BoxGeometry(0.035, 0.38, 0.03), m(palette.roof), torso, side * shape.chest * 0.6, 0.22, shape.chest * 0.72 * 0.78);
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
      }

      const bob = (0.5 - 0.5 * Math.cos(phase * 2)) * 0.045 * w;
      const sit = HIP_Y - 0.17;
      pelvis.position.y = lerp(HIP_Y + lift + bob, sit + lift * 0.3, t);
      pelvis.rotation.y = s * 0.13 * w;
      pelvis.position.x = c * 0.025 * w;
      torso.rotation.y = -s * 0.17 * w;
      torso.rotation.x = 0.05 * w + 0.12 * t;
      torso.rotation.z = -c * 0.06 * w;
      head.rotation.x = -0.04 * w - 0.08 * t;
      head.rotation.y = -(torso.rotation.y + pelvis.rotation.y) * 0.7;
      head.rotation.z = c * 0.03 * w;
      pack.rotation.z = -c * 0.03 * w;
      if (ponytail) {
        // The tail hangs back and swings, the tip lagging behind the base.
        ponytail.base.rotation.x = 0.45 + 0.3 * w - 0.5 * t;
        ponytail.base.rotation.z = -s * 0.1 * w;
        ponytail.upper.rotation.x = 0.1 + Math.sin(phase * 2 + 0.6) * 0.14 * w;
        ponytail.upper.rotation.z = -s * 0.1 * w;
        ponytail.lower.rotation.x = 0.12 + Math.sin(phase * 2 + 1.5) * 0.24 * w + Math.sin(performance.now() / 900) * 0.02;
        ponytail.lower.rotation.z = -s * 0.16 * w;
      }
      scarfTail.rotation.x = 0.35 + 0.5 * w + Math.sin(phase * 2 + 1) * 0.12 * w + Math.sin(performance.now() / 700) * 0.03;

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
