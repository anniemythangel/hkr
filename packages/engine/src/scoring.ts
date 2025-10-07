import { HandScoreSummary, PlayerId, TeamId } from '@hooker/shared';

export function scoreHand(
  tricks: { winner?: PlayerId }[],
  teamByPlayer: Record<PlayerId, TeamId>,
  dealer: PlayerId,
): HandScoreSummary {
  const trickCounts: Record<TeamId, number> = {
    NorthSouth: 0,
    EastWest: 0,
  };

  for (const trick of tricks) {
    if (!trick.winner) {
      throw new Error('Cannot score trick without winner');
    }
    const team = teamByPlayer[trick.winner];
    trickCounts[team] += 1;
  }

  const winningTeam: TeamId =
    trickCounts.NorthSouth > trickCounts.EastWest ? 'NorthSouth' : 'EastWest';

  const tricksWon = trickCounts[winningTeam];
  const points = tricksWon === 5 ? 3 : tricksWon === 4 ? 2 : 1;
  const dealerTeam = teamByPlayer[dealer];
  const euchred = trickCounts[dealerTeam] < 3;

  return {
    winningTeam,
    points,
    euchred,
    tricksWon: trickCounts,
  };
}
