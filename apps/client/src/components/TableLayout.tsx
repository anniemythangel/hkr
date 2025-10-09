import { useMemo } from 'react'
import type { Card, MatchSnapshot, PlayerId, Suit, TeamId } from '@hooker/shared'
import { TEAMS } from '@hooker/shared'
import Hand from './Hand'
import Scoreboard from './Scoreboard'
import Seat from './Seat'
import TrickArea from './TrickArea'
import TrumpBadge from './TrumpBadge'
import KittyTop from './KittyTop'
import TrickHistory from './TrickHistory'

interface TableLayoutProps {
  snapshot: MatchSnapshot
  playerId: PlayerId
  displayName: string
  nameForSeat: (seat: PlayerId) => string
  legalKeys: Set<string>
  onKitty: (accept: boolean) => void
  onDiscard: (card: Card) => void
  onPlay: (card: Card) => void
  onDeclareTrump: (suit: Suit) => void
}

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const
const SUIT_LABEL: Record<Suit, string> = {
  clubs: 'Clubs ♣',
  diamonds: 'Diamonds ♦',
  hearts: 'Hearts ♥',
  spades: 'Spades ♠',
}

function rotate<T>(values: T[], startIndex: number) {
  if (startIndex <= 0) return values.slice()
  return [...values.slice(startIndex), ...values.slice(0, startIndex)]
}

function getActiveSeat(snapshot: MatchSnapshot): PlayerId | null {
  switch (snapshot.phase) {
    case 'KittyDecision':
      return snapshot.kittyOfferee ?? null
    case 'Discard':
      return snapshot.acceptor ?? null
    case 'TrumpDeclaration':
      return snapshot.dealer
    case 'TrickPlay': {
      if (!snapshot.currentTrick) return null
      const { currentTrick, seating } = snapshot
      const leaderIndex = seating.indexOf(currentTrick.leader)
      const turnIndex = (leaderIndex + currentTrick.cards.length) % seating.length
      return seating[turnIndex]
    }
    default:
      return null
  }
}

function teamForSeat(assignments: MatchSnapshot['teamAssignments'], seat: PlayerId): TeamId {
  return assignments.NorthSouth.includes(seat) ? 'NorthSouth' : 'EastWest'
}

