import * as THREE from "three";

export type Species = "deer" | "serow" | "boar" | "crane" | "fox" | "otter" | "dolphin" | "whale";

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
  pose(time: number, gait: number, phase: number): void;
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
      pose(time, gait, phase) {
        legs[0]!.rotation.x = Math.sin(phase) * gait * 0.42;
        legs[1]!.rotation.x = -legs[0]!.rotation.x;
        neck.rotation.x = 0.18 + Math.max(0, Math.sin(time * 1.19)) ** 5 * (1 - gait) * 1.36;
        const flap = Math.max(0, Math.sin(time * 0.45 + 1)) ** 9 * (1 - gait);
        for (const { side, wing } of wings) wing.rotation.z = side * (0.11 + flap * Math.sin(time * 5.2) * 0.55);
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

  return {
    buildRestingDeer(): AnimalModel {
      return quadruped("deer", false, true);
    },
    build(species: Species, lead: boolean): AnimalModel {
      const model = species === "crane" ? crane()
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
