export {
  DISCOVER_RADIUS,
  canEnter,
  capabilitiesOf,
  collectMonument,
  deserialize,
  discoverNear,
  isCollected,
  isExplored,
  isRestored,
  newGame,
  resetGame,
  resetShrines,
  restoreShrine,
  serialize,
  vitality,
} from "./state";
export type { GameState, SaveData, SaveV1, SaveV2, SaveV3 } from "./state";
export {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SHRINE_REACH,
  blockerAt,
  clearOfObstacles,
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
export { MONUMENT_REACH, isLegible, monumentInReach } from "./monuments";
