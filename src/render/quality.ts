/**
 * How much rendering a device can afford.
 *
 * Phones and tablets have dense screens and small, heat-limited GPUs, so they start at a lower pixel
 * ratio and with smaller shadow maps. Any device that still can't hold a steady frame rate steps its
 * pixel ratio down while it plays (see `createFrameGovernor`).
 */
export type QualityTier = "desktop" | "phone" | "low";
/** A tier, or "auto" to detect it and let the frame governor adjust. */
export type QualityChoice = QualityTier | "auto";

export interface RenderQuality {
  readonly tier: QualityTier;
  /** Starting pixel ratio cap; the screen's own ratio applies when it is lower. */
  readonly maxPixelRatio: number;
  /** The governor never steps below this. */
  readonly minPixelRatio: number;
  readonly shadowMapSize: number;
}

export interface DeviceTraits {
  readonly devicePixelRatio: number;
  /** Touch is the primary input (phones and tablets). */
  readonly coarsePointer: boolean;
  /** Logical cores; 0 when unknown. */
  readonly cores: number;
  /** Approximate RAM in GB (Chromium only); 0 when unknown. */
  readonly memoryGb: number;
}

export function browserTraits(): DeviceTraits {
  const nav = navigator as Navigator & { deviceMemory?: number };
  return {
    devicePixelRatio: window.devicePixelRatio || 1,
    coarsePointer: window.matchMedia?.("(pointer: coarse)").matches ?? false,
    cores: nav.hardwareConcurrency || 0,
    memoryGb: nav.deviceMemory ?? 0,
  };
}

export const QUALITY_TIERS: Readonly<Record<QualityTier, RenderQuality>> = {
  desktop: { tier: "desktop", maxPixelRatio: 2, minPixelRatio: 1, shadowMapSize: 2048 },
  phone: { tier: "phone", maxPixelRatio: 1.5, minPixelRatio: 0.75, shadowMapSize: 1024 },
  low: { tier: "low", maxPixelRatio: 1, minPixelRatio: 0.75, shadowMapSize: 1024 },
};

export function renderQuality(device: DeviceTraits): RenderQuality {
  if (!device.coarsePointer) return QUALITY_TIERS.desktop;
  const lowEnd = (device.cores > 0 && device.cores <= 4) || (device.memoryGb > 0 && device.memoryGb <= 2);
  return lowEnd ? QUALITY_TIERS.low : QUALITY_TIERS.phone;
}

/** What the renderer is doing now, for the debug panel. */
export interface QualityState {
  readonly choice: QualityChoice;
  readonly tier: QualityTier;
  readonly pixelRatio: number;
  readonly shadowMapSize: number;
}

export function startingPixelRatio(quality: RenderQuality, device: DeviceTraits): number {
  return Math.max(quality.minPixelRatio, Math.min(device.devicePixelRatio, quality.maxPixelRatio));
}

/** Frames slower than this are a hitch (loading, a tab switch) and are left out of the average. */
const HITCH_MS = 250;
/** Sustained frame rate below which the pixel ratio steps down. */
const MIN_FPS = 40;
const WINDOW_MS = 3000;
/** Start-up and the first model loads are slow on every device; don't judge them. */
const WARMUP_MS = 5000;
/** Consecutive slow windows needed before a step, so one heavy moment doesn't cost resolution for good. */
const SLOW_WINDOWS = 2;
const STEP = 0.25;

/**
 * Watches frame times and lowers the pixel ratio, one step at a time, while the average frame rate
 * stays below `MIN_FPS` for `SLOW_WINDOWS` windows in a row. It never raises it again, so the picture can't flicker between two sizes.
 */
export function createFrameGovernor(start: number, floor: number, apply: (pixelRatio: number) => void) {
  let current = start;
  let startedAt = 0;
  let slow = 0;
  let last = 0;
  let windowStart = 0;
  let frames = 0;
  let busy = 0;
  return {
    /** Call once per drawn frame with `performance.now()`. */
    frame(now: number): void {
      if (current <= floor) return;
      if (startedAt === 0) startedAt = now;
      if (last === 0 || now - startedAt < WARMUP_MS) {
        last = windowStart = now;
        return;
      }
      const dt = now - last;
      last = now;
      if (dt > HITCH_MS) return;
      frames++;
      busy += dt;
      if (now - windowStart < WINDOW_MS) return;
      const fps = (frames * 1000) / busy;
      slow = frames > 0 && fps < MIN_FPS ? slow + 1 : 0;
      if (slow >= SLOW_WINDOWS) {
        slow = 0;
        current = Math.max(floor, Math.round((current - STEP) * 100) / 100);
        apply(current);
      }
      windowStart = now;
      frames = 0;
      busy = 0;
    },
    /** Restart measuring, e.g. after the page was hidden. */
    reset(): void {
      last = 0;
      slow = 0;
      frames = 0;
      busy = 0;
    },
    pixelRatio: (): number => current,
  };
}
