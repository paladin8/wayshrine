import * as THREE from "three";
import { band, surface, wood } from "./boat-mesh";

/** How high the deck lies above the hull's origin (the waterline). */
export const SHIP_DECK_HEIGHT = 0.46;
const DECK = SHIP_DECK_HEIGHT;
const UP = new THREE.Vector3(0, 1, 0);
/** Where the mast stands, ahead of the helm at the origin. */
const MAST_Z = 0.95;
const SAIL_BOTTOM = DECK + 2.3;
const SAIL_TOP = DECK + 4.1;
const SAIL_WIDTH = 2.1;
const PANELS = 7;

// Each point gives x, z and the height of the plank edge: a high bow, a low waist and a raised stern.
const SHEER = [
  [0, 2.6, 1.0], [0.2, 2.15, 0.82], [0.45, 1.45, 0.62], [0.68, 0.55, 0.52], [0.76, -0.5, 0.5], [0.72, -1.5, 0.58],
  [0.6, -2.2, 0.82], [0.38, -2.48, 0.92], [-0.38, -2.48, 0.92], [-0.6, -2.2, 0.82], [-0.72, -1.5, 0.58],
  [-0.76, -0.5, 0.5], [-0.68, 0.55, 0.52], [-0.45, 1.45, 0.62], [-0.2, 2.15, 0.82],
] as const;

function rod(from: THREE.Vector3, to: THREE.Vector3, radius: number, material: THREE.Material, sides = 4): THREE.Mesh {
  const edge = new THREE.Vector3().subVectors(to, from);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, edge.length(), sides), material);
  mesh.position.copy(from).lerp(to, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, edge.normalize());
  mesh.castShadow = true;
  return mesh;
}

function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  return mesh;
}

/** A shoji screen: pale paper in a dark lattice, lit softly from inside. */
function screen(width: number, height: number, frame: THREE.Material, paper: THREE.Material, columns: number, rows: number): THREE.Group {
  const group = new THREE.Group();
  group.add(box(width, height, 0.012, paper, 0, height / 2, 0));
  for (let i = 0; i <= columns; i++) group.add(box(0.03, height, 0.03, frame, -width / 2 + (width * i) / columns, height / 2, 0));
  for (let j = 0; j <= rows; j++) group.add(box(width, 0.03, 0.03, frame, 0, (height * j) / rows, 0));
  return group;
}

export interface ShipMesh {
  readonly group: THREE.Group;
  /** Sails and flies the ship's cloth. `gangway` is how much of the boarding plank is out, 0 to 1. */
  update(seconds: number, gangway: number): void;
}

