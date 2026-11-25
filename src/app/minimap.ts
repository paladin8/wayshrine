import { capabilitiesOf, isExplored, isLandmarkRevealed, isRestored, type GameState } from "../game";
import { BIOMES, BIOME_REQUIRES, REGION_SIZE, canTraverse, type Biome, type Capability, type Monument, type Point, type Region, type World } from "../world";
import { UI_FONT, setText } from "./style";

const SMALL_SIZE = 168;
/** World units per map pixel in the corner map: about five regions across. */
const SMALL_SCALE = 2;
/** The expanded map opens at this zoom (world units per pixel): centred on what is explored when that fits, else on the player. */
const MAX_FIT_SCALE = 1;
/** Zooming out past these hides detail: first the (debug) monuments, then the ordinary shrines. Landmark stars always stay. */
const HIDE_MONUMENTS_SCALE = 1.2;
const HIDE_SHRINES_SCALE = 2;
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

/** A five-point star: gold until the landmark is restored, then the shrine red with a light outline. */
function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, restored: boolean): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
  if (restored) {
    // A dark outer edge and a cream inner one keep the red readable on warm biomes like the volcanic one.
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#2a2424";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.strokeStyle = "#f6ead2";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = "#e04b3a";
    ctx.fill();
    return;
  }
  ctx.fillStyle = "#ffd23f";
  ctx.fill();
  ctx.strokeStyle = "#2a2424";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

function drawShrineDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, restored: boolean): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = restored ? "#d96b59" : "#7a726a";
  ctx.fill();
  if (restored) return;
  ctx.strokeStyle = "#cfc8b8";
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export interface MapInput {
  readonly pos: Point;
  readonly state: GameState;
  /** The nearest reachable unrestored shrine, marked on the map, if any. */
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
    /** A landmark's name, in the current language. */
    readonly landmark: (id: string) => string;
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
.map-zoom.alone{right:14px}
.map.large{z-index:3;pointer-events:auto;left:50%;top:50%;transform:translate(-50%,-50%);border-radius:18px}
.map canvas{display:block}
.map canvas.travel{cursor:pointer}
.map .hint{position:absolute;left:8px;bottom:6px;font:11px ${UI_FONT};color:#f2ede0;opacity:.8}
.map .legend{position:absolute;left:10px;top:10px;display:none;flex-direction:column;gap:4px;padding:8px 10px;border-radius:10px;background:#2a2424d9;font:12px ${UI_FONT};color:#f2ede0;pointer-events:none}
.map.large .legend{display:flex}
.map .legend div{display:flex;align-items:center;gap:7px;white-space:nowrap}
.map .legend .sw{display:inline-block;width:14px;height:14px;border-radius:3px;border:1px solid #fffaf099}
.map .legend .sw.blocked{background-image:repeating-linear-gradient(45deg,#0000 0 3px,#2a2424b3 3px 5px)}
.map .legend .need{opacity:.75;display:none}
.map.large .legend{pointer-events:auto}
.map .legend:hover .need{display:inline}
.map.large canvas{cursor:grab;touch-action:none}
.map.large canvas.travel{cursor:pointer}
.map.large canvas.dragging{cursor:grabbing}
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
  /** The expanded map's view, as an offset from the auto-fit view (screen-space world units) and a zoom factor. */
  let panU = 0;
  let panV = 0;
  let zoomK = 1;
  /** The view the last expanded draw used: centre (screen-space u, v) and world units per pixel, and the auto-fit it started from. */
  let view = { u: 0, v: 0, scale: 1, fitU: 0, fitV: 0, fitScale: 1 };
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
      let fitScale = Math.max(span / size, MAX_FIT_SCALE);
      let fitU = (minU + maxU) / 2;
      let fitV = (minV + maxV) / 2;
      if (fitScale > MAX_FIT_SCALE) {
        // Too much explored to show at once: stay at a readable size, centred on the player.
        fitScale = MAX_FIT_SCALE;
        fitU = pos.x * R.x + pos.z * R.z;
        fitV = pos.x * F.x + pos.z * F.z;
      }
      scale = fitScale / zoomK;
      const u = fitU + panU;
      const v = fitV + panV;
      view = { u, v, scale, fitU, fitV, fitScale };
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
      if (expanded && scale > HIDE_SHRINES_SCALE) break;
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
      if (expanded && scale > HIDE_MONUMENTS_SCALE) break;
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
        // A cream ring over a dark one, so it reads on pale snow and dark forest alike.
        const ringR = (h.region.landmark ? starR : dotR) + 2.5;
        ctx.beginPath();
        ctx.arc(h.x, h.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = "#2a2424";
        ctx.lineWidth = 4;
        ctx.stroke();
        ctx.strokeStyle = "#fffaf0";
        ctx.lineWidth = 2;
        ctx.stroke();
        if (h.region.landmark && isRestored(state, h.region)) {
          // A restored landmark's name, on a small plate above it (below it when too near the top edge).
          const label = input.names.landmark(h.region.landmark.id);
          ctx.font = `600 13px ${UI_FONT}`;
          const w = ctx.measureText(label).width + 16;
          const x = Math.min(size - w / 2 - 6, Math.max(w / 2 + 6, h.x));
          const above = h.y - starR - 12 > 22;
          const y = above ? h.y - starR - 12 : h.y + starR + 12;
          ctx.fillStyle = "#2a2424ee";
          ctx.beginPath();
          ctx.roundRect(x - w / 2, y - 11, w, 22, 6);
          ctx.fill();
          ctx.fillStyle = "#f2ede0";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(label, x, y + 0.5);
        }
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
  // Google-Maps-style navigation: drag to pan, wheel to zoom about the cursor.
  let redrawQueued = false;
  const redraw = (): void => {
    if (redrawQueued) return;
    redrawQueued = true;
    requestAnimationFrame(() => {
      redrawQueued = false;
      if (expanded && lastInput) draw(lastInput, lastSize, zoomK > 2.5 ? 3 : 4);
    });
  };
  const toCanvas = (e: MouseEvent): [number, number] => {
    const box = canvas.getBoundingClientRect();
    return [((e.clientX - box.left) / box.width) * canvas.width, ((e.clientY - box.top) / box.height) * canvas.height];
  };
  const maxScale = (): number => Math.max(view.fitScale * 2.5, 6);
  const setView = (u: number, v: number, scale: number): void => {
    const clamped = Math.max(0.25, Math.min(maxScale(), scale));
    panU = u - view.fitU;
    panV = v - view.fitV;
    zoomK = view.fitScale / clamped;
  };
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (!expanded) return;
      e.preventDefault();
      const [x, y] = toCanvas(e);
      const half = canvas.width / 2;
      const uAt = view.u + (x - half) * view.scale;
      const vAt = view.v + (half - y) * view.scale;
      const next = Math.max(0.25, Math.min(maxScale(), view.scale * Math.exp(e.deltaY * 0.0015)));
      view = { ...view, scale: next, u: uAt - (x - half) * next, v: vAt - (half - y) * next };
      setView(view.u, view.v, next);
      redraw();
    },
    { passive: false },
  );
  let drag: { id: number; x: number; y: number; moved: boolean } | null = null;
  let suppressClick = false;
  canvas.addEventListener("pointerdown", (e) => {
    if (!expanded || e.button !== 0) return;
    const [x, y] = toCanvas(e);
    drag = { id: e.pointerId, x, y, moved: false };
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const [x, y] = toCanvas(e);
    if (!drag.moved) {
      if (Math.hypot(x - drag.x, y - drag.y) < 4) return;
      drag.moved = true;
      canvas.setPointerCapture(e.pointerId);
      canvas.classList.add("dragging");
      hovered = null;
    }
    setView(view.u - (x - drag.x) * view.scale, view.v + (y - drag.y) * view.scale, view.scale);
    drag.x = x;
    drag.y = y;
    redraw();
  });
  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    suppressClick = drag.moved;
    drag = null;
    canvas.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("mousemove", (e) => {
    if (drag?.moved) return;
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
    if (suppressClick) {
      suppressClick = false;
      return;
    }
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
      panU = 0;
      panV = 0;
      zoomK = 1;
      drag = null;
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
