import * as THREE from "three";
import { createRng } from "../core";
import type { Point, Terrain } from "../world";
import { buildCharacter, type Character } from "./character";

interface Lane {
  readonly from: Point;
  readonly to: Point;
}

interface Walker {
  readonly body: Character;
  readonly lane: Lane;
  readonly phase: number;
  readonly speed: number;
}

/** A few walkers make the restored streets feel inhabited. */
export function createTokyoStreetLife(scene: THREE.Scene, terrain: Terrain, lifeAtPoint: (x: number, z: number) => number) {
  const district = terrain.world.landmarks.find((r) => r.landmark?.id === "tokyo-tower");
  const walkers: Walker[] = [];
  let ready = false;
  const people = new THREE.Group();
  scene.add(people);

  function populate(site: Point, id: string): void {
    const rng = createRng(terrain.world.seed).fork("tokyo-walkers");
    const lanes = [
      { from: { x: -22, z: 14 }, to: { x: 22, z: 14 } },
      { from: { x: 22, z: -14 }, to: { x: -22, z: -14 } },
      { from: { x: 14, z: 22 }, to: { x: 14, z: -22 } },
      { from: { x: -14, z: -22 }, to: { x: -14, z: 22 } },
    ];
    for (const { from, to } of lanes) {
      const lane = { from: { x: site.x + from.x, z: site.z + from.z }, to: { x: site.x + to.x, z: site.z + to.z } };
      const inside = Array.from({ length: 23 }, (_, i) => i / 22).every((t) =>
        terrain.tileAtPoint(
          THREE.MathUtils.lerp(lane.from.x, lane.to.x, t), THREE.MathUtils.lerp(lane.from.z, lane.to.z, t),
        ).regionId === id);
      if (!inside) continue;
      const body = buildCharacter(rng.chance(0.5) ? "female" : "male");
      people.add(body.root);
      walkers.push({ body, lane, phase: rng.range(0, 2), speed: rng.range(0.031, 0.043) });
    }
  }

  return (dt: number, clock: number, centre: Point): void => {
    if (!district) return;
    people.visible = Math.hypot(centre.x - district.site.x, centre.z - district.site.z) < 56;
    if (!people.visible) return;
    if (!ready) {
      populate(district.site, district.id);
      ready = true;
    }
    for (const { body, lane: { from, to }, phase, speed } of walkers) {
      const travel = (clock * speed + phase) % 2;
      const t = travel <= 1 ? travel : 2 - travel;
      const direction = travel <= 1 ? 1 : -1;
      const x = THREE.MathUtils.lerp(from.x, to.x, t), z = THREE.MathUtils.lerp(from.z, to.z, t);
      body.root.visible = lifeAtPoint(x, z) > 0.92;
      if (!body.root.visible) continue;
      body.root.position.set(x, terrain.groundAt(x, z), z);
      body.root.rotation.y = Math.atan2(direction * (to.x - from.x), direction * (to.z - from.z));
      body.update(dt, 0.65, 0);
    }
  };
}
