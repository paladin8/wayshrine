export {
  DISCOVER_RADIUS,
  REVEAL_DISTANCE,
  canEnter,
  capabilitiesOf,
  landmarksRestored,
  collectMonument,
  deserialize,
  discoverNear,
  isCollected,
  isExplored,
  isLandmarkRevealed,
  isRestored,
  newGame,
  recordBoatLaunch,
  recordClimbUse,
  recordAshSandalsUse,
  recordGetaUse,
  recordLanternUse,
  recordSnowshoeUse,
  resetGame,
  resetShrines,
  restoreShrine,
  revealLandmarks,
  unrestoreShrine,
  serialize,
  vitality,
} from "./state";
export type { GameState, SaveData, SaveV1, SaveV2, SaveV3, SaveV4 } from "./state";
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
export {
  AWAKENING,
  AWAKENING_LANDMARK,
  AWAKENING_TOTAL,
  CAPTION_LEAD,
  CAPTION_FADE,
  SWELL_CREST,
  SWELL_CRESTS,
  SWELL_LAG,
  awakeningFrame,
  awakeningTotal,
  captionTarget,
  skipTarget,
  timingOf,
  type AwakeningKind,
} from "./awakening";
export type { AwakeningFrame } from "./awakening";
export { FRONT_WIDTH, WAVE_EXTENT, frontGlow, frontRadius, lifeAt } from "./vitality-field";
export { MONUMENT_REACH, isLegible, monumentInReach } from "./monuments";

export { BOAT_PUSH_OFF_SECONDS, boatLaunchFrame, onWater, planBoatLaunch, type BoatLaunch } from "./boat";
export { otherStation, railwayPowered, stationInReach, trainFrame, TRAIN_BOARD_SECONDS, TRAIN_RUN_SECONDS, TRAIN_TOTAL_SECONDS, type StationIndex, type TrainFrame } from "./train";
