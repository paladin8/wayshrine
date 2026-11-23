import { CAPABILITIES, createObstacles, planMonuments, standPoint, createTerrain, createWorld, type Capability } from "./src/world";
import { movePlayer, blockerAt } from "./src/game/player";
const every: ReadonlySet<Capability> = new Set(CAPABILITIES);
const noGeta: ReadonlySet<Capability> = new Set(CAPABILITIES.filter((c) => c !== "geta"));
for (const seed of ["wayshrine"]) {
  const terrain = createTerrain(createWorld(seed));
  const obstacles = createObstacles(terrain, planMonuments(terrain, []));
  for (const region of terrain.world.landmarks) {
    const id = region.landmark!.id;
    if (!["kurashiki-bikan","yanagawa","oze","kushiro-shitsugen"].includes(id)) continue;
    const s = standPoint(region);
    for (const [name, caps] of [["all", every], ["no geta", noGeta]] as const) {
      const res: string[] = [];
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        let p = { ...s };
        for (let i = 0; i < 120; i++) p = movePlayer(p, { x: Math.cos(a), z: Math.sin(a) }, 1 / 30, terrain, caps, obstacles).pos;
        res.push(Math.hypot(p.x - s.x, p.z - s.z).toFixed(1));
      }
      console.log(id, name, "blocker@stand=", blockerAt(terrain, caps, s.x, s.z), "moved:", res.join(" "));
    }
  }
}
