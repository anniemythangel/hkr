import { useEffect, useMemo, useRef, useState } from 'react'
import type { AceDrawEvent, PlayerId } from '@hooker/shared'
import { cardAssetUrl, suitFull } from '../utils/cardAssets'

interface AceDrawAnimationProps {
  draw: AceDrawEvent
  seatingOrder: PlayerId[]
  nameForSeat: (seat: PlayerId) => string
  onComplete?: () => void
}

const POSITIONS = ['bottom', 'left', 'top', 'right'] as const
const RANK_LABEL: Record<AceDrawEvent['draws'][number]['card']['rank'], string> = {
  A: 'Ace',
  K: 'King',
  Q: 'Queen',
  J: 'Jack',
  '10': '10',
  '9': '9',
}

export function AceDrawAnimation({ draw, seatingOrder, nameForSeat, onComplete }: AceDrawAnimationProps) {
  const [revealedCount, setRevealedCount] = useState(0)
  const completionAnnounced = useRef(false)
  const loggedCount = useRef(0)

  const revealedDraws = useMemo(() => draw.draws.slice(0, revealedCount), [draw.draws, revealedCount])
  const latestDraw = revealedDraws[revealedDraws.length - 1] ?? null
  const latestSeat = latestDraw?.player ?? null
  const aceDrawn = revealedCount >= draw.draws.length && draw.draws.length > 0
  const finalDraw = draw.draws[draw.draws.length - 1] ?? null

  const cardsBySeat = useMemo(() => {
    const map = new Map<PlayerId, AceDrawEvent['draws'][number]>()
    for (const entry of revealedDraws) {
      map.set(entry.player, entry)
    }
    return map
  }, [revealedDraws])

  useEffect(() => {
    setRevealedCount(0)
    completionAnnounced.current = false
    loggedCount.current = 0
  }, [draw.gameIndex])

  useEffect(() => {
    if (revealedCount >= draw.draws.length) return
    const timeout = setTimeout(() => {
      setRevealedCount((count) => count + 1)
    }, 500)
    return () => clearTimeout(timeout)
  }, [revealedCount, draw.draws.length])

  useEffect(() => {
    if (revealedCount < draw.draws.length) return
    if (draw.draws.length === 0) return
    if (completionAnnounced.current) return
    completionAnnounced.current = true
    const timeout = setTimeout(() => {
      onComplete?.()
    }, 2000)
    return () => clearTimeout(timeout)
  }, [revealedCount, draw.draws.length, onComplete])

  useEffect(() => {
    const newCount = revealedDraws.length
    if (newCount <= loggedCount.current) return
    const newEntries = revealedDraws.slice(loggedCount.current)
    for (const entry of newEntries) {
      const playerName = nameForSeat(entry.player)
      const rankLabel = RANK_LABEL[entry.card.rank] ?? entry.card.rank
      const suitLabel = suitFull(entry.card.suit)
      if (entry.card.rank === 'A' && entry.player === draw.dealer) {
        console.info(`${playerName} drew ${rankLabel} of ${suitLabel} and they are the dealer.`)
      } else {
        console.info(`${playerName} drew ${rankLabel} of ${suitLabel}`)
      }
    }
    loggedCount.current = newCount
  }, [draw.dealer, nameForSeat, revealedDraws])

  const message = useMemo(() => {
    if (!revealedDraws.length) {
      return 'Drawing cards to determine the dealer'
    }
    if (!aceDrawn || !finalDraw) {
      const { player, card } = revealedDraws[revealedDraws.length - 1]
      return `${nameForSeat(player)} drew the ${card.rank} of ${suitFull(card.suit)}`
    }
    const dealerName = nameForSeat(draw.dealer)
    return `${dealerName} will deal after drawing the ${finalDraw.card.rank} of ${suitFull(finalDraw.card.suit)}`
  }, [aceDrawn, finalDraw, nameForSeat, revealedDraws, draw.dealer])

  return (
    <section className="ace-draw" aria-label="Determining dealer" role="region">
      <header className="ace-draw-header">
        <h3 className="ace-draw-title">Determining dealer</h3>
        <p className="ace-draw-message" role="status" aria-live="polite">
          {message}
        </p>
      </header>
      <div className="trick-ring" role="list">
        {seatingOrder.map((seat, index) => {
          const entry = cardsBySeat.get(seat)
          const position = POSITIONS[index] ?? 'top'
          const occupied = Boolean(entry)
          const isLatest = latestSeat === seat
          const isAce = entry?.card.rank === 'A'
          const seatName = nameForSeat(seat)
          const cardLabel = entry ? `${entry.card.rank} of ${suitFull(entry.card.suit)}` : ''
          return (
            <div
              key={seat}
              className={`trick-ring-slot trick-ring-slot-${position}${
                occupied ? ' trick-ring-slot-filled' : ''
              }${isLatest ? ' ace-draw-slot-latest' : ''}${isAce ? ' ace-draw-slot-ace' : ''}`}
              role={occupied ? 'listitem' : undefined}
              aria-label={occupied ? `${seatName} drew ${cardLabel}` : `${seatName} has not drawn yet`}
            >
              <span className="trick-slot-name" aria-hidden="true">
                {seatName}
              </span>
              {entry ? (
                <div className="trick-card" data-seat={seat}>
                  <img
                    src={cardAssetUrl(entry.card)}
                    alt=""
                    className={`card-img trick-card-img${isLatest ? ' ace-draw-card-latest' : ''}${
                      isAce ? ' ace-draw-card-ace' : ''
                    }`}
                    draggable={false}
                  />
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default AceDrawAnimation
