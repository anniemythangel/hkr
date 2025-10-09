import { GAME_ROTATION, type GameRotationConfig, TeamId } from '@hooker/shared';

export type GameConfig = GameRotationConfig;

export const GAME_CONFIGS: GameConfig[] = GAME_ROTATION;

export const RANK_ORDER: Record<string, number> = {
  '9': 0,
  '10': 1,
  J: 2,
  Q: 3,
  K: 4,
  A: 5,
};

export const TRUMP_ORDER: Record<string, number> = {
  '9': 0,
  '10': 1,
  Q: 2,
  K: 3,
  A: 4,
};

export const TEAM_LIST: TeamId[] = ['NorthSouth', 'EastWest'];
