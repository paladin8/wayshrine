export {
  canEnter,
  capabilitiesOf,
  deserialize,
  isRestored,
  newGame,
  restoreShrine,
  serialize,
  vitality,
} from "./state";
export type { GameState, SaveData } from "./state";
export {
  PLAYER_SPEED,
  SHRINE_REACH,
  blockerAt,
  movePlayer,
  requirementOf,
  shrineInReach,
  startPosition,
} from "./player";
export type { MoveResult } from "./player";
