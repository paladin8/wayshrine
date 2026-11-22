import type { Object3D } from "three";
import type { Obstacle } from "../world";
import type { Species } from "./animal-models";

interface BodyFootprint {
  readonly radius: number;
  /** Disc centres along the model's forward axis, from rump to chest or head. */
  readonly offsets: readonly number[];
}

const FOOTPRINT: Readonly<Record<Species, BodyFootprint>> = {
  deer: { radius: 0.26, offsets: [-0.39, 0.04, 0.50] },
  serow: { radius: 0.26, offsets: [-0.35, 0.04, 0.44] },
  boar: { radius: 0.31, offsets: [-0.44, 0.04, 0.52] },
  fox: { radius: 0.19, offsets: [-0.27, 0.04, 0.36] },
  crane: { radius: 0.19, offsets: [-0.20, 0.12] },
  otter: { radius: 0.21, offsets: [-0.36, 0.04, 0.45] },
  dolphin: { radius: 0.32, offsets: [-0.55, 0.02, 0.65] },
  whale: { radius: 0.76, offsets: [-1.20, 0.10, 1.38] },
};

/** The hull can touch a swimming body near the surface. It can pass over a dive or under a leap. */
export function withinBoatHeight(species: Species, lift: number): boolean {
  if (species === "whale") return lift > -0.50;
  if (species === "dolphin") return lift > -0.23 && lift < 0.53;
  return lift > -0.15;
}

/** Use the rendered actor's world transform, including authored landmark headings and scale. */
export function appendAnimalObstacles(
  actor: Object3D, species: Species, x: number, z: number, reach: number, out: Obstacle[],
): void {
  actor.updateWorldMatrix(true, false);
  const matrix = actor.matrixWorld.elements;
  const footprint = FOOTPRINT[species];
  const r = footprint.radius * Math.hypot(matrix[0]!, matrix[1]!, matrix[2]!);
  for (const offset of footprint.offsets) {
    const cx = matrix[12]! + matrix[8]! * offset;
    const cz = matrix[14]! + matrix[10]! * offset;
    if (Math.hypot(cx - x, cz - z) <= reach + r) out.push({ x: cx, z: cz, r });
  }
}
