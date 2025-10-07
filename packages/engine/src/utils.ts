import { Card, PlayerId, Suit, TeamAssignments, TeamId } from '@hooker/shared';
import { GAME_CONFIGS } from './constants';

export function getGameConfig(gameIndex: number) {
  return GAME_CONFIGS[gameIndex % GAME_CONFIGS.length];
}

export function nextPlayer(current: PlayerId, seating: PlayerId[]): PlayerId {
  const index = seating.indexOf(current);
  if (index === -1) {
    throw new Error(`Player ${current} is not seated`);
  }
  return seating[(index + 1) % seating.length];
}

export function previousPlayer(current: PlayerId, seating: PlayerId[]): PlayerId {
  const index = seating.indexOf(current);
  if (index === -1) {
    throw new Error(`Player ${current} is not seated`);
  }
  return seating[(index + seating.length - 1) % seating.length];
}

export function createEmptyHands(): Record<PlayerId, Card[]> {
  return {
    A: [],
    B: [],
    C: [],
    D: [],
  };
}

export function cloneHands(hands: Record<PlayerId, Card[]>): Record<PlayerId, Card[]> {
  return {
    A: [...hands.A],
    B: [...hands.B],
    C: [...hands.C],
    D: [...hands.D],
  };
}

export function mapPlayers<T>(fn: (player: PlayerId) => T): Record<PlayerId, T> {
  return {
    A: fn('A'),
    B: fn('B'),
    C: fn('C'),
    D: fn('D'),
  } as Record<PlayerId, T>;
}

export function assignTeams(config: TeamAssignments): Record<PlayerId, TeamId> {
  const map: Record<PlayerId, TeamId> = {
    A: 'NorthSouth',
    B: 'NorthSouth',
    C: 'EastWest',
    D: 'EastWest',
  };
  for (const [team, players] of Object.entries(config) as [TeamId, PlayerId[]][]) {
    for (const player of players) {
      map[player] = team;
    }
  }
  return map;
}

const SUIT_COLOR: Record<Suit, 'black' | 'red'> = {
  clubs: 'black',
  spades: 'black',
  hearts: 'red',
  diamonds: 'red',
};

export function getSuitColor(suit: Suit) {
  return SUIT_COLOR[suit];
}

export function getNassih(trump: Suit): Card {
  return { suit: trump, rank: 'J' };
}

export function getNassihAhh(trump: Suit): Card {
  const targetColor = SUIT_COLOR[trump];
  const suit = (Object.keys(SUIT_COLOR) as Suit[]).find(
    (candidate) => candidate !== trump && SUIT_COLOR[candidate] === targetColor,
  );
  if (!suit) {
    throw new Error(`No Nassih Ahh suit for ${trump}`);
  }
  return { suit, rank: 'J' } as Card;
}
