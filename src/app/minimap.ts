import { capabilitiesOf, isExplored, isLandmarkRevealed, isRestored, type GameState } from "../game";
import { BIOMES, BIOME_REQUIRES, REGION_SIZE, canTraverse, type Biome, type Capability, type Monument, type Point, type Region, type World } from "../world";
import { UI_FONT, setText } from "./style";

const SMALL_SIZE = 168;
/** World units per map pixel in the corner map: about five regions across. */
const SMALL_SCALE = 2;
const FOG = [0x3a, 0x34, 0x34] as const;
const DEAD_GREY = [0x8c, 0x8c, 0x88] as const;
/** How far an unrestored region is drained toward grey: enough to read as asleep, not enough to lose its biome. */
const DEAD_DRAIN = 0.4;

/**
 * The map's own biome colours, chosen to tell the biomes apart at a glance (they differ from the
 * game's palette, where marsh and meadow, or water and sea, are close).
 */
const BIOME_HEX: Readonly<Record<Biome, number>> = {
  meadow: 0x84b567,
  water: 0x3fb2bd,
  snow: 0xf1f4f6,
  mountain: 0x9c8f86,
  marsh: 0xb5b04a,
  forest: 0x2c6b45,
  volcanic: 0xa5503a,
  sea: 0x24509a,
  dunes: 0xe6c987,
};

type RGB = readonly [number, number, number];
const rgb = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** A five-point star: gold until the landmark is restored, then the shrine red. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, restored: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = restored ? "#d96b59" : "#ffd23f";
  ctx.fill();
  ctx.strokeStyle = restored ? "#ffe9a8" : "#2a2424";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawShrineDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, restored: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = restored ? "#d96b59" : "#2a2424";
  ctx.fill();
  ctx.strokeStyle = restored ? "#ffe9a8" : "#cfc8b8";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export interface MapInput {
  readonly pos: Point;
  readonly state: GameState;
  /** The shrine the compass is pointing at, if any. */
  readonly target: Region | null;
  /** False hides the map entirely (a player setting). */
  readonly visible: boolean;
  /** Debug only: monuments to mark; only those in restored regions are drawn. */
  readonly monuments?: readonly Monument[];
  /** Debug only: any explored shrine can be travelled to, not just restored ones. */
  readonly travelToAny?: boolean;
  /** The corner hint, in the player's language. */
  readonly labels: { readonly expand: string; readonly close: string; readonly travel: string; readonly zoom: string };
  /** Names for the legend of the expanded map, in the player's language. */
  readonly names: {
    readonly terrain: Readonly<Record<Biome, string>>;
    readonly capability: Readonly<Record<Capability, string>>;
    readonly needs: (gear: string) => string;
  };
}

/** A shrine the player can travel to from the expanded map, in canvas pixels. */
interface Waypoint {
  readonly x: number;
  readonly y: number;
  readonly region: Region;
}

export interface Minimap {
  update(input: MapInput): void;
  toggleExpanded(): void;
  isExpanded(): boolean;
}

const CSS = `
.map{position:fixed;pointer-events:none;border-radius:14px;overflow:hidden;border:2px solid #fffaf0cc;box-shadow:0 2px 12px #0004;background:#3a3434}
.map.small{right:14px;bottom:14px}
.map-zoom{position:fixed;bottom:14px;right:calc(14px + 172px + 8px);width:34px;height:34px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;border-radius:50%;border:1px solid #2a242422;background:#fffaf0cc;color:#2a2424;font:600 15px/1 ${UI_FONT};cursor:pointer;pointer-events:auto}
.map-zoom:hover{background:#fffaf0}
.map-zoom:focus-visible{outline:2px solid #d96b59;outline-offset:2px}
.map-zoom.alone{right:14px}
.map.large{pointer-events:auto;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:18px}
.map canvas{display:block}
.map canvas.travel{cursor:pointer}
.map .hint{position:absolute;left:8px;bottom:6px;font:11px ${UI_FONT};color:#f2ede0;opacity:.8}
.map .legend{position:absolute;left:10px;top:10px;display:none;flex-direction:column;gap:4px;padding:8px 10px;border-radius:10px;background:#2a2424d9;font:12px ${UI_FONT};color:#f2ede0;pointer-events:none}
.map.large .legend{display:flex}
.map .legend div{display:flex;align-items:center;gap:7px;white-space:nowrap}
.map .legend .sw{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid #fffaf099}
.map .legend .sw.blocked{background-image:repeating-linear-gradient(45deg,#0000 0 3px,#2a2424b3 3px 5px)}
.map .legend .need{opacity:.75}
`;

