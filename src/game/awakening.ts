/**
 * The restoration moment: the camera pulls back, energy sweeps out from the
 * shrine across the whole region, the view holds on the result, and the
 * camera returns. A pure timeline: the app advances `t` and the renderer
 * draws whatever frame it describes.
 */
export interface AwakeningTiming {
  /** Camera pulls back; nothing has changed yet. */
  readonly zoomOut: number;
  /** Energy sweeps from the shrine to the edge of the region. */
  readonly wave: number;
  /** Pause on the fully energised region. */
  readonly hold: number;
  /** Camera returns to the player. */
  readonly zoomIn: number;
}

/** What is being restored: a landmark gets a longer, grander sequence than an ordinary shrine. */
export type AwakeningKind = "shrine" | "landmark";

/** An ordinary shrine: the wave fills the region, a short pause, the camera returns. */
export const AWAKENING: AwakeningTiming = {
  zoomOut: 1.2,
  wave: 8.8,
  hold: 1.5,
  zoomIn: 1.6,
};

/** A landmark: a slower wave timed to its own track, and the long pause on the finished region. */
export const AWAKENING_LANDMARK: AwakeningTiming = {
  zoomOut: 1.2,
  wave: 10.8,
  hold: 3,
  zoomIn: 1.6,
};

export const timingOf = (kind: AwakeningKind): AwakeningTiming => (kind === "landmark" ? AWAKENING_LANDMARK : AWAKENING);

/**
 * Seconds into the sequence at which the audio swell peaks in its file: `dawn-reverence`
 * for a shrine, `radiant-arrival` for a landmark.
 */
export const SWELL_CRESTS: Readonly<Record<AwakeningKind, number>> = { shrine: 8, landmark: 10 };
export const SWELL_CREST = SWELL_CRESTS.shrine;

/**
 * How much later than the crest is actually perceived, in seconds. Tuned by ear:
 * with the energy finishing just before the file's peak the crest still felt late by about this
 * much (the cause is not known; audio start-up and the time the ear needs to register a crest are
 * candidates). The energy is timed to finish just before the perceived crest.
 */
export const SWELL_LAG = 1;

export const awakeningTotal = (kind: AwakeningKind = "shrine"): number => {
  const t = timingOf(kind);
  return t.zoomOut + t.wave + t.hold + t.zoomIn;
};
export const AWAKENING_TOTAL = awakeningTotal("shrine");

export interface AwakeningFrame {
  /** Restoration progress of the region, 0 to 1. */
  readonly progress: number;
  /** How far the camera is pulled back, 0 (normal) to 1 (whole region in view). */
  readonly zoom: number;
  readonly done: boolean;
}

const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));
const ease = (t: number): number => t * t * (3 - 2 * t);
/** Eases in gently but keeps moving at the end, so the front does not crawl through the last stretch. */
const sweep = (u: number): number => 0.5 * u + 0.5 * ease(u);

export function awakeningFrame(t: number, kind: AwakeningKind = "shrine"): AwakeningFrame {
  const timing = timingOf(kind);
  const waveStart = timing.zoomOut;
  const holdStart = waveStart + timing.wave;
  const zoomInStart = holdStart + timing.hold;
  if (t >= awakeningTotal(kind)) return { progress: 1, zoom: 0, done: true };
  if (t < waveStart) return { progress: 0, zoom: ease(clamp01(t / timing.zoomOut)), done: false };
  if (t < holdStart) return { progress: sweep(clamp01((t - waveStart) / timing.wave)), zoom: 1, done: false };
  if (t < zoomInStart) return { progress: 1, zoom: 1, done: false };
  return { progress: 1, zoom: 1 - ease(clamp01((t - zoomInStart) / timing.zoomIn)), done: false };
}

/** The time to jump to when the player skips ahead: the region is energised, the camera returns. */
export function skipTarget(t: number, kind: AwakeningKind = "shrine"): number {
  const timing = timingOf(kind);
  return Math.max(t, timing.zoomOut + timing.wave + timing.hold);
}