export function TableLayout({
  snapshot,
  playerId,
  displayName,
  nameForSeat,
  legalKeys,
  onKitty,
  onDiscard,
  onPlay,
  onDeclareTrump,
}: TableLayoutProps) {
  const activeSeat = useMemo(() => getActiveSeat(snapshot), [snapshot])

  const seatingOrder = useMemo(() => {
    const index = snapshot.seating.indexOf(playerId)
    return rotate(snapshot.seating, Math.max(0, index))
  }, [snapshot.seating, playerId])

  const handActionable = useMemo(() => {
    if (activeSeat !== playerId) return false
    return snapshot.phase === 'Discard' || snapshot.phase === 'TrickPlay'
  }, [activeSeat, playerId, snapshot.phase])

  const trickCounts = useMemo(() => {
    const counts: Record<TeamId, number> = { NorthSouth: 0, EastWest: 0 }
    for (const trick of snapshot.completedTricks) {
      if (!trick.winner) continue
      const team = teamForSeat(snapshot.teamAssignments, trick.winner)
      counts[team] += 1
    }
    return counts
  }, [snapshot.completedTricks, snapshot.teamAssignments])

  const scoreboardTeams = useMemo(() => {
    return TEAMS.map((teamId) => {
      const members = snapshot.teamAssignments[teamId].map((seat) => nameForSeat(seat))
      const label = teamId === 'NorthSouth' ? 'North / South' : 'East / West'
      return {
        id: teamId,
        label,
        members,
        handTricks: trickCounts[teamId],
      }
    })
  }, [nameForSeat, snapshot.teamAssignments, trickCounts])

  const dealerName = nameForSeat(snapshot.dealer)
  const activeSeatName = activeSeat ? nameForSeat(activeSeat) : null
  const canAcceptKitty = snapshot.phase === 'KittyDecision' && snapshot.kittyOfferee === playerId
  const kittyPassDisabled = snapshot.forcedAccept && snapshot.kittyOfferee === snapshot.acceptor
  const canDeclareTrump = snapshot.phase === 'TrumpDeclaration' && snapshot.dealer === playerId
  const canDiscard = snapshot.phase === 'Discard' && snapshot.acceptor === playerId
  const showActionRow = canAcceptKitty || canDeclareTrump || canDiscard

  return (
    <div className="table-layout" aria-label="Card table layout">
      <div className="table-layout-stage felt-bg" role="application" aria-label="Active table">
        <div className="table-layout-top">
          <Scoreboard
            scores={snapshot.scores}
            teams={scoreboardTeams}
            dealer={snapshot.dealer}
            dealerName={dealerName}
            trickIndex={snapshot.completedTricks.length}
            lastHandSummary={snapshot.lastHandSummary}
          />
          <div className="table-top-side">
            <section className="table-status-panel" aria-label="Table status">
              <div className="table-status-header">
                <h2 className="table-status-title">Round status</h2>
                <div className="table-status-turn" role="status" aria-live="polite">
                  {activeSeat
                    ? activeSeat === playerId
                      ? 'Your turn'
                      : `${activeSeatName}'s turn`
                    : 'Waiting'}
                </div>
              </div>
              <div className="table-status-tags">
                <span className="table-status-chip">Phase: {snapshot.phase}</span>
                {snapshot.trump ? (
                  <TrumpBadge suit={snapshot.trump} />
                ) : (
                  <span className="trump-badge trump-badge-none" role="status" aria-label="No trump selected">
                    No trump
                  </span>
                )}
              </div>
              <div className="table-aux-info">
                <KittyTop card={snapshot.kittyTopCard ?? null} />
                <div className="table-aux-item">
                  <span className="table-aux-label">Kitty size</span>
                  <span className="table-aux-value">{snapshot.kittySize}</span>
                </div>
              </div>
            </section>
            <TrickHistory
              tricks={snapshot.completedTricks}
              seatingOrder={seatingOrder}
              nameForSeat={nameForSeat}
            />
          </div>
        </div>

        <div className="table-ring">
          <div className="table-ring-grid">
            <div className="table-ring-center">
              <div className="table-ring-surface">
                <div className="table-trick">
                  <TrickArea
                    trick={snapshot.currentTrick}
                    nameForSeat={nameForSeat}
                    trump={snapshot.trump}
                    seatingOrder={seatingOrder}
                  />
                </div>
              </div>
            </div>

            {seatingOrder.map((seat, index) => {
              const position = POSITIONS[index] ?? 'top'
              const isSelf = seat === playerId
              const seatName = isSelf ? displayName : nameForSeat(seat)
              const cardsRemaining = isSelf
                ? snapshot.selfHand.length
                : snapshot.otherHandCounts[seat] ?? 0

              return (
                <div key={seat} className={`table-seat table-seat-${position}`}>
                  <Seat
                    seat={seat}
                    name={seatName}
                    isSelf={isSelf}
                    isDealer={snapshot.dealer === seat}
                    isActive={activeSeat === seat}
                    cardsRemaining={cardsRemaining}
                    renderBodyWhenEmpty={!isSelf}
                  >
                    {isSelf ? null : (
                      <div className="seat-card-backs" aria-hidden="true">
                        <span className="seat-card-count">{cardsRemaining}</span>
                        <span className="seat-card-label">cards</span>
                      </div>
                    )}
                  </Seat>
                </div>
              )
            })}
          </div>
        </div>

        <div className="player-hand-rail">
          <Hand
            cards={snapshot.selfHand}
            legalKeys={legalKeys}
            actionable={handActionable}
            phase={snapshot.phase}
            onDiscard={onDiscard}
            onPlay={onPlay}
          />
        </div>

        {showActionRow ? (
          <div className="action-row" role="group" aria-label="Table actions">
            {canAcceptKitty ? (
              <>
                <button type="button" onClick={() => onKitty(true)}>
                  Accept kitty
                </button>
                <button type="button" onClick={() => onKitty(false)} disabled={kittyPassDisabled}>
                  Pass
                </button>
              </>
            ) : null}

            {canDeclareTrump ? (
              <div className="trump-actions" role="group" aria-label="Declare trump">
                {(Object.keys(SUIT_LABEL) as Suit[]).map((suit) => (
                  <button key={suit} type="button" onClick={() => onDeclareTrump(suit)}>
                    Declare {SUIT_LABEL[suit]}
                  </button>
                ))}
              </div>
            ) : null}

            {canDiscard ? <span className="subtle">Select a card above to discard.</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default TableLayout