/**
 * A region-level map. The corner map follows the player; the expanded map fits
 * explored regions and revealed landmarks. It is drawn in screen orientation (the same
 * rotated view as the game), and unexplored regions stay fogged.
 */
export function createMinimap(
  container: HTMLElement,
  world: World,
  /** Ground direction for a screen-space (right, up) unit vector. */
  basis: (right: number, up: number) => Point,
  /** Called when the player clicks a shrine on the expanded map. */
  onTravel: (region: Region) => void,
  /** Called by the zoom-out button beside the corner map. */
  onZoom: () => void = () => {},
): Minimap {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const frame = document.createElement("div");
  frame.className = "map small";
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const hint = document.createElement("div");
  hint.className = "hint";
  const legend = document.createElement("div");
  legend.className = "legend";
  frame.append(canvas, legend, hint);
  container.appendChild(frame);
  const zoom = document.createElement("button");
  zoom.type = "button";
  zoom.className = "map-zoom";
  zoom.textContent = "Z";
  zoom.addEventListener("click", () => {
    onZoom();
    zoom.blur(); // hand the keyboard back to the game
  });
  container.appendChild(zoom);

  let shown = true;
  const sample = document.createElement("canvas");
  const sctx = sample.getContext("2d")!;

  const R = basis(1, 0);
  const F = basis(0, 1);
  let expanded = false;
  let lastKey = "";
  let waypoints: Waypoint[] = [];
  let hovered: Waypoint | null = null;
  let lastPos: Point = { x: Infinity, z: Infinity };

  const regionRgb = (r: Region, state: GameState): RGB => {
    if (!isExplored(state, r)) return FOG;
    const alive = rgb(BIOME_HEX[r.biome]);
    return isRestored(state, r) ? alive : mix(alive, DEAD_GREY, DEAD_DRAIN);
  };

  /** The legend: each biome seen so far, and the gear a blocked one needs. Rebuilt only when it changes. */
  let legendKey = "";
  function updateLegend(input: MapInput): void {
    const caps = capabilitiesOf(input.state, world);
    const seen = new Set<Biome>(["meadow"]);
    for (const id of input.state.explored) seen.add(world.regionById(id).biome);
    const rows = BIOMES.filter((b) => seen.has(b)).map((b) => ({ b, blocked: !canTraverse(b, caps) }));
    const key = [...rows.map((r) => `${r.b}${r.blocked ? "!" : ""}`), input.names.terrain.meadow, input.names.needs("")].join("|");
    if (key === legendKey) return;
    legendKey = key;
    legend.replaceChildren(
      ...rows.map(({ b, blocked }) => {
        const row = document.createElement("div");
        const swatch = document.createElement("span");
        swatch.className = blocked ? "sw blocked" : "sw";
        swatch.style.backgroundColor = `#${BIOME_HEX[b].toString(16).padStart(6, "0")}`;
        const name = document.createElement("span");
        name.textContent = input.names.terrain[b];
        row.append(swatch, name);
        const gear = BIOME_REQUIRES[b];
        if (blocked && gear) {
          const need = document.createElement("span");
          need.className = "need";
          need.textContent = input.names.needs(input.names.capability[gear]);
          row.append(need);
        }
        return row;
      }),
    );
  }

  function draw(input: MapInput, size: number, block: number): void {
    const { pos, state, target } = input;
    const caps = capabilitiesOf(state, world);
    const markedLandmarks = world.landmarks.filter((region) => isLandmarkRevealed(state, region) || isRestored(state, region));
    // View: centre (ground point) and scale (world units per pixel).
    let centre: Point = pos;
    let scale = SMALL_SCALE;
    if (expanded) {
      let minU = Infinity, maxU = -Infinity, minV = Infinity, maxV = -Infinity;
      const include = (p: Point): void => {
        const u = p.x * R.x + p.z * R.z;
        const v = p.x * F.x + p.z * F.z;
        minU = Math.min(minU, u); maxU = Math.max(maxU, u);
        minV = Math.min(minV, v); maxV = Math.max(maxV, v);
      };
      include(pos);
      for (const id of state.explored) include(world.regionById(id).shrine);
      for (const landmark of markedLandmarks) {
        if (!state.explored.has(landmark.id)) include(landmark.shrine);
      }
      const span = Math.max(maxU - minU, maxV - minV) + REGION_SIZE * 1.6;
      scale = Math.max(span / size, 1.2);
      const u = (minU + maxU) / 2;
      const v = (minV + maxV) / 2;
      centre = { x: u * R.x + v * F.x, z: u * R.z + v * F.z };
    }

    const n = Math.ceil(size / block);
    sample.width = n;
    sample.height = n;
    const image = sctx.createImageData(n, n);
    const ids: string[] = new Array<string>(n * n);
    const colours = new Map<string, RGB>();
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const u = ((i + 0.5) * block - size / 2) * scale;
        const v = (size / 2 - (j + 0.5) * block) * scale;
        const r = world.regionAt(centre.x + R.x * u + F.x * v, centre.z + R.z * u + F.z * v);
        ids[j * n + i] = r.id;
        let c = colours.get(r.id);
        if (!c) {
          c = regionRgb(r, state);
          colours.set(r.id, c);
        }
        // Ground the player cannot cross yet is hatched, so a wall reads as a wall.
        const hatch = isExplored(state, r) && !canTraverse(r.biome, caps) && (i + j) % 4 === 0 ? 0.62 : 1;
        const k = (j * n + i) * 4;
        image.data[k] = c[0] * hatch;
        image.data[k + 1] = c[1] * hatch;
        image.data[k + 2] = c[2] * hatch;
        image.data[k + 3] = 255;
      }
    }
    // Darken cells on a region boundary so the Voronoi shapes read clearly.
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const id = ids[j * n + i]!;
        // Borders appear only beside explored regions, so fog never reveals the layout beyond.
        const differs = (other: string | undefined): boolean =>
          other !== undefined && other !== id && (state.explored.has(id) || state.explored.has(other));
        const border = (i > 0 && differs(ids[j * n + i - 1])) || (j > 0 && differs(ids[(j - 1) * n + i]));
        if (!border) continue;
        const k = (j * n + i) * 4;
        image.data[k] = image.data[k]! * 0.72;
        image.data[k + 1] = image.data[k + 1]! * 0.72;
        image.data[k + 2] = image.data[k + 2]! * 0.72;
      }
    }
    sctx.putImageData(image, 0, 0);
    canvas.width = size;
    canvas.height = size;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sample, 0, 0, size, size);

    const project = (p: Point): [number, number] => {
      const dx = p.x - centre.x;
      const dz = p.z - centre.z;
      return [size / 2 + (dx * R.x + dz * R.z) / scale, size / 2 - (dx * F.x + dz * F.z) / scale];
    };

    // Shrines of explored regions.
    const dotR = expanded ? 4.5 : 3.5;
    waypoints = [];
    for (const id of state.explored) {
      const r = world.regionById(id);
      if (r.landmark) continue; // landmark markers are drawn below
      const [x, y] = project(r.shrine);
      if (x < -8 || y < -8 || x > size + 8 || y > size + 8) continue;
      if (expanded && (input.travelToAny || isRestored(state, r))) waypoints.push({ x, y, region: r });
      drawShrineDot(ctx, x, y, dotR, isRestored(state, r));
    }
    const starR = expanded ? 9 : 7;
    for (const r of markedLandmarks) {
      const [x, y] = project(r.shrine);
      if (x < -starR || y < -starR || x > size + starR || y > size + starR) continue;
      const restored = isRestored(state, r);
      if (expanded && (restored || input.travelToAny)) waypoints.push({ x, y, region: r });
      drawStar(ctx, x, y, starR, restored);
    }
    // Debug: monuments in restored regions as diamonds, bright until read.
    for (const m of input.monuments ?? []) {
      if (!state.restored.has(m.regionId)) continue;
      const [x, y] = project(m);
      if (x < -8 || y < -8 || x > size + 8 || y > size + 8) continue;
      const r = expanded ? 3.5 : 3;
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.fillStyle = state.collected.includes(m.id) ? "#8a8a8a" : "#ffd23f";
      ctx.fill();
      ctx.strokeStyle = "#2a2424";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (hovered) {
      const h = waypoints.find((w) => w.region.id === hovered?.region.id);
      if (h) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, dotR + 3.5, 0, Math.PI * 2);
        ctx.strokeStyle = "#fffaf0";
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (target && (!target.landmark || isLandmarkRevealed(state, target))) {
      const [x, y] = project(target.shrine);
      ctx.beginPath();
      ctx.arc(x, y, dotR + 4, 0, Math.PI * 2);
      ctx.strokeStyle = "#ffe9a8";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // The player.
    const [px, py] = project(pos);
    ctx.beginPath();
    ctx.arc(px, py, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#fffaf0";
    ctx.fill();
    ctx.strokeStyle = "#2a2424";
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  let lastInput: MapInput | null = null;
  let lastSize = SMALL_SIZE;
  const HIT_RADIUS = 11;
  const hit = (e: MouseEvent): Waypoint | null => {
    if (!expanded) return null;
    const box = canvas.getBoundingClientRect();
    const x = ((e.clientX - box.left) / box.width) * canvas.width;
    const y = ((e.clientY - box.top) / box.height) * canvas.height;
    let best: Waypoint | null = null;
    let bestD = HIT_RADIUS;
    for (const w of waypoints) {
      const d = Math.hypot(w.x - x, w.y - y);
      if (d <= bestD) {
        best = w;
        bestD = d;
      }
    }
    return best;
  };
  canvas.addEventListener("mousemove", (e) => {
    const next = hit(e);
    canvas.classList.toggle("travel", next !== null);
    if (next?.region.id === hovered?.region.id) return;
    hovered = next;
    if (lastInput) draw(lastInput, lastSize, 4);
  });
  canvas.addEventListener("mouseleave", () => {
    if (!hovered) return;
    hovered = null;
    if (lastInput) draw(lastInput, lastSize, 4);
  });
  canvas.addEventListener("click", (e) => {
    const target = hit(e);
    if (target) onTravel(target.region);
  });

  return {
    isExpanded: () => expanded,
    toggleExpanded() {
      if (!shown) return; // the key does nothing while the map is hidden
      expanded = !expanded;
      frame.className = expanded ? "map large" : "map small";
      zoom.style.display = expanded ? "none" : "";
      hovered = null;
      lastKey = "";
    },
    update(input) {
      shown = input.visible;
      frame.style.display = shown ? "" : "none";
      zoom.classList.toggle("alone", !shown);
      zoom.style.display = expanded ? "none" : "";
      zoom.title = input.labels.zoom;
      zoom.setAttribute("aria-label", input.labels.zoom);
      if (!shown) return;
      setText(hint, expanded ? `${input.labels.close} · ${input.labels.travel}` : input.labels.expand);
      const size = expanded ? Math.max(240, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.78)) : SMALL_SIZE;
      if (expanded) updateLegend(input);
      const key = [
        expanded,
        size,
        input.travelToAny ?? false,
        input.monuments?.length ?? 0,
        input.target?.id ?? "",
      ].join("|");
      const moved = Math.hypot(input.pos.x - lastPos.x, input.pos.z - lastPos.z);
      if (key === lastKey && lastInput?.state === input.state && lastInput.names.terrain === input.names.terrain && moved < 2) return;
      lastKey = key;
      lastPos = input.pos;
      lastInput = input;
      lastSize = size;
      draw(input, size, expanded ? 4 : 3);
    },
  };
}
