/** How long it must stay still before the camera cuts to it. */
const STILL_SECONDS = 0.1;

/**
 * For players who ask for reduced motion: the camera cuts between framings instead of zooming.
 * The shown zoom holds while the requested zoom is moving and jumps to it once it settles, so a
 * restoration pull-back becomes one cut out and one cut back in.
 */
export function createZoomCut() {
  let primed = false;
  let shown = 0;
  let last = 0;
  let still = 0;
  return (zoom: number, dt: number): number => {
    if (!primed) {
      primed = true;
      shown = last = zoom;
      return zoom;
    }
    if (dt > 0) {
      still = zoom === last ? still + dt : 0;
      last = zoom;
      if (still + Number.EPSILON >= STILL_SECONDS) shown = zoom;
    }
    return shown;
  };
}
