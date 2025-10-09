import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import type { Card, MatchSnapshot, PlayerId, Suit, TeamId } from '@hooker/shared'
import { GAME_ROTATION, PLAYERS, TEAMS } from '@hooker/shared'
import Hand from './Hand'
import Seat from './Seat'
import TrickArea from './TrickArea'
import TrumpBadge from './TrumpBadge'
import KittyTop from './KittyTop'
import AceDrawAnimation from './AceDrawAnimation'

interface TableLayoutProps {
  snapshot: MatchSnapshot
  playerId: PlayerId
  displayName: string
  nameForSeat: (seat: PlayerId) => string
  legalKeys: Set<string>
  seatingOrder: PlayerId[]
  onKitty: (accept: boolean) => void
  onDiscard: (card: Card) => void
  onPlay: (card: Card) => void
  onDeclareTrump: (suit: Suit) => void
  scoreboard: ReactNode
  consolePanel: ReactNode
  chatBox: ReactNode
  trickHistory: ReactNode
}

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const
const SUIT_LABEL: Record<Suit, string> = {
  clubs: 'Clubs ♣',
  diamonds: 'Diamonds ♦',
  hearts: 'Hearts ♥',
  spades: 'Spades ♠',
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

export function TableLayout({
  snapshot,
  playerId,
  displayName,
  nameForSeat,
  legalKeys,
  seatingOrder,
  onKitty,
  onDiscard,
  onPlay,
  onDeclareTrump,
  scoreboard,
  consolePanel,
  chatBox,
  trickHistory,
}: TableLayoutProps) {
  const [completedAceDraws, setCompletedAceDraws] = useState<Record<number, boolean>>({})
  const activeSeat = useMemo(() => getActiveSeat(snapshot), [snapshot])
  const celebration = useMemo(() => {
    if (snapshot.phase !== 'MatchOver') return null
    const totalGames = GAME_ROTATION.length
    const wins = snapshot.playerGameWins
    const talson = PLAYERS.find((player) => wins[player] === totalGames)
    if (talson) {
      return { type: 'Talson' as const, player: talson }
    }
    const usha = PLAYERS.find((player) => wins[player] === 0)
    if (usha) {
      return { type: 'Usha' as const, player: usha }
    }
    return null
  }, [snapshot])

  const celebrationName = useMemo(() => {
    if (!celebration) return null
    if (celebration.player === playerId) return displayName
    return nameForSeat(celebration.player)
  }, [celebration, displayName, nameForSeat, playerId])

  const celebrationAudioSrc = useMemo(() => {
    if (!celebration) return null
    return celebration.type === 'Talson'
      ? '/audio/talson_recording.mp3'
      : '/audio/usha_recording.wav'
  }, [celebration])

  useEffect(() => {
    if (!celebrationAudioSrc) return undefined
    const audio = new Audio(celebrationAudioSrc)
    audio.play().catch(() => {})
    return () => {
      audio.pause()
    }
  }, [celebrationAudioSrc])

  const orderedSeats = useMemo(() => {
    if (seatingOrder.length) return seatingOrder
    return snapshot.seating.slice()
  }, [seatingOrder, snapshot.seating])

  const activeAceDraw = snapshot.aceDraw
  const showAceDraw = Boolean(activeAceDraw && !completedAceDraws[activeAceDraw.gameIndex])
  const dealerRevealed = !showAceDraw
  const showKittyInfo = snapshot.kittySize > 0 || snapshot.phase === 'KittyDecision'

  const markAceDrawComplete = useCallback((gameIndex: number) => {
    setCompletedAceDraws((previous) => {
      if (previous[gameIndex]) return previous
      return { ...previous, [gameIndex]: true }
    })
  }, [])

  const handActionable = useMemo(() => {
    if (activeSeat !== playerId) return false
    return snapshot.phase === 'Discard' || snapshot.phase === 'TrickPlay'
  }, [activeSeat, playerId, snapshot.phase])

  const dealerName = nameForSeat(snapshot.dealer)
  const activeSeatName = activeSeat ? nameForSeat(activeSeat) : null
  const canAcceptKitty = snapshot.phase === 'KittyDecision' && snapshot.kittyOfferee === playerId
  const kittyPassDisabled = snapshot.forcedAccept && snapshot.kittyOfferee === snapshot.acceptor
  const canDeclareTrump = snapshot.phase === 'TrumpDeclaration' && snapshot.dealer === playerId
  const canDiscard = snapshot.phase === 'Discard' && snapshot.acceptor === playerId
  const showActionRow = canAcceptKitty || canDeclareTrump || canDiscard
  const kittyCountCaption =
    snapshot.kittySize === 0
      ? 'Kitty empty'
      : `${snapshot.kittySize} card${snapshot.kittySize === 1 ? '' : 's'} in kitty`
  const kittySummaryLabel =
    snapshot.kittySize === 0
      ? 'Kitty summary: kitty empty'
      : `Kitty summary: ${snapshot.kittySize} card${snapshot.kittySize === 1 ? '' : 's'} in kitty`

  return (
    <div className="table-layout" aria-label="Card table layout">
      <div className="table-layout-stage felt-bg" role="application" aria-label="Active table">
        {celebration && celebrationName ? (
          <div
            className={`match-result-banner match-result-banner--${celebration.type.toLowerCase()}`}
            role="status"
            aria-live="assertive"
          >
            <div className="match-result-banner-celebration" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
            <div className="match-result-banner-header">
              <span className="match-result-label">{celebration.type}</span>
              <span className="match-result-icon" aria-hidden="true">
                {celebration.type === 'Talson' ? '🎉' : '💩'}
              </span>
            </div>
            <span className="match-result-name">{celebrationName}</span>
            <span className="match-result-subtitle">
              {celebration.type === 'Talson'
                ? 'swept the rotation with flawless victory'
                : 'endured every battle and will rise again'}
            </span>
          </div>
        ) : null}
        <div className="table-ring">
          <div className="table-ring-grid">
            {scoreboard ? (
              <div className="table-stage-panel table-stage-panel-top-left" role="complementary">
                {scoreboard}
              </div>
            ) : null}

            {trickHistory ? (
              <div className="table-stage-panel table-stage-panel-bottom-left" role="complementary">
                {trickHistory}
              </div>
            ) : null}

            {consolePanel ? (
              <div className="table-stage-panel table-stage-panel-top-right" role="complementary">
                {consolePanel}
              </div>
            ) : null}

            {chatBox ? (
              <div className="table-stage-panel table-stage-panel-bottom-right" role="complementary">
                {chatBox}
              </div>
            ) : null}

            <div className="table-ring-center">
              <div className="table-ring-surface">
                <div className="table-trick">
                  {showAceDraw && activeAceDraw ? (
                    <AceDrawAnimation
                      draw={activeAceDraw}
                      nameForSeat={nameForSeat}
                      seatingOrder={orderedSeats}
                      onComplete={() => markAceDrawComplete(activeAceDraw.gameIndex)}
                    />
                  ) : (
                    <TrickArea
                      trick={snapshot.currentTrick}
                      nameForSeat={nameForSeat}
                      trump={snapshot.trump}
                      seatingOrder={orderedSeats}
                    />
                  )}
                </div>
              </div>
            </div>

            {orderedSeats.map((seat, index) => {
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
                    isDealer={dealerRevealed && snapshot.dealer === seat}
                    isActive={dealerRevealed && activeSeat === seat}
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
          <div className="player-hand-wrap">
            <Hand
              cards={snapshot.selfHand}
              legalKeys={legalKeys}
              actionable={handActionable}
              phase={snapshot.phase}
              onDiscard={onDiscard}
              onPlay={onPlay}
            />
          </div>
          {showKittyInfo ? (
            <div className="kitty-top-pocket" aria-label={kittySummaryLabel}>
              <KittyTop card={snapshot.kittyTopCard ?? null} />
              <span className="kitty-top-caption subtle">{kittyCountCaption}</span>
            </div>
          ) : null}
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
