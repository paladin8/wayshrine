export {
  DISCOVER_RADIUS,
  canEnter,
  capabilitiesOf,
  landmarksRestored,
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
  unrestoreShrine,
  serialize,
  vitality,
} from "./state";
export type { GameState, SaveData, SaveV1, SaveV2, SaveV3 } from "./state";
export {
  PLAYER_RADIUS,
  PLAYER_SPEED,
  SHRINE_REACH,
  reachOf,
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
export {
  AWAKENING,
  AWAKENING_LANDMARK,
  AWAKENING_TOTAL,
  SWELL_CREST,
  SWELL_CRESTS,
  SWELL_LAG,
  awakeningFrame,
  awakeningTotal,
  skipTarget,
  timingOf,
  type AwakeningKind,
} from "./awakening";
export type { AwakeningFrame } from "./awakening";
export { FRONT_WIDTH, WAVE_EXTENT, frontGlow, frontRadius, lifeAt } from "./vitality-field";
export { MONUMENT_REACH, isLegible, monumentInReach } from "./monuments";
