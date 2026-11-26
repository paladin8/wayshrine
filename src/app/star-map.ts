import type { Point, Region } from "../world";

export type GroundBasis = (right: number, up: number) => Point;

const ease = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export const STAR_MAP_SIZE = 620;

export interface StarMapPoint {
  readonly x: number;
  readonly y: number;
  readonly last: boolean;
}

/** Project the landmarks using the same orientation as the game map. */
export function projectStarMap(landmarks: readonly Region[], basis: GroundBasis, finalLandmarkId?: string): StarMapPoint[] {
  if (landmarks.length === 0) return [];
  const rightAxis = basis(1, 0);
  const upAxis = basis(0, 1);
  const c = STAR_MAP_SIZE / 2;
  const projected = landmarks.map(({ id, shrine: { x, z } }) => ({
    id,
    right: x * rightAxis.x + z * rightAxis.z,
    up: x * upAxis.x + z * upAxis.z,
  }));
  const xs = projected.map((p) => p.right);
  const ys = projected.map((p) => p.up);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  const scale = 2 * (c - 54) / Math.max(1, x1 - x0, y1 - y0);
  const sorted = projected.map(({ id, right, up }) => ({
    x: c + (right - (x0 + x1) / 2) * scale,
    y: c - (up - (y0 + y1) / 2) * scale,
    last: id === finalLandmarkId,
  }));
  // Order the stars outward from the centre, with the final landmark last.
  sorted.sort((a, b) => Number(a.last) - Number(b.last) || Math.hypot(a.x - c, a.y - c) - Math.hypot(b.x - c, b.y - c));
  return sorted;
}

/** Draw the finished chart, or give each star an age in seconds during the ceremony. */
export function drawStarMap(ctx: CanvasRenderingContext2D, points: readonly StarMapPoint[], ageAt: (index: number) => number = () => Infinity): void {
  const c = STAR_MAP_SIZE / 2;
  const ring = (x: number, y: number, radius: number, color: string): void => {
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  ctx.clearRect(0, 0, 2 * c, 2 * c);
  for (const r of [0.32, 0.62, 0.91]) ring(c, c, c * r, "#e3ca8748");
  ctx.beginPath();
  ctx.moveTo(c * 0.09, c); ctx.lineTo(c * 1.91, c);
  ctx.moveTo(c, c * 0.09); ctx.lineTo(c, c * 1.91);
  ctx.strokeStyle = "#e3ca8730";
  ctx.stroke();

  for (const [index, point] of points.entries()) {
    const age = ageAt(index);
    ctx.beginPath();
    if (age <= 0) {
      ctx.arc(point.x, point.y, 2.4, 0, 2 * Math.PI);
      ctx.fillStyle = "#c2836baa";
      ctx.fill();
      continue;
    }
    const light = ease(age / 0.42);
    const size = (point.last ? 12 : 7.3) + 3.5 * (1 - ease(age / 0.68));
    ctx.globalAlpha = 0.32 + 0.68 * light;
    ctx.shadowColor = "#eabf62";
    ctx.shadowBlur = (point.last ? 10 : 4) + 12 * (1 - ease(age / 0.9));
    for (let j = 0; j < 10; j++) {
      const angle = Math.PI * (j / 5 - 0.5);
      const r = j % 2 === 0 ? size : size * 0.42;
      ctx.lineTo(point.x + Math.cos(angle) * r, point.y + Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fillStyle = point.last ? "#fff1c6" : "#ffdf83";
    ctx.fill();
    ctx.shadowBlur = 0;
    if (point.last) ring(point.x, point.y, 18 + 30 * (1 - ease(age / 0.95)), "#ffe1a1aa");
    ctx.globalAlpha = 1;
  }
}

/** Draw the same landmarks as ink marks on the journal paper. */
export function drawJournalStarMap(ctx: CanvasRenderingContext2D, points: readonly StarMapPoint[]): void {
  const c = STAR_MAP_SIZE / 2;
  ctx.clearRect(0, 0, STAR_MAP_SIZE, STAR_MAP_SIZE);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineWidth = 1.35;
  ctx.strokeStyle = "#55516e7a";
  for (const [index, fraction] of [0.32, 0.62, 0.91].entries()) {
    const start = 0.4 + index * 1.7;
    ctx.beginPath();
    for (let step = 0; step <= 120; step++) {
      const angle = start + step / 120 * (2 * Math.PI - 0.055);
      const radius = c * fraction + Math.sin(angle * 5 + index) * 1.5 + Math.sin(angle * 9 - index) * 0.7;
      const x = c + Math.cos(angle) * radius;
      const y = c + Math.sin(angle) * radius;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.fillStyle = "#302941";
  for (const [index, point] of points.entries()) {
    const size = 6 + 1.3 * Math.sin(index * 2.4);
    ctx.save();
    ctx.translate(point.x, point.y);
    ctx.rotate(0.2 * Math.sin(index * 1.4));
    ctx.beginPath();
    ctx.moveTo(0, -1.2 * size);
    ctx.quadraticCurveTo(1.4, -1.2, size, 0);
    ctx.quadraticCurveTo(1.5, 1, 0.3, size);
    ctx.quadraticCurveTo(-1, 1.5, -size, 0.6);
    ctx.quadraticCurveTo(-1, -1.1, 0, -1.2 * size);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}
