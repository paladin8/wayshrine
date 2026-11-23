import * as THREE from "three";
import { palette } from "./palette";

export const CHARACTER_VARIANTS = ["female", "male"] as const;
export type CharacterVariant = (typeof CHARACTER_VARIANTS)[number];

/** Gear that shows on the character: each is worn or carried on the biome that needs it. */
export type GearId = "snowshoes" | "geta" | "ashSandals" | "lantern" | "climbing";

export interface Character {
  readonly root: THREE.Group;
  /** Advance the walk cycle. `walk` is 0 (standing) to 1 (walking), `seated` is 0 to 1. */
  update(dt: number, walk: number, seated: number): void;
  setGear(gear: GearId | null): void;
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
export function buildCharacter(variant: CharacterVariant): Character {
  const shape = SHAPES[variant];
  const root = new THREE.Group();
  root.scale.setScalar(shape.scale);
  const owned: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];
  const m = (color: number, extra?: Partial<THREE.MeshStandardMaterialParameters>): THREE.MeshStandardMaterial => {
    const made = mat(color, extra);
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
    const skirt = mesh(skirtGeo, mat(SHIRT, { side: THREE.DoubleSide }), torso);
    materials.push(skirt.material as THREE.Material);
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
  const hairMat = m(shape.hair);
  const cap = new THREE.SphereGeometry(shape.headR * 1.1, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.56);
  cap.rotateX(-0.28);
  mesh(cap, hairMat, head, 0, 0.012, -0.012);
  if (variant === "female") {
    mesh(new THREE.BoxGeometry(0.33, 0.24, 0.1), hairMat, head, 0, -0.06, -0.12); // back of a bob
    const tail = mesh(new THREE.ConeGeometry(0.05, 0.22, 5), hairMat, head, 0, 0.1, -0.22);
    tail.rotation.x = 2.5; // tied tuft, flicking up and back
    for (const side of [1, -1]) mesh(new THREE.BoxGeometry(0.05, 0.2, 0.09), hairMat, head, side * 0.165, -0.04, -0.03);
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
    return g;
  };
  registerGear("geta", legs.map((l) => geta(l.sole)));

  const sandal = (parent: THREE.Object3D): THREE.Group => {
    const g = group(parent);
    mesh(new THREE.BoxGeometry(0.125, 0.02, 0.25), m(ASH), g, 0, -0.012, 0.01);
    mesh(new THREE.BoxGeometry(0.13, 0.025, 0.035), woodDark, g, 0, 0.005, 0.03);
    return g;
  };
  registerGear("ashSandals", legs.map((l) => sandal(l.sole)));

  // A paper lantern hanging from a short pole carried in the right hand.
  const lantern = group(arms[0].hand);
  mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5), woodDark, lantern, 0, 0.03, 0.04);
  const bodyMat = m(palette.glow, { emissive: palette.glow, emissiveIntensity: 0.9 });
  mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.13, 7), bodyMat, lantern, 0, -0.15, 0.04);
  mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.025, 7), m(palette.roof), lantern, 0, -0.225, 0.04);
  mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.025, 7), m(palette.roof), lantern, 0, -0.085, 0.04);
  registerGear("lantern", [lantern]);

  // A coil of rope over the shoulder and an ice axe lashed to the pack.
  const climbing = group(torso);
  const coil = new THREE.TorusGeometry(0.15, 0.03, 5, 12);
  coil.rotateY(Math.PI / 2);
  const coilMesh = mesh(coil, m(ROPE), climbing, 0, 0.26, 0);
  coilMesh.rotation.z = 0.5;
  coilMesh.scale.set(1, 1, 0.8);
  const axe = group(pack, 0.17, 0, -0.04);
  mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.5, 5), woodDark, axe, 0, 0.05, 0);
  mesh(new THREE.BoxGeometry(0.1, 0.025, 0.025), m(0x9a9aa0), axe, 0, 0.3, 0);
  registerGear("climbing", [climbing, axe]);

  let gear: GearId | null = null;
  let phase = 0;
  let walkSmooth = 0;
  let seatedSmooth = 0;
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
    },
    update(dt, walk, seated) {
      const k = Math.min(1, dt * 9);
      walkSmooth += (walk - walkSmooth) * k;
      seatedSmooth += (seated - seatedSmooth) * Math.min(1, dt * 10);
      const w = walkSmooth * (1 - seatedSmooth);
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
      if (gear === "lantern" && t < 1) {
        // Hold the lantern pole out ahead, steady against the swing.
        const hold = 1 - t;
        arms[0].shoulder.rotation.x = lerp(arms[0].shoulder.rotation.x, -0.5 + s * 0.08 * w, hold);
        arms[0].elbow.rotation.x = lerp(arms[0].elbow.rotation.x, -1.0, hold);
        lantern.rotation.x = -(arms[0].shoulder.rotation.x + arms[0].elbow.rotation.x) - 0.05 + Math.sin(phase * 2) * 0.05 * w;
      } else {
        lantern.rotation.set(0, 0, 0);
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
      scarfTail.rotation.x = 0.35 + 0.5 * w + Math.sin(phase * 2 + 1) * 0.12 * w + Math.sin(performance.now() / 700) * 0.03;
    },
    dispose() {
      owned.forEach((g) => g.dispose());
      materials.forEach((x) => x.dispose());
    },
  };
}
