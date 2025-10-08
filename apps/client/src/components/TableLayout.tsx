import { useMemo } from 'react';
import type { Card, MatchSnapshot, PlayerId, TeamId } from '@hooker/shared';
import { TEAMS } from '@hooker/shared';
import Hand from './Hand';
import Scoreboard from './Scoreboard';
import Seat from './Seat';
import TrickArea from './TrickArea';
import TrumpBadge from './TrumpBadge';
import { suitFull } from '../utils/cardAssets';

interface TableLayoutProps {
  snapshot: MatchSnapshot;
  playerId: PlayerId;
  displayName: string;
  nameForSeat: (seat: PlayerId) => string;
  onPlay: (card: Card) => void;
  onDiscard: (card: Card) => void;
}

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const;

function rotate<T>(values: T[], startIndex: number) {
  if (startIndex <= 0) return values.slice();
  return [...values.slice(startIndex), ...values.slice(0, startIndex)];
}

function getActiveSeat(snapshot: MatchSnapshot): PlayerId | null {
  switch (snapshot.phase) {
    case 'KittyDecision':
      return snapshot.kittyOfferee ?? null;
    case 'Discard':
      return snapshot.acceptor ?? null;
    case 'TrumpDeclaration':
      return snapshot.dealer;
    case 'TrickPlay': {
      if (!snapshot.currentTrick) return null;
      const { currentTrick, seating } = snapshot;
      const leaderIndex = seating.indexOf(currentTrick.leader);
      const turnIndex = (leaderIndex + currentTrick.cards.length) % seating.length;
      return seating[turnIndex];
    }
    default:
      return null;
  }
}

function teamForSeat(assignments: MatchSnapshot['teamAssignments'], seat: PlayerId): TeamId {
  return assignments.NorthSouth.includes(seat) ? 'NorthSouth' : 'EastWest';
}

export function TableLayout({
  snapshot,
  playerId,
  displayName,
  nameForSeat,
  onPlay,
  onDiscard,
}: TableLayoutProps) {
  const activeSeat = useMemo(() => getActiveSeat(snapshot), [snapshot]);

  const seatingOrder = useMemo(() => {
    const index = snapshot.seating.indexOf(playerId);
    return rotate(snapshot.seating, Math.max(0, index));
  }, [snapshot.seating, playerId]);

  const legalKeys = useMemo(() => {
    return new Set(snapshot.legalCards.map((card) => `${card.rank}-${card.suit}`));
  }, [snapshot.legalCards]);

  const handActionable = useMemo(() => {
    if (activeSeat !== playerId) return false;
    return snapshot.phase === 'Discard' || snapshot.phase === 'TrickPlay';
  }, [activeSeat, playerId, snapshot.phase]);

  const trickCounts = useMemo(() => {
    const counts: Record<TeamId, number> = { NorthSouth: 0, EastWest: 0 };
    for (const trick of snapshot.completedTricks) {
      if (!trick.winner) continue;
      const team = teamForSeat(snapshot.teamAssignments, trick.winner);
      counts[team] += 1;
    }
    return counts;
  }, [snapshot.completedTricks, snapshot.teamAssignments]);

  const scoreboardTeams = useMemo(() => {
    return TEAMS.map((teamId) => {
      const members = snapshot.teamAssignments[teamId].map((seat) => nameForSeat(seat));
      const label = teamId === 'NorthSouth' ? 'North / South' : 'East / West';
      return {
        id: teamId,
        label,
        members,
        handTricks: trickCounts[teamId],
      };
    });
  }, [nameForSeat, snapshot.teamAssignments, trickCounts]);

  const dealerName = nameForSeat(snapshot.dealer);
  const activeSeatName = activeSeat ? nameForSeat(activeSeat) : null;

  return (
    <div className="table-layout" aria-label="Card table layout">
      <aside className="table-layout-sidebar">
        <Scoreboard
          scores={snapshot.scores}
          teams={scoreboardTeams}
          dealer={snapshot.dealer}
          dealerName={dealerName}
          trickIndex={snapshot.completedTricks.length}
          lastHandSummary={snapshot.lastHandSummary}
        />
      </aside>
      <div className="table-layout-stage felt-bg" role="application" aria-label="Active table">
        <div className="table-status-bar">
          <div className="table-status-phase">Phase: {snapshot.phase}</div>
          <div className="table-status-turn" role="status" aria-live="polite">
            {activeSeat
              ? activeSeat === playerId
                ? 'Your turn'
                : `${activeSeatName}'s turn`
              : 'Waiting'}
          </div>
          {snapshot.trump ? (
            <TrumpBadge suit={snapshot.trump} />
          ) : (
            <span className="trump-badge trump-badge-none" role="status" aria-label="No trump selected">
              No trump
            </span>
          )}
        </div>

        <div className="table-stage-grid">
          {seatingOrder.map((seat, index) => {
            const position = POSITIONS[index] ?? 'top';
            const isSelf = seat === playerId;
            const seatName = isSelf ? displayName : nameForSeat(seat);
            const cardsRemaining = isSelf
              ? snapshot.selfHand.length
              : snapshot.otherHandCounts[seat] ?? 0;

            return (
              <div key={seat} className={`table-seat table-seat-${position}`}>
                <Seat
                  seat={seat}
                  name={seatName}
                  isSelf={isSelf}
                  isDealer={snapshot.dealer === seat}
                  isActive={activeSeat === seat}
                  cardsRemaining={cardsRemaining}
                >
                  {isSelf ? (
                    <Hand
                      cards={snapshot.selfHand}
                      legalKeys={legalKeys}
                      actionable={handActionable}
                      phase={snapshot.phase}
                      onDiscard={onDiscard}
                      onPlay={onPlay}
                    />
                  ) : (
                    <div className="seat-card-backs" aria-hidden="true">
                      <span className="seat-card-count">{cardsRemaining}</span>
                      <span className="seat-card-label">cards</span>
                    </div>
                  )}
                </Seat>
              </div>
            );
          })}

          <div className="table-trick">
            <TrickArea
              trick={snapshot.currentTrick}
              nameForSeat={nameForSeat}
              trump={snapshot.trump}
              seatingOrder={seatingOrder}
            />
          </div>
        </div>

        <div className="table-aux-info">
          <div className="table-aux-item" role="status" aria-live="polite">
            Kitty top card:{' '}
            {snapshot.kittyTopCard
              ? `${snapshot.kittyTopCard.rank} of ${suitFull(snapshot.kittyTopCard.suit)}`
              : 'Hidden'}
          </div>
          <div className="table-aux-item">Kitty size: {snapshot.kittySize}</div>
        </div>
      </div>
    </div>
  );
}

export default TableLayout;
