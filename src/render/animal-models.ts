import * as THREE from "three";

export type Species = "deer" | "serow" | "boar" | "crane" | "fox" | "otter" | "dolphin" | "whale";
/** Animals that live only on landmarks, where an authored anchor places them. */
export type LandmarkSpecies = "macaque" | "bear" | "horse" | "camel" | "buffalo";
export type AnimalKind = Species | LandmarkSpecies;

export interface AnimalOptions {
  /** Lie down, where the species has a resting pose (deer, camel). */
  readonly resting?: boolean;
  /** Snow settled on the head, for the macaques that soak in the cold. */
  readonly snowcap?: boolean;
  /** A red blanket over the hump, for the camels that give rides. */
  readonly saddle?: boolean;
}

interface BeastShape {
  readonly back: number;
  readonly belly: number;
  readonly dark: number;
  readonly lower: number;
  readonly hip: number;
  readonly width: number;
  readonly length: number;
  readonly depth: number;
  readonly leg: number;
  readonly shin: number;
  readonly bounce: number;
  readonly swing: number;
}

const BEASTS: Readonly<Record<"horse" | "camel" | "buffalo" | "bear", BeastShape>> = {
  horse: { back: 0x6a4630, belly: 0x80593c, dark: 0x2c211d, lower: 0x2c211d, hip: 1.0, width: 0.27, length: 0.66, depth: 0.34, leg: 0.062, shin: 0.044, bounce: 0.04, swing: 0.55 },
  camel: { back: 0xb08a5c, belly: 0xcaa878, dark: 0x5b4532, lower: 0xb08a5c, hip: 1.12, width: 0.27, length: 0.64, depth: 0.33, leg: 0.07, shin: 0.05, bounce: 0.03, swing: 0.45 },
  buffalo: { back: 0x4c4642, belly: 0x5d5550, dark: 0x2b2624, lower: 0xb3a994, hip: 0.62, width: 0.37, length: 0.64, depth: 0.40, leg: 0.095, shin: 0.075, bounce: 0.02, swing: 0.4 },
  bear: { back: 0x5c402c, belly: 0x6d4e38, dark: 0x2e2018, lower: 0x5c402c, hip: 0.5, width: 0.36, length: 0.62, depth: 0.40, leg: 0.12, shin: 0.10, bounce: 0.035, swing: 0.5 },
};

const MACAQUE = { fur: 0xa38c74, belly: 0xc7b399, face: 0xd86a5c, dark: 0x4a3a30, snow: 0xf1f4f6 };

interface Coat {
  readonly back: number;
  readonly belly: number;
  readonly dark: number;
}

const COATS: Readonly<Record<Species, Coat>> = {
  deer: { back: 0xb67d52, belly: 0xf3d6a5, dark: 0x563d36 },
  serow: { back: 0x7b7268, belly: 0xc5bbae, dark: 0x393537 },
  boar: { back: 0x56433b, belly: 0x897262, dark: 0x3a302e },
  crane: { back: 0xece9d9, belly: 0xe0dccc, dark: 0x35393f },
  fox: { back: 0xbd663b, belly: 0xf2cfaa, dark: 0x554448 },
  otter: { back: 0x755849, belly: 0xc69c76, dark: 0x513e3c },
  dolphin: { back: 0x708ca5, belly: 0xc8dbe0, dark: 0x425975 },
  whale: { back: 0x42546e, belly: 0xa3b7bc, dark: 0x303d55 },
};

export interface AnimalModel {
  readonly group: THREE.Group;
  /** `lift` is how far an authored hop has raised the actor, from 0 to 1; a displaying crane spreads its wings with it. */
  pose(time: number, gait: number, phase: number, lift?: number): void;
}

