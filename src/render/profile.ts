/**
 * A tiny frame profiler, active only with ?perf in the URL (the game then exposes `window.__wsPerf`).
 * `mark(name)` charges the time since the previous mark to `name`, so phases are timed without nesting.
 */
const enabled = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("perf");

interface FrameRecord {
  /** Wall time since the previous frame started (what the player experiences). */
  dt: number;
  /** Time spent in the frame callback itself, in JS (includes the CPU side of WebGL calls). */
  js: number;
  phases: Record<string, number>;
  calls: number;
  triangles: number;
}

let records: FrameRecord[] = [];
let phases: Record<string, number> = {};
let lastMark = 0;
let lastStart = 0;
let info = { calls: 0, triangles: 0, geometries: 0, textures: 0 };

export const profiling = enabled;

// GPU time per frame from timer queries, where the browser offers them.
let gpuSamples: number[] = [];
interface TimerExt { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number }
let timerExt: TimerExt | null | undefined;
const pending: WebGLQuery[] = [];
let activeQuery: WebGLQuery | null = null;

export function perfGpuBegin(gl: WebGL2RenderingContext): void {
  if (!enabled) return;
  if (timerExt === undefined) timerExt = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  if (!timerExt || activeQuery || pending.length > 6) return;
  activeQuery = gl.createQuery();
  if (activeQuery) gl.beginQuery(timerExt.TIME_ELAPSED_EXT, activeQuery);
}

export function perfGpuEnd(gl: WebGL2RenderingContext): void {
  if (!enabled || !timerExt) return;
  if (activeQuery) {
    gl.endQuery(timerExt.TIME_ELAPSED_EXT);
    pending.push(activeQuery);
    activeQuery = null;
  }
  while (pending.length > 0) {
    const q = pending[0]!;
    if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
    pending.shift();
    if (!gl.getParameter(timerExt.GPU_DISJOINT_EXT)) gpuSamples.push(Number(gl.getQueryParameter(q, gl.QUERY_RESULT)) / 1e6);
    gl.deleteQuery(q);
  }
}

export function perfBegin(now: number): number {
  if (!enabled) return 0;
  phases = {};
  lastMark = performance.now();
  const dt = lastStart ? now - lastStart : 0;
  lastStart = now;
  return dt;
}

export function perfMark(name: string): void {
  if (!enabled) return;
  const t = performance.now();
  phases[name] = (phases[name] ?? 0) + (t - lastMark);
  lastMark = t;
}

export function perfInfo(next: typeof info): void {
  if (enabled) info = next;
}

export function perfEnd(dt: number, startedAt: number): void {
  if (!enabled || dt === 0) return;
  records.push({ dt, js: performance.now() - startedAt, phases, calls: info.calls, triangles: info.triangles });
  if (records.length > 20000) records = records.slice(-10000);
}

const pct = (sorted: number[], p: number): number => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;

function summary(): Record<string, unknown> {
  const n = records.length;
  if (n === 0) return { frames: 0 };
  const dts = records.map((r) => r.dt).sort((a, b) => a - b);
  const js = records.map((r) => r.js).sort((a, b) => a - b);
  const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / xs.length;
  const names = new Set<string>();
  for (const r of records) for (const k of Object.keys(r.phases)) names.add(k);
  const phaseAvg: Record<string, number> = {};
  const phaseMax: Record<string, number> = {};
  for (const k of names) {
    const xs = records.map((r) => r.phases[k] ?? 0);
    phaseAvg[k] = +mean(xs).toFixed(3);
    phaseMax[k] = +Math.max(...xs).toFixed(2);
  }
  const over = (ms: number): number => dts.filter((d) => d > ms).length;
  return {
    frames: n,
    fps: +(1000 / mean(dts)).toFixed(1),
    dtMs: { mean: +mean(dts).toFixed(2), p50: +pct(dts, 0.5).toFixed(2), p95: +pct(dts, 0.95).toFixed(2), p99: +pct(dts, 0.99).toFixed(2), max: +dts[n - 1]!.toFixed(2) },
    jsMs: { mean: +mean(js).toFixed(2), p95: +pct(js, 0.95).toFixed(2), max: +js[n - 1]!.toFixed(2) },
    framesOver: { "12ms": over(12), "17ms": over(17), "34ms": over(34), "50ms": over(50) },
    phaseAvg,
    phaseMax,
    gpuMs: gpuSamples.length ? { n: gpuSamples.length, mean: +mean(gpuSamples).toFixed(2), p95: +pct([...gpuSamples].sort((a, b) => a - b), 0.95).toFixed(2), max: +Math.max(...gpuSamples).toFixed(2) } : null,
    calls: Math.round(mean(records.map((r) => r.calls))),
    triangles: Math.round(mean(records.map((r) => r.triangles))),
    geometries: info.geometries,
    textures: info.textures,
  };
}

if (enabled) {
  Object.assign(window, { __wsPerf: { reset: () => { records = []; gpuSamples = []; }, summary, records: () => records } });
}
