import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@hooker/shared';
import { scoreHand } from '../src/scoring';

const TEAM_BY_PLAYER: Record<PlayerId, 'NorthSouth' | 'EastWest'> = {
  A: 'NorthSouth',
  C: 'NorthSouth',
  B: 'EastWest',
  D: 'EastWest',
};

const trick = (winner: PlayerId) => ({ winner });

describe('scoreHand', () => {
  it('awards euchre points to the defending team and flags the caller as euchred', () => {
    const summary = scoreHand(
      [trick('B'), trick('D'), trick('B'), trick('A'), trick('C')],
      TEAM_BY_PLAYER,
      'A',
    );

    expect(summary).toMatchObject({
      winningTeam: 'EastWest',
      points: 2,
      euchred: true,
    });
  });

  it('awards a single point when the calling team wins a standard hand', () => {
    const summary = scoreHand(
      [trick('A'), trick('B'), trick('A'), trick('C'), trick('D')],
      TEAM_BY_PLAYER,
      'A',
    );

    expect(summary).toMatchObject({
      winningTeam: 'NorthSouth',
      points: 1,
      euchred: false,
    });
  });
});
