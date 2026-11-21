import * as THREE from "three";
import type { Rng } from "../core";
import { defaultIsland, islandOutline, type IslandParams } from "../world";
import { palette } from "./palette";

const WATER_TOP = 1.2;
const GRASS_BASE = 1.0;
const GRASS_DEPTH = 0.3;

/** A flat-shaded island diorama: water block, grass slab, edge stones. */
export function buildIsland(rng: Rng, p: IslandParams = defaultIsland): THREE.Group {
  const group = new THREE.Group();
  const outline = islandOutline(rng.fork("outline"), p);

  // Water block, with a margin of open water around the island.
  const water = new THREE.Mesh(
    new THREE.BoxGeometry(2 * (p.halfX + 1.9), WATER_TOP, 2 * (p.halfZ + 1.75)),
    new THREE.MeshStandardMaterial({
      color: palette.water,
      transparent: true,
      opacity: 0.6,
      flatShading: true,
    }),
  );
  water.position.y = WATER_TOP / 2;
  water.receiveShadow = true;
  group.add(water);

  // Grass slab: the outline extruded upward.
  // Shape is built in XY and extruded along +Z; rotating -90 degrees about X
  // maps shape y -> -z and extrusion -> +y, hence the sign flip on z.
  const shape = new THREE.Shape();
  outline.forEach(([x, z], i) => (i === 0 ? shape.moveTo(x, -z) : shape.lineTo(x, -z)));
  shape.closePath();
  const grassGeo = new THREE.ExtrudeGeometry(shape, { depth: GRASS_DEPTH, bevelEnabled: false });
  grassGeo.rotateX(-Math.PI / 2);
  const grass = new THREE.Mesh(
    grassGeo,
    new THREE.MeshStandardMaterial({ color: palette.grass, flatShading: true }),
  );
  grass.position.y = GRASS_BASE;
  grass.castShadow = true;
  grass.receiveShadow = true;
  group.add(grass);

  // Edge stones: noisy, flattened icosahedra placed on most outline points.
  const rockRng = rng.fork("rocks");
  const rockMat = new THREE.MeshStandardMaterial({ color: palette.rock, flatShading: true });
  for (const [x, z] of outline) {
    if (!rockRng.chance(0.85)) continue;
    const s = rockRng.range(0.24, 0.4);
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const pos = geo.attributes.position!;
    for (let i = 0; i < pos.count; i++) {
      pos.setXYZ(
        i,
        pos.getX(i) * rockRng.range(0.8, 1.15),
        pos.getY(i) * rockRng.range(0.8, 1.15),
        pos.getZ(i) * rockRng.range(0.8, 1.15),
      );
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, rockMat);
    rock.scale.set(s * rockRng.range(0.9, 1.3), s * 0.6, s * rockRng.range(0.9, 1.3));
    rock.position.set(x * 1.02, WATER_TOP, z * 1.02);
    rock.rotation.y = rockRng.range(0, Math.PI * 2);
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  }

  return group;
}

/** Frees GPU resources held by a group built by this module. */
export function disposeGroup(group: THREE.Group): void {
  const materials = new Set<THREE.Material>();
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.geometry.dispose();
      for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    }
  });
  materials.forEach((m) => m.dispose());
}
