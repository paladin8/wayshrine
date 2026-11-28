interface LandmarkView {
  /** Focus relative to the model's origin, in world axes. */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  /** Room for the structure and the adjacent approach, in camera-plane units. */
  readonly width: number;
  readonly height: number;
  readonly radius: number;
}

/** Only the tall landmarks that benefit from a closer, composed approach shot. */
export const LANDMARK_VIEWS: Readonly<Partial<Record<string, LandmarkView>>> = {
  "tokyo-tower": { x: 0, y: 9.1, z: 0.6, width: 12, height: 23, radius: 10 },
  "enoshima-lighthouse": { x: -0.8, y: 3.8, z: 0, width: 14, height: 18, radius: 9 },
  "himeji-castle": { x: 0.2, y: 4, z: 0.2, width: 22, height: 20, radius: 13 },
  "matsumoto-castle": { x: -0.6, y: 4.2, z: 0.7, width: 16, height: 19, radius: 11 },
  "osaka-castle": { x: -1.2, y: 4.7, z: -2.3, width: 17, height: 19, radius: 11 },
};