/** A small bezaisen-style coaster: planked hull with beam ends through the sides, one tall square sail of cloth strips, and a roofed stern house. */
export function buildShip(): ShipMesh {
  const ship = new THREE.Group();
  const sheer = SHEER.map(([x, z, y]) => new THREE.Vector3(x, y, z));
  const bottom = sheer.map((v) => new THREE.Vector3(v.x * 0.55, -0.28, v.z * 0.82));
  const ringAt = (height: number): THREE.Vector3[] => bottom.map((v, i) => v.clone().lerp(sheer[i]!, (height - v.y) / (sheer[i]!.y - v.y)));
  const waterline = ringAt(0.04);
  const deck = ringAt(DECK);

  // Tarred below the waterline, cedar above, with pale new planking at the rail.
  const tar = band(bottom, waterline, wood(0x4f3b2e));
  const planks = band(waterline, deck, wood(0xa8784f));
  const rail = band(deck, sheer, wood(0xcf9e68));
  for (const hull of [tar, planks, rail]) hull.castShadow = true;
  ship.add(tar, planks, rail);

  const seam = wood(0x6f4a33);
  for (const [ring, thickness] of [[sheer, 0.036], [deck, 0.022], [waterline, 0.018]] as const) {
    for (let i = 0; i < ring.length; i++) ship.add(rod(ring[i]!, ring[(i + 1) % ring.length]!, thickness, seam));
  }

  const floor: number[] = [];
  for (let i = 0; i < deck.length; i++) floor.push(0, DECK, 0, ...deck[(i + 1) % deck.length]!.toArray(), ...deck[i]!.toArray());
  const planking = surface(floor, wood(0xdcb584));
  planking.name = "ship-deck";
  ship.add(planking);
  const deckSeam = wood(0xb58b5d);
  for (const x of [-0.4, -0.13, 0.13, 0.4]) ship.add(box(0.014, 0.003, 3.2, deckSeam, x, DECK + 0.004, 0.05));

  // How far the hull's side stands out from the centre line at a given point along it.
  const sideAt = (z: number): number => {
    const side = deck.filter((v) => v.x > 0.001).sort((a, b) => a.z - b.z);
    for (let i = 0; i + 1 < side.length; i++) {
      const a = side[i]!, b = side[i + 1]!;
      if (z >= a.z && z <= b.z) return a.x + (b.x - a.x) * (z - a.z) / (b.z - a.z);
    }
    return side[0]!.x;
  };

  // The deck beams run right through the hull and show their cut ends, the mark of the wasen.
  const endGrain = wood(0xe8c896);
  for (const z of [-1.0, -0.45, 0.15, 1.45, 1.95]) {
    for (const side of [-1, 1]) ship.add(box(0.2, 0.075, 0.1, endGrain, side * (sideAt(z) + 0.02), DECK + 0.02, z));
  }

  // A low bamboo fence along each side of the waist.
  const bamboo = wood(0xc9a96b);
  for (const side of [-1, 1]) {
    const posts: THREE.Vector3[] = [];
    for (let z = -0.8; z <= 2.01; z += 0.45) {
      const top = new THREE.Vector3(side * (sideAt(z) - 0.035), DECK + 0.34, z);
      posts.push(top);
      ship.add(rod(new THREE.Vector3(top.x, DECK, z), top, 0.022, bamboo, 5));
    }
    for (let i = 0; i + 1 < posts.length; i++) ship.add(rod(posts[i]!, posts[i + 1]!, 0.017, bamboo, 5));
  }

  // The stern house: a paper-screened room under a grey tiled roof, nested in the raised stern.
  const frame = wood(0x5b3d2a);
  const paper = new THREE.MeshStandardMaterial({ color: 0xf5ead0, emissive: 0x4a3d24, flatShading: true, side: THREE.DoubleSide });
  const house = new THREE.Group();
  const HOUSE_Z = -1.68;
  const HOUSE_HALF_WIDTH = 0.5;
  const HOUSE_HALF_LENGTH = 0.58;
  const WALL = 0.64;
  for (const side of [-1, 1]) {
    const wall = screen(HOUSE_HALF_LENGTH * 2, WALL, frame, paper, 3, 2);
    wall.rotation.y = Math.PI / 2;
    wall.position.set(side * HOUSE_HALF_WIDTH, DECK, HOUSE_Z);
    house.add(wall);
  }
  const front = screen(HOUSE_HALF_WIDTH * 2, WALL, frame, paper, 3, 2);
  front.position.set(0, DECK, HOUSE_Z + HOUSE_HALF_LENGTH);
  house.add(front);
  house.add(box(HOUSE_HALF_WIDTH * 2, WALL, 0.05, wood(0x7b5638), 0, DECK + WALL / 2, HOUSE_Z - HOUSE_HALF_LENGTH));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    house.add(box(0.06, WALL + 0.04, 0.06, frame, sx * HOUSE_HALF_WIDTH, DECK + WALL / 2, HOUSE_Z + sz * HOUSE_HALF_LENGTH));
  }
  const eave = DECK + WALL + 0.03;
  const ridge = eave + 0.36;
  const roofHalfWidth = HOUSE_HALF_WIDTH + 0.2;
  const roofFront = HOUSE_Z + HOUSE_HALF_LENGTH + 0.2;
  const roofBack = HOUSE_Z - HOUSE_HALF_LENGTH - 0.2;
  const roof = surface([
    -roofHalfWidth, eave, roofFront, roofHalfWidth, eave, roofFront, 0, ridge, roofFront,
    -roofHalfWidth, eave, roofBack, 0, ridge, roofBack, roofHalfWidth, eave, roofBack,
    -roofHalfWidth, eave, roofFront, 0, ridge, roofFront, 0, ridge, roofBack,
    -roofHalfWidth, eave, roofFront, 0, ridge, roofBack, -roofHalfWidth, eave, roofBack,
    roofHalfWidth, eave, roofFront, roofHalfWidth, eave, roofBack, 0, ridge, roofBack,
    roofHalfWidth, eave, roofFront, 0, ridge, roofBack, 0, ridge, roofFront,
  ], wood(0x50575f));
  roof.castShadow = true;
  house.add(roof);
  house.add(box(0.09, 0.07, roofFront - roofBack + 0.04, wood(0x353a40), 0, ridge + 0.02, HOUSE_Z));
  ship.add(house);

  // A paper lantern hangs from the front eave.
  const lantern = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.075, 0.17, 8),
    new THREE.MeshStandardMaterial({ color: 0xf2c079, emissive: 0xd9822b, emissiveIntensity: 0.8, flatShading: true }),
  );
  lantern.position.set(0.4, eave - 0.16, roofFront - 0.04);
  ship.add(lantern, rod(new THREE.Vector3(0.4, eave, roofFront - 0.04), new THREE.Vector3(0.4, eave - 0.07, roofFront - 0.04), 0.008, frame));

  // The rudder, a big blade hung off the transom, and a bow post.
  const rudderWood = wood(0x7a5538);
  const rudder = box(0.07, 1.0, 0.5, rudderWood, 0, -0.18, -2.85);
  rudder.rotation.x = -0.08;
  ship.add(rudder, rod(new THREE.Vector3(0, 0.4, -2.55), new THREE.Vector3(0, 0.95, -3.0), 0.035, rudderWood, 5));
  ship.add(box(0.1, 0.34, 0.12, endGrain, 0, 1.12, 2.56));

  // The mast, its yard, and the lines that steady it.
  const spar = wood(0x9b7648);
  const mastBase = new THREE.Vector3(0, DECK, MAST_Z);
  const mastTop = new THREE.Vector3(0, SAIL_TOP + 0.28, MAST_Z);
  ship.add(rod(mastBase, mastTop, 0.07, spar, 6));
  ship.add(box(0.28, 0.1, 0.28, rudderWood, 0, DECK + 0.05, MAST_Z));
  const yard = rod(new THREE.Vector3(-SAIL_WIDTH / 2 - 0.12, SAIL_TOP, MAST_Z + 0.06), new THREE.Vector3(SAIL_WIDTH / 2 + 0.12, SAIL_TOP, MAST_Z + 0.06), 0.04, spar, 5);
  const batten = rod(new THREE.Vector3(-SAIL_WIDTH / 2, SAIL_BOTTOM, MAST_Z + 0.06), new THREE.Vector3(SAIL_WIDTH / 2, SAIL_BOTTOM, MAST_Z + 0.06), 0.03, spar, 5);
  ship.add(yard, batten);
  const rope = wood(0x3d3026);
  const line = (ax: number, ay: number, az: number, bx: number, by: number, bz: number): void => {
    ship.add(rod(new THREE.Vector3(ax, ay, az), new THREE.Vector3(bx, by, bz), 0.011, rope, 3));
  };
  line(0, SAIL_TOP + 0.25, MAST_Z, 0, 1.12, 2.56);
  line(0, SAIL_TOP + 0.25, MAST_Z, 0, 1.0, -2.45);
  for (const side of [-1, 1]) for (const z of [0.5, 1.4]) line(0, DECK + 1.7, MAST_Z, side * (sideAt(z) + 0.02), DECK + 0.05, z);

  // A pennant at the masthead.
  const pennantMaterial = new THREE.MeshStandardMaterial({ color: 0x284a74, flatShading: true, side: THREE.DoubleSide });
  const pennant = new THREE.Group();
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.15), pennantMaterial);
  flag.rotation.y = Math.PI / 2;
  flag.position.z = 0.31;
  pennant.add(flag);
  pennant.position.set(0, SAIL_TOP + 0.2, MAST_Z);
  ship.add(pennant);

  // The sail is cloth strips hung from the yard; each is a small grid so the whole bellies in the wind.
  const sail = new THREE.Group();
  sail.position.set(0, 0, MAST_Z + 0.09);
  const panelWidth = SAIL_WIDTH / PANELS;
  const panels = Array.from({ length: PANELS }, (_, i) => {
    const material = new THREE.MeshStandardMaterial({ color: i % 2 ? 0xe9dec0 : 0xf3ead2, flatShading: true, side: THREE.DoubleSide });
    const geometry = new THREE.PlaneGeometry(panelWidth - 0.012, SAIL_TOP - SAIL_BOTTOM, 1, 6);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    sail.add(mesh);
    return { geometry, mesh, centre: -SAIL_WIDTH / 2 + panelWidth * (i + 0.5), base: Float32Array.from(geometry.attributes.position!.array as ArrayLike<number>) };
  });
  const crest = new THREE.Group();
  const outer = new THREE.Mesh(new THREE.CircleGeometry(0.34, 20), new THREE.MeshBasicMaterial({ color: 0x24406a, side: THREE.DoubleSide }));
  const inner = new THREE.Mesh(new THREE.CircleGeometry(0.2, 20), new THREE.MeshBasicMaterial({ color: 0xf3ead2, side: THREE.DoubleSide }));
  inner.position.z = 0.004;
  crest.add(outer, inner);
  const back = crest.clone();
  back.position.z = -0.02;
  sail.add(crest, back);
  ship.add(sail);

  // A gangway plank lies from the rail to the bank while the traveller boards, on the side facing the shore (+x).
  const gangway = new THREE.Group();
  const plank = box(0.95, 0.04, 0.4, wood(0xc9a06b), 0, 0, 0);
  gangway.add(plank);
  for (const x of [-0.3, 0, 0.3]) gangway.add(box(0.03, 0.03, 0.42, rudderWood, x, 0.03, 0));
  gangway.position.set(0.93, DECK / 2 - 0.02, 0);
  gangway.rotation.z = -Math.atan2(DECK, 0.9);
  ship.add(gangway);

  const centreOfSail = (): number => SAIL_BOTTOM + (SAIL_TOP - SAIL_BOTTOM) / 2;
  return {
    group: ship,
    update(seconds, out) {
      ship.rotation.z = Math.sin(seconds * 1.3) * 0.022;
      ship.rotation.x = Math.sin(seconds * 1.05 + 1.2) * 0.014;
      gangway.visible = out > 0.01;
      gangway.scale.x = Math.max(0.01, out);
      const billow = 0.15 + Math.sin(seconds * 1.4) * 0.03;
      for (const panel of panels) {
        const position = panel.geometry.attributes.position!;
        for (let i = 0; i < position.count; i++) {
          const x = panel.base[i * 3]!;
          const y = panel.base[i * 3 + 1]!;
          const across = (panel.centre + x + SAIL_WIDTH / 2) / SAIL_WIDTH;
          const height = (y + (SAIL_TOP - SAIL_BOTTOM) / 2) / (SAIL_TOP - SAIL_BOTTOM);
          const bulge = billow * Math.sin(Math.PI * across) * (0.35 + 0.65 * Math.sin(Math.PI * Math.min(1, height * 0.92 + 0.04)));
          const ripple = Math.sin(seconds * 3.1 + height * 5 + across * 3.5) * 0.012 * height;
          position.setXYZ(i, x + panel.centre, y + centreOfSail(), bulge + ripple);
        }
        position.needsUpdate = true;
        panel.geometry.computeVertexNormals();
      }
      const middle = billow * (0.35 + 0.65);
      crest.position.set(0, centreOfSail() - 0.1, middle * 0.97 + 0.02);
      back.position.set(0, centreOfSail() - 0.1, middle * 0.97 - 0.02);
      pennant.rotation.y = Math.sin(seconds * 3.7) * 0.28;
      flag.scale.x = 1 + Math.sin(seconds * 6.1) * 0.06;
    },
  };
}
