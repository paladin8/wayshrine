import { isExplored, isRestored, type GameState } from "../game";
import { palette } from "../render";
import { REGION_SIZE, type Biome, type Monument, type Point, type Region, type World } from "../world";
import { UI_FONT, setText } from "./style";

const SMALL_SIZE = 168;
/** World units per map pixel in the corner map: about five regions across. */
const SMALL_SCALE = 2;
const FOG = [0x3a, 0x34, 0x34] as const;
const DEAD_GREY = [0x8c, 0x8c, 0x88] as const;

const BIOME_HEX: Readonly<Record<Biome, number>> = {
  meadow: palette.grass,
  water: palette.water,
  snow: palette.snow,
  mountain: palette.rock,
};

type RGB = readonly [number, number, number];
const rgb = (hex: number): RGB => [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export interface MapInput {
  readonly pos: Point;
  readonly state: GameState;
  /** The shrine the compass is pointing at, if any. */
  readonly target: Region | null;
  /** False hides the map entirely (a player setting). */
  readonly visible: boolean;
  /** Debug only: monuments to mark, whether or not their regions have been explored. */
  readonly monuments?: readonly Monument[];
  /** The corner hint, in the player's language. */
  readonly labels: { readonly expand: string; readonly close: string };
}

export interface Minimap {
  update(input: MapInput): void;
  toggleExpanded(): void;
}

const CSS = `
.map{position:fixed;pointer-events:none;border-radius:14px;overflow:hidden;border:2px solid #fffaf0cc;box-shadow:0 2px 12px #0004;background:#3a3434}
.map.small{right:14px;bottom:14px}
.map.large{left:50%;top:50%;transform:translate(-50%,-50%);border-radius:18px}
.map canvas{display:block}
.map .hint{position:absolute;left:8px;bottom:6px;font:11px ${UI_FONT};color:#f2ede0;opacity:.8}
`;

/**
 * A region-level map. The corner map follows the player; the expanded map fits
 * everything explored so far. It is drawn in screen orientation (the same
 * rotated view as the game), and unexplored regions stay fogged.
 */
export function createMinimap(
  container: HTMLElement,
  world: World,
  /** Ground direction for a screen-space (right, up) unit vector. */
  basis: (right: number, up: number) => Point,
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
  frame.append(canvas, hint);
  container.appendChild(frame);

  let shown = true;
  const sample = document.createElement("canvas");
  const sctx = sample.getContext("2d")!;

  const R = basis(1, 0);
  const F = basis(0, 1);
  let expanded = false;
  let lastKey = "";
  let lastPos: Point = { x: Infinity, z: Infinity };

  const regionRgb = (r: Region, state: GameState): RGB => {
    if (!isExplored(state, r)) return FOG;
    const alive = rgb(BIOME_HEX[r.biome]);
    return isRestored(state, r) ? alive : mix(alive, DEAD_GREY, 0.8);
  };

  function draw(input: MapInput, size: number, block: number): void {
    const { pos, state, target } = input;
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
      for (const id of state.explored) include(world.regionById(id).site);
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
        const k = (j * n + i) * 4;
        image.data[k] = c[0];
        image.data[k + 1] = c[1];
        image.data[k + 2] = c[2];
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
    for (const id of state.explored) {
      const r = world.regionById(id);
      const [x, y] = project(r.site);
      if (x < -8 || y < -8 || x > size + 8 || y > size + 8) continue;
      ctx.beginPath();
      ctx.arc(x, y, dotR, 0, Math.PI * 2);
      if (isRestored(state, r)) {
        ctx.fillStyle = "#d96b59";
        ctx.fill();
        ctx.strokeStyle = "#ffe9a8";
      } else {
        ctx.fillStyle = "#2a2424";
        ctx.fill();
        ctx.strokeStyle = "#cfc8b8";
      }
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Debug: monuments as diamonds, bright until read.
    for (const m of input.monuments ?? []) {
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
    if (target) {
      const [x, y] = project(target.site);
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

  return {
    toggleExpanded() {
      if (!shown) return; // the key does nothing while the map is hidden
      expanded = !expanded;
      frame.className = expanded ? "map large" : "map small";
      lastKey = "";
    },
    update(input) {
      shown = input.visible;
      frame.style.display = shown ? "" : "none";
      if (!shown) return;
      setText(hint, expanded ? input.labels.close : input.labels.expand);
      const size = expanded ? Math.max(240, Math.floor(Math.min(window.innerWidth, window.innerHeight) * 0.78)) : SMALL_SIZE;
      const key = [
        expanded,
        size,
        input.state.restored.size,
        input.state.explored.size,
        input.state.collected.length,
        input.monuments?.length ?? 0,
        input.target?.id ?? "",
      ].join("|");
      const moved = Math.hypot(input.pos.x - lastPos.x, input.pos.z - lastPos.z);
      if (key === lastKey && moved < 2) return;
      lastKey = key;
      lastPos = input.pos;
      draw(input, size, expanded ? 4 : 3);
    },
  };
}
