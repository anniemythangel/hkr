import { PlayerId, TeamAssignments, TeamId } from '@hooker/shared';

export interface GameConfig {
  seating: PlayerId[];
  teams: TeamAssignments;
}

export const GAME_CONFIGS: GameConfig[] = [
  {
    seating: ['A', 'C', 'B', 'D'],
    teams: { NorthSouth: ['A', 'B'], EastWest: ['C', 'D'] },
  },
  {
    seating: ['A', 'B', 'C', 'D'],
    teams: { NorthSouth: ['A', 'C'], EastWest: ['B', 'D'] },
  },
  {
    seating: ['A', 'B', 'D', 'C'],
    teams: { NorthSouth: ['A', 'D'], EastWest: ['B', 'C'] },
  },
];

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
