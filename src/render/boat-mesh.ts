import * as THREE from "three";

// Each point gives x, z and the height of the plank edge.
const SHEER = [
  [0, 1.48, 0.54], [-0.24, 0.98, 0.38], [-0.43, 0.34, 0.29], [-0.43, -0.55, 0.28],
  [-0.29, -1.03, 0.36], [0.29, -1.03, 0.36], [0.43, -0.55, 0.28], [0.43, 0.34, 0.29], [0.24, 0.98, 0.38],
] as const;
const UP = new THREE.Vector3(0, 1, 0);

// The highest ripple is 0.082 units. Leave clearance for the skiff's roll and bob.
const FLOOR_Y = 0.15;

export function wood(color: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide });
}

export function surface(points: number[], material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function band(lower: THREE.Vector3[], upper: THREE.Vector3[], material: THREE.Material): THREE.Mesh {
  const points: number[] = [];
  for (let i = 0; i < upper.length; i++) {
    const j = (i + 1) % upper.length;
    const a = lower[i]!, b = upper[i]!, c = upper[j]!, d = lower[j]!;
    points.push(...a.toArray(), ...b.toArray(), ...c.toArray(), ...a.toArray(), ...c.toArray(), ...d.toArray());
  }
  return surface(points, material);
}

/** A slender wasen-inspired skiff with a raked stem, plank sides and a flat floor. */
export function buildBoat(): THREE.Group {
  const boat = new THREE.Group();
  const sheer = SHEER.map(([x, z, y]) => new THREE.Vector3(x, y, z));
  const bottom = sheer.map((v) => new THREE.Vector3(v.x * 0.72, -0.075, v.z * 0.68));
  // Both strakes meet the floor at the same ring, with no gap at the edges.
  const deck = bottom.map((v, i) => v.clone().lerp(sheer[i]!, (FLOOR_Y - v.y) / (sheer[i]!.y - v.y)));

  const lower = band(bottom, deck, wood(0x956747));
  const upper = band(deck, sheer, wood(0xbb8e62));
  lower.castShadow = true;
  upper.castShadow = true;
  boat.add(lower, upper);

  const seamWood = wood(0x775039);
  for (let i = 0; i < sheer.length; i++) {
    const j = (i + 1) % sheer.length;
    for (const [ring, thickness] of [[sheer, 0.028], [deck, 0.011]] as const) {
      const a = ring[i]!, b = ring[j]!;
      const edge = new THREE.Vector3().subVectors(b, a);
      const batten = new THREE.Mesh(
        new THREE.CylinderGeometry(thickness, thickness, edge.length() + thickness, 4),
        seamWood,
      );
      batten.position.copy(a).lerp(b, 0.5);
      batten.quaternion.setFromUnitVectors(UP, edge.normalize());
      boat.add(batten);
    }
  }

  const floor: number[] = [];
  for (let i = 0; i < deck.length; i++) {
    floor.push(0, FLOOR_Y, 0, ...deck[(i + 1) % deck.length]!.toArray(), ...deck[i]!.toArray());
  }
  const dryDeck = surface(floor, wood(0xd0a171));
  dryDeck.name = "boat-floor";
  boat.add(dryDeck);

  const seamInk = wood(0xa87c56);
  for (const x of [-0.14, 0.13]) {
    const join = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.002, 1.48), seamInk);
    join.position.set(x, FLOOR_Y + 0.003, 0.02);
    boat.add(join);
  }

  const planks = wood(0xdab289);
  for (const [z, width] of [[-0.59, 0.65], [0.59, 0.60]] as const) {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(width, 0.055, 0.17), planks);
    beam.position.set(0, 0.22, z);
    beam.castShadow = true;
    boat.add(beam);
  }

  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.19, 5), seamWood);
  peg.position.set(0.23, 0.36, -0.82);
  boat.add(peg);
  return boat;
}

/** Stern-mounted sculling oar, with its fulcrum at the group's origin. */
export function buildScullingOar(): THREE.Group {
  const oar = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.023, 1.44, 5), wood(0xbd925f));
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.33;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.42), wood(0xa87549));
  blade.position.z = -1.16;
  oar.add(shaft, blade);
  return oar;
}

/** Small chevrons trail the skiff while it has momentum. */
export function buildWake(): { group: THREE.Group; update(strength: number, seconds: number): void } {
  const group = new THREE.Group();
  const lines = Array.from({ length: 3 }, () => {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0xe1f2e8, transparent: true, depthWrite: false });
    for (const side of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.008, 0.046), material);
      stripe.position.x = side * 0.31;
      stripe.rotation.y = side * -0.32;
      group.add(stripe);
    }
    return { group, material };
  });
  group.position.y = 0.08;
  group.add(...lines.map((entry) => entry.group));
  return {
    group,
    update(strength, seconds) {
      group.visible = strength > 0.015;
      for (const [i, line] of lines.entries()) {
        const phase = (seconds * 1.25 + i / lines.length) % 1;
        line.group.position.z = -1.04 - phase * 1.12;
        line.group.scale.x = 0.75 + phase * 1.1;
        line.material.opacity = strength * Math.sin(phase * Math.PI) * 0.56;
      }
    },
  };
}