export function createAnimalModels() {
  const body = new THREE.IcosahedronGeometry(1, 0);
  const softBody = new THREE.IcosahedronGeometry(1, 1);
  const limb = new THREE.CylinderGeometry(0.75, 1, 1, 5);
  const blade = new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0.16, 1, 0, -0.72, 0.14, 0, -0.47], 3));
  blade.computeVertexNormals();
  const materials = new Map<number, THREE.MeshStandardMaterial>();

  function mesh(parent: THREE.Group, color: number, x: number, y: number, z: number, sx: number, sy: number, sz: number, geometry: THREE.BufferGeometry = body): THREE.Mesh {
    let material = materials.get(color);
    if (!material) {
      material = new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide });
      materials.set(color, material);
    }
    const piece = new THREE.Mesh(geometry, material);
    piece.position.set(x, y, z);
    piece.scale.set(sx, sy, sz);
    piece.castShadow = true;
    parent.add(piece);
    return piece;
  }

  function pivot(parent: THREE.Group, x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group();
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  function bone(parent: THREE.Group, color: number, start: [number, number, number], end: [number, number, number], radius: number): void {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const axis = b.clone().sub(a);
    const centre = a.lerp(b, 0.5);
    const piece = mesh(parent, color, centre.x, centre.y, centre.z, radius, axis.length(), radius, limb);
    piece.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.normalize());
  }

  function quadruped(species: "deer" | "serow" | "boar" | "fox", antlers: boolean, resting = false): AnimalModel {
    const group = new THREE.Group();
    const { back, belly, dark } = COATS[species];
    const deer = species === "deer", serow = species === "serow", boar = species === "boar";
    const tall = deer || serow;
    const hip = resting ? 0.29 : deer ? 0.78 : serow ? 0.67 : boar ? 0.43 : 0.37;
    const width = boar ? 0.32 : tall ? 0.25 : 0.20;
    const length = boar ? 0.61 : deer ? 0.57 : 0.51;
    const depth = tall ? 0.29 : boar ? 0.32 : 0.21;
    const trunk = pivot(group, 0, hip, 0);
    mesh(trunk, back, 0, depth * 0.16, 0, width, depth, length, softBody);
    mesh(trunk, belly, 0, -depth * 0.37, 0.07, width * 0.87, depth * 0.63, length * 0.72);
    if (deer) {
      for (const side of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          mesh(trunk, belly, side * (0.176 - i * 0.007), 0.17 + (i % 2) * 0.055, -0.32 + i * 0.15, 0.032, 0.040, 0.038);
        }
      }
    }
    const neck = pivot(trunk, 0, depth * 0.32, length * 0.61);
    const headY = tall ? (deer ? 0.54 : 0.37) : 0.22;
    bone(neck, back, [0, -0.1, -0.04], [0, headY, 0.23], width * 0.66);
    mesh(neck, back, 0, headY, 0.24, width * 0.73, 0.15, boar ? 0.31 : 0.24, softBody);
    mesh(neck, boar ? belly : dark, 0, headY - 0.05, boar ? 0.51 : 0.42, width * 0.5, 0.083, 0.10);
    const tail = pivot(trunk, 0, 0.09, -length * 0.84);
    mesh(tail, species === "fox" ? back : belly, 0, species === "fox" ? -0.03 : 0.07, species === "fox" ? -0.33 : -0.09, species === "fox" ? 0.135 : 0.085, species === "fox" ? 0.13 : 0.081, species === "fox" ? 0.45 : 0.12);
    if (species === "fox") mesh(tail, belly, 0, -0.04, -0.65, 0.102, 0.10, 0.15);
    for (const side of [-1, 1]) {
      const ear = mesh(neck, back, side * width * 0.53, headY + 0.16, 0.14, 0.077, tall ? 0.19 : 0.14, 0.065);
      ear.rotation.z = -side * (tall ? 0.61 : 0.35);
      mesh(neck, dark, side * width * 0.63, headY + 0.027, 0.35, 0.034, 0.038, 0.032);
      if (deer && antlers) {
        bone(neck, dark, [side * 0.11, headY + 0.11, 0.13], [side * 0.21, headY + 0.47, 0.04], 0.028);
        bone(neck, dark, [side * 0.21, headY + 0.47, 0.04], [side * 0.31, headY + 0.58, -0.07], 0.023);
        bone(neck, dark, [side * 0.17, headY + 0.33, 0.08], [side * 0.26, headY + 0.47, 0.22], 0.021);
      }
      if (serow) bone(neck, dark, [side * 0.095, headY + 0.13, 0.10], [side * 0.13, headY + 0.34, 0.02], 0.042);
      if (boar) bone(neck, 0xead4aa, [side * 0.12, headY - 0.09, 0.39], [side * 0.16, headY - 0.01, 0.50], 0.028);
    }
    const legs = [-1, 1].flatMap((side) => [-1, 1].map((front) => {
      const joint = pivot(group, side * width * 0.59, hip * 0.98, front * length * 0.60);
      if (resting) {
        const kneeZ = front > 0 ? 0.26 : -0.18;
        const hoofZ = front > 0 ? 0.08 : 0.15;
        bone(joint, back, [0, 0.015, 0], [side * 0.075, -0.194, kneeZ], 0.082);
        bone(joint, dark, [side * 0.075, -0.194, kneeZ], [side * 0.042, -0.234, hoofZ], 0.046);
        mesh(joint, dark, side * 0.042, -0.234, hoofZ, 0.057, 0.034, 0.074);
      } else {
        bone(joint, back, [0, 0.04, 0], [0, -hip * 0.55, -0.035 * front], tall ? 0.073 : 0.068);
        bone(joint, dark, [0, -hip * 0.51, -0.035 * front], [0, -hip * 0.96, 0.018], tall ? 0.045 : 0.049);
        mesh(joint, dark, 0, -hip * 0.96, 0.044, 0.056, 0.034, 0.066);
      }
      return { joint, side, front };
    }));
    return {
      group,
      pose(time, gait, phase) {
        if (resting) {
          trunk.scale.y = 1 + 0.028 * Math.sin(time * 1.9 + phase);
          neck.rotation.set(0.83 + 0.10 * Math.sin(time * 0.70 + phase), 0.11 * Math.sin(time * 0.49 + phase), 0);
          tail.rotation.y = Math.sin(time * 3.1) * Math.max(0, Math.sin(time * 0.78 + phase)) ** 8 * 0.29;
          return;
        }
        for (const { joint, side, front } of legs) {
          const shift = species === "fox" ? (front < 0 ? Math.PI : 0) + side * 0.28 : side * front < 0 ? Math.PI : 0;
          joint.rotation.x = Math.sin(phase + shift) * gait * (species === "fox" ? 0.91 : boar ? 0.62 : 0.51);
        }
        const bounce = species === "fox" ? 0.10 : serow ? 0.055 : 0.031;
        trunk.position.y = hip + Math.abs(Math.sin(phase)) * gait * bounce;
        trunk.rotation.x = species === "fox" ? Math.sin(phase) * gait * 0.17 : boar ? gait * 0.08 : 0;
        const graze = deer ? 1.06 * (0.5 + 0.5 * Math.sin(time * 0.63 + 0.8)) ** 1.2
          : boar ? 0.52 + 0.24 * Math.sin(time * 1.4)
          : serow ? 0.29 * Math.max(0, Math.sin(time * 0.78))
          : 0.22 * Math.max(0, Math.sin(time * 3.1));
        neck.rotation.x = graze * (1 - gait) + (boar ? gait * 0.29 : 0);
        neck.rotation.y = Math.sin(time * (boar ? 2.2 : 0.98)) * (1 - gait) * (serow ? 0.32 : boar ? 0.21 : 0.13);
        tail.rotation.y = Math.sin(time * (boar ? 6.1 : 2.4)) * (species === "fox" ? 0.46 : 0.23);
      },
    };
  }

  function crane(): AnimalModel {
    const group = new THREE.Group();
    const { back, dark } = COATS.crane;
    mesh(group, back, 0, 0.71, -0.07, 0.27, 0.20, 0.45, softBody);
    mesh(group, dark, 0, 0.71, -0.37, 0.22, 0.13, 0.27);
    const legs = [-1, 1].map(side => {
      const leg = pivot(group, side * 0.10, 0.66, 0);
      bone(leg, 0x967356, [0, 0, 0], [side * 0.04, -0.63, 0.075], 0.029);
      return leg;
    });
    const neck = pivot(group, 0, 0.77, 0.24);
    bone(neck, back, [0, 0, 0], [0, 0.44, -0.06], 0.069);
    bone(neck, dark, [0, 0.43, -0.06], [0, 0.68, 0.12], 0.063);
    mesh(neck, back, 0, 0.69, 0.145, 0.11, 0.097, 0.15);
    mesh(neck, 0x9e4437, 0, 0.77, 0.162, 0.085, 0.035, 0.091);
    mesh(neck, 0x9c8261, 0, 0.65, 0.33, 0.044, 0.041, 0.19);
    const wings = [-1, 1].map(side => {
      const wing = pivot(group, side * 0.15, 0.76, -0.06);
      mesh(wing, back, 0, 0, 0, side * 0.8, 1, 0.55, blade);
      mesh(wing, dark, side * 0.48, 0.005, -0.25, side * 0.63, 1, 0.48, blade);
      return { side, wing };
    });
    return {
      group,
      pose(time, gait, phase, lift = 0) {
        legs[0]!.rotation.x = Math.sin(phase) * gait * 0.42;
        legs[1]!.rotation.x = -legs[0]!.rotation.x;
        neck.rotation.x = 0.18 + Math.max(0, Math.sin(time * 1.19)) ** 5 * (1 - gait) * 1.36;
        const flap = Math.max(0, Math.sin(time * 0.45 + 1)) ** 9 * (1 - gait);
        for (const { side, wing } of wings) wing.rotation.z = side * (0.11 + flap * Math.sin(time * 5.2) * 0.55 + lift * 1.15);
      },
    };
  }

  function swimmer(species: "dolphin" | "whale" | "otter"): AnimalModel {
    const group = new THREE.Group();
    const { back, belly, dark } = COATS[species];
    const whale = species === "whale", otter = species === "otter";
    const width = whale ? 0.86 : otter ? 0.23 : 0.34;
    const length = whale ? 1.88 : otter ? 0.64 : 0.88;
    const height = whale ? 0.63 : otter ? 0.27 : 0.35;
    mesh(group, back, 0, 0, 0.17 * length, width, height, length, softBody);
    mesh(group, belly, 0, -height * 0.38, 0.30 * length, width * 0.87, height * 0.65, length * 0.80, softBody);
    mesh(group, back, 0, otter ? 0.14 : -0.02, length * 0.93, width * 0.67, height * 0.70, length * (whale ? .41 : .43), softBody);
    if (otter) {
      mesh(group, belly, 0, 0.085, length * 1.25, width * 0.62, .10, .14);
      for (const side of [-1, 1]) {
        mesh(group, dark, side * .12, .29, length * .91, .062, .074, .055);
        mesh(group, dark, side * .106, .20, length * 1.17, .032, .033, .036);
      }
    } else {
      const dorsal = mesh(group, dark, 0, height * .62, -.11 * length, whale ? .49 : .44, 1, length * .83, blade);
      dorsal.rotation.z = Math.PI / 2;
      for (const side of [-1, 1]) {
        const fin = mesh(group, back, side * width * .57, -height * .25, .39 * length, side * width * 1.83, 1, length * .58, blade);
        fin.rotation.z = side * -0.31;
      }
    }
    const tail = pivot(group, 0, 0, -length * .70);
    mesh(tail, back, 0, -height * .02, -length * .32, width * .48, height * .50, length * .65);
    if (!otter) {
      for (const side of [-1, 1]) {
        mesh(tail, dark, 0, 0, -length * .76, side * width * (whale ? 1.65 : 1.40), 1, length * .68, blade);
      }
    }
    return {
      group,
      pose(time, gait, phase) {
        const beat = Math.sin(phase * (whale ? 0.82 : 1.1));
        tail.rotation.x = otter ? 0 : beat * (whale ? 0.20 + gait * 0.19 : 0.38);
        tail.rotation.y = otter ? Math.sin(time * 3.0 + phase) * (0.09 + gait * 0.55) : 0;
      },
    };
  }


  function beast(kind: "horse" | "camel" | "buffalo" | "bear", resting: boolean, saddle = false): AnimalModel {
    const group = new THREE.Group();
    const shape = BEASTS[kind];
    const { back, belly, dark, lower, width, length, depth } = shape;
    const kneeling = resting && kind === "camel";
    const hip = kneeling ? 0.38 : shape.hip;
    const trunk = pivot(group, 0, hip, 0);
    mesh(trunk, back, 0, depth * 0.16, 0, width, depth, length, softBody);
    mesh(trunk, belly, 0, -depth * 0.37, 0.07, width * 0.87, depth * 0.63, length * 0.72);
    const neck = pivot(trunk, 0, depth * 0.32, length * 0.60);
    const head = pivot(neck, 0, 0, 0);
    const tail = pivot(trunk, 0, depth * 0.12, -length * 0.88);
    const ears: THREE.Mesh[] = [];
    if (kind === "horse") {
      bone(neck, back, [0, -0.12, -0.10], [0, 0.46, 0.24], 0.14);
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        mesh(neck, dark, 0, -0.08 + t * 0.62, -0.17 + t * 0.34, 0.03, 0.075, 0.06);
      }
      head.position.set(0, 0.50, 0.27);
      head.rotation.x = 0.78;
      mesh(head, back, 0, 0, 0.12, 0.11, 0.13, 0.26, softBody);
      mesh(head, dark, 0, -0.02, 0.36, 0.075, 0.085, 0.13);
      for (const side of [-1, 1]) ears.push(mesh(head, back, side * 0.065, 0.14, -0.03, 0.034, 0.085, 0.03));
      mesh(tail, dark, 0, -0.22, -0.05, 0.055, 0.30, 0.07, softBody);
    } else if (kind === "camel") {
      mesh(trunk, belly, 0, depth * 0.16 + 0.34, -0.06, 0.2, 0.24, 0.22, softBody);
      if (saddle) mesh(trunk, 0xc8473a, 0, depth * 0.16 + 0.46, -0.06, 0.215, 0.13, 0.235, softBody);
      bone(neck, back, [0, -0.1, -0.05], [0, 0.32, 0.17], 0.12);
      bone(neck, back, [0, 0.30, 0.17], [0, 0.70, 0.29], 0.09);
      head.position.set(0, 0.72, 0.30);
      head.rotation.x = 0.55;
      mesh(head, back, 0, 0, 0.09, 0.09, 0.10, 0.20, softBody);
      mesh(head, belly, 0, -0.035, 0.26, 0.075, 0.07, 0.12);
      for (const side of [-1, 1]) ears.push(mesh(head, dark, side * 0.07, 0.08, -0.03, 0.025, 0.04, 0.025));
      mesh(tail, dark, 0, -0.12, -0.04, 0.035, 0.17, 0.04);
    } else if (kind === "buffalo") {
      bone(neck, back, [0, 0.0, -0.06], [0, -0.04, 0.27], 0.2);
      head.position.set(0, -0.04, 0.30);
      head.rotation.x = 0.22;
      mesh(head, back, 0, 0, 0.10, 0.17, 0.16, 0.24, softBody);
      mesh(head, dark, 0, -0.045, 0.30, 0.13, 0.10, 0.12);
      for (const side of [-1, 1]) {
        ears.push(mesh(head, back, side * 0.2, 0.07, 0.0, 0.12, 0.03, 0.07));
        bone(head, 0xd5cab2, [side * 0.14, 0.12, 0.02], [side * 0.33, 0.13, -0.08], 0.034);
        bone(head, 0xd5cab2, [side * 0.33, 0.13, -0.08], [side * 0.41, 0.27, -0.2], 0.026);
      }
      mesh(tail, dark, 0, -0.18, -0.04, 0.03, 0.22, 0.035);
      mesh(tail, dark, 0, -0.40, -0.04, 0.05, 0.07, 0.05);
    } else {
      mesh(trunk, back, 0, depth * 0.55, length * 0.30, 0.30, 0.20, 0.24, softBody);
      bone(neck, back, [0, -0.06, -0.12], [0, 0.0, 0.2], 0.21);
      head.position.set(0, 0.0, 0.24);
      mesh(head, back, 0, 0, 0.09, 0.19, 0.18, 0.22, softBody);
      mesh(head, 0x8d6c4f, 0, -0.05, 0.29, 0.09, 0.08, 0.14, softBody);
      mesh(head, dark, 0, -0.035, 0.42, 0.036, 0.03, 0.03);
      for (const side of [-1, 1]) ears.push(mesh(head, dark, side * 0.13, 0.15, 0.0, 0.06, 0.06, 0.04));
      mesh(tail, back, 0, 0, -0.05, 0.05, 0.05, 0.06);
    }
    const legs = [-1, 1].flatMap((side) => [-1, 1].map((front) => {
      const joint = pivot(group, side * width * 0.59, hip * 0.98, front * length * 0.60);
      if (kneeling) {
        const kneeZ = front > 0 ? 0.32 : -0.22;
        const hoofZ = front > 0 ? 0.10 : 0.19;
        bone(joint, back, [0, 0.015, 0], [side * 0.09, -0.24, kneeZ], shape.leg * 1.25);
        bone(joint, dark, [side * 0.09, -0.24, kneeZ], [side * 0.05, -0.30, hoofZ], shape.shin * 1.1);
        mesh(joint, dark, side * 0.05, -0.30, hoofZ, 0.065, 0.04, 0.085);
      } else {
        bone(joint, back, [0, 0.04, 0], [0, -hip * 0.55, -0.035 * front], shape.leg);
        bone(joint, lower, [0, -hip * 0.51, -0.035 * front], [0, -hip * 0.96, 0.018], shape.shin);
        mesh(joint, dark, 0, -hip * 0.96, 0.044, shape.shin * 1.25, 0.034, shape.shin * 1.5);
      }
      return { joint, side, front };
    }));
    const base = head.rotation.x;
    return {
      group,
      pose(time, gait, phase) {
        const move = kneeling ? 0 : gait;
        if (!kneeling) {
          for (const { joint, side, front } of legs) {
            joint.rotation.x = Math.sin(phase + (side * front < 0 ? Math.PI : 0)) * move * shape.swing;
          }
          trunk.position.y = hip + Math.abs(Math.sin(phase)) * move * shape.bounce;
        } else {
          trunk.scale.y = 1 + 0.025 * Math.sin(time * 1.7 + phase);
        }
        const idle = 1 - move;
        if (kind === "horse") {
          const graze = 0.95 * (0.5 + 0.5 * Math.sin(time * 0.52 + 1.3)) ** 1.6;
          neck.rotation.x = graze * idle + move * 0.12;
          neck.rotation.y = Math.sin(time * 0.43) * 0.12 * idle;
          tail.rotation.set(0.2 * Math.sin(time * 1.7), 0, 0.28 * Math.sin(time * 2.4));
        } else if (kind === "camel") {
          neck.rotation.x = 0.06 * Math.sin(time * 0.6) + move * 0.08;
          neck.rotation.y = Math.sin(time * 0.37) * 0.22 * idle;
          head.rotation.x = base + (kneeling ? 0.07 * Math.sin(time * 4.1) : 0.1 * Math.sin(time * 0.6 + 1));
          tail.rotation.z = Math.sin(time * 2.1) * 0.25;
        } else if (kind === "buffalo") {
          neck.rotation.x = 0.1 * Math.sin(time * 0.7) + move * 0.05;
          neck.rotation.y = Math.sin(time * 0.5 + phase) * 0.2 * idle;
          head.rotation.x = base + 0.12 * Math.max(0, Math.sin(time * 3.6)) * Math.max(0, Math.sin(time * 0.31));
          tail.rotation.z = Math.sin(time * 4.4) * 0.5 * Math.max(0, Math.sin(time * 0.8 + 0.5));
        } else {
          const sniff = 0.42 * (0.5 + 0.5 * Math.sin(time * 0.9 + 0.4));
          neck.rotation.x = sniff * idle + move * 0.18;
          neck.rotation.y = Math.sin(time * 0.66) * 0.34 * idle;
          tail.rotation.y = Math.sin(time * 1.8) * 0.15;
        }
        const flick = Math.max(0, Math.sin(time * 0.9 + 2)) ** 14;
        ears.forEach((ear, i) => { ear.rotation.z = (i === 0 ? -1 : 1) * (kind === "buffalo" ? 0 : 0.35 * flick); });
      },
    };
  }

  function macaque(snowcap: boolean): AnimalModel {
    const group = new THREE.Group();
    const { fur, belly, face, dark, snow } = MACAQUE;
    // Seated, leaning slightly forward, hands on the knees.
    const torso = pivot(group, 0, 0.17, -0.02);
    torso.rotation.x = 0.16;
    mesh(torso, fur, 0, 0.07, 0, 0.19, 0.21, 0.17, softBody);
    mesh(torso, belly, 0, 0.03, 0.09, 0.14, 0.15, 0.09, softBody);
    mesh(torso, fur, 0, 0.2, -0.03, 0.2, 0.09, 0.15, softBody);
    for (const side of [-1, 1]) {
      mesh(group, fur, side * 0.15, 0.09, 0.08, 0.075, 0.085, 0.15, softBody);
      mesh(group, dark, side * 0.15, 0.025, 0.2, 0.052, 0.03, 0.075);
    }
    mesh(group, face, 0, 0.04, -0.15, 0.06, 0.05, 0.05, softBody);
    mesh(group, fur, 0, 0.04, -0.21, 0.035, 0.035, 0.09);
    const arms = [-1, 1].map((side) => {
      const shoulder = pivot(torso, side * 0.18, 0.2, 0.02);
      bone(shoulder, fur, [0, 0, 0], [side * 0.04, -0.14, 0.12], 0.055);
      bone(shoulder, fur, [side * 0.04, -0.14, 0.12], [side * 0.01, -0.2, 0.2], 0.045);
      mesh(shoulder, dark, side * 0.01, -0.21, 0.215, 0.05, 0.03, 0.06);
      return { shoulder, side };
    });
    const neck = pivot(torso, 0, 0.27, 0.06);
    mesh(neck, fur, 0, 0.1, 0.0, 0.135, 0.125, 0.125, softBody);
    mesh(neck, face, 0, 0.085, 0.1, 0.1, 0.09, 0.05, softBody);
    mesh(neck, 0xbfae98, 0, 0.17, 0.07, 0.1, 0.028, 0.05);
    for (const side of [-1, 1]) {
      mesh(neck, dark, side * 0.04, 0.125, 0.145, 0.016, 0.016, 0.014);
      mesh(neck, face, side * 0.135, 0.1, -0.01, 0.03, 0.045, 0.02);
    }
    if (snowcap) mesh(neck, snow, 0, 0.215, -0.01, 0.085, 0.045, 0.085, softBody);
    return {
      group,
      pose(time, _gait, phase) {
        torso.scale.y = 1 + 0.03 * Math.sin(time * 1.6 + phase);
        neck.rotation.y = 0.55 * Math.sin(time * 0.37 + phase * 3) * Math.sin(time * 0.21 + phase) ;
        neck.rotation.x = 0.08 * Math.sin(time * 0.53 + phase) + 0.2 * Math.max(0, Math.sin(time * 0.19 + phase * 2)) ** 3;
        const scratch = Math.max(0, Math.sin(time * 0.41 + phase * 5)) ** 10;
        for (const { shoulder, side } of arms) {
          shoulder.rotation.x = side > 0 ? -2.3 * scratch + 0.1 * Math.sin(time * 9) * scratch : 0.03 * Math.sin(time + phase);
        }
      },
    };
  }

  return {
    buildRestingDeer(): AnimalModel {
      return quadruped("deer", false, true);
    },
    build(species: AnimalKind, lead: boolean, options: AnimalOptions = {}): AnimalModel {
      const model = species === "crane" ? crane()
        : species === "macaque" ? macaque(options.snowcap === true)
        : species === "horse" || species === "camel" || species === "buffalo" || species === "bear" ? beast(species, options.resting === true, options.saddle === true)
        : species === "deer" && options.resting ? quadruped("deer", false, true)
        : species === "dolphin" || species === "whale" || species === "otter" ? swimmer(species)
          : quadruped(species, lead);
      model.group.name = species;
      return model;
    },
    dispose() {
      for (const geometry of [body, softBody, limb, blade]) geometry.dispose();
      materials.forEach(material => material.dispose());
    },
  };
}
