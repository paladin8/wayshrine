export {
  DISCOVER_RADIUS,
  canEnter,
  capabilitiesOf,
  deserialize,
  discoverNear,
  isExplored,
  isRestored,
  newGame,
  resetGame,
  resetShrines,
  restoreShrine,
  serialize,
  vitality,
} from "./state";
export type { GameState, SaveData, SaveV1, SaveV2 } from "./state";
export {
  PLAYER_SPEED,
  SHRINE_REACH,
  blockerAt,
  movePlayer,
  requirementOf,
  safePosition,
  shrineInReach,
  startPosition,
} from "./player";
export type { MoveResult } from "./player";
export { nextShrine } from "./guidance";
export type { Guidance } from "./guidance";
export { AWAKENING, AWAKENING_TOTAL, SWELL_CREST, SWELL_LAG, awakeningFrame, skipTarget } from "./awakening";
export type { AwakeningFrame } from "./awakening";
export { FRONT_WIDTH, WAVE_EXTENT, frontGlow, frontRadius, lifeAt } from "./vitality-field";
