/**
 * The restoration moment: the camera pulls back, energy sweeps out from the
 * shrine across the whole region, the view holds on the result, and the
 * camera returns. A pure timeline: the app advances `t` and the renderer
 * draws whatever frame it describes.
 */
export const AWAKENING = {
  /** Camera pulls back; nothing has changed yet. */
  zoomOut: 1.2,
  /** Energy sweeps from the shrine to the edge of the region. */
  wave: 8.8,
  /** Pause on the fully energised region. */
  hold: 3,
  /** Camera returns to the player. */
  zoomIn: 1.6,
} as const;

/**
 * Seconds into the sequence at which the audio swell (`dawn-reverence`) peaks in its file.
 */
export const SWELL_CREST = 8;

/**
 * How much later than `SWELL_CREST` the crest is actually perceived, in seconds. Tuned by ear:
 * with the energy finishing just before the file's peak the crest still felt late by about this
 * much (the cause is not known; audio start-up and the time the ear needs to register a crest are
 * candidates). The energy is timed to finish just before the perceived crest.
 */
export const SWELL_LAG = 1;

export const AWAKENING_TOTAL = AWAKENING.zoomOut + AWAKENING.wave + AWAKENING.hold + AWAKENING.zoomIn;

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

export function awakeningFrame(t: number): AwakeningFrame {
  const waveStart = AWAKENING.zoomOut;
  const holdStart = waveStart + AWAKENING.wave;
  const zoomInStart = holdStart + AWAKENING.hold;
  if (t >= AWAKENING_TOTAL) return { progress: 1, zoom: 0, done: true };
  if (t < waveStart) return { progress: 0, zoom: ease(clamp01(t / AWAKENING.zoomOut)), done: false };
  if (t < holdStart) return { progress: sweep(clamp01((t - waveStart) / AWAKENING.wave)), zoom: 1, done: false };
  if (t < zoomInStart) return { progress: 1, zoom: 1, done: false };
  return { progress: 1, zoom: 1 - ease(clamp01((t - zoomInStart) / AWAKENING.zoomIn)), done: false };
}

/** The time to jump to when the player skips ahead: the region is energised, the camera returns. */
export function skipTarget(t: number): number {
  const zoomInStart = AWAKENING.zoomOut + AWAKENING.wave + AWAKENING.hold;
  return Math.max(t, zoomInStart);
}
