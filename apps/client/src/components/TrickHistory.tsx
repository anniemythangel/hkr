import type { PlayerId, Trick } from '@hooker/shared'
import { suitFull } from '../utils/cardAssets'

interface TrickHistoryProps {
  tricks: Trick[]
  seatingOrder: PlayerId[]
  nameForSeat: (seat: PlayerId) => string
}

const SUIT_SYMBOL: Record<Trick['cards'][number]['card']['suit'], string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
}

const RANK_SYMBOL: Record<Trick['cards'][number]['card']['rank'], string> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  '10': 'T',
  '9': '9',
}

const RECENT_LIMIT = 8

function cardAbbrev(card: Trick['cards'][number]['card']) {
  return `${RANK_SYMBOL[card.rank]}${SUIT_SYMBOL[card.suit]}`
}

export function TrickHistory({ tricks, seatingOrder, nameForSeat }: TrickHistoryProps) {
  if (!tricks.length) {
    return (
      <section className="trick-history-panel" aria-label="Trick history">
        <header className="trick-history-header">
          <h2 className="trick-history-title">Trick history</h2>
          <p className="trick-history-subtle">No tricks completed yet</p>
        </header>
      </section>
    )
  }

  const seatDetails = seatingOrder.map((seat) => ({ seat, name: nameForSeat(seat) }))
  
  const recentTricks = tricks.slice(-RECENT_LIMIT)

  return (
    <section className="trick-history-panel" aria-label="Trick history">
      <header className="trick-history-header">
        <h2 className="trick-history-title">Trick history</h2>
        <p className="trick-history-subtle">Latest {recentTricks.length} trick{recentTricks.length === 1 ? '' : 's'}</p>
      </header>
      <div className="trick-history-grid" role="table" aria-label="Completed tricks by player">
        <div className="trick-history-head" role="rowgroup">
          {seatDetails.map(({ seat, name }) => (
            <span key={seat} role="columnheader" className="trick-history-player" aria-label={name}>
              {name}
            </span>
          ))}
        </div>
        <div className="trick-history-body" role="rowgroup">
          {recentTricks.map((trick, index) => {
            const trickNumber = tricks.length - recentTricks.length + index + 1
            return (
              <div key={trickNumber} className="trick-history-row" role="row" aria-label={`Trick ${trickNumber}`}>
                {seatDetails.map(({ seat, name }) => {
                  const play = trick.cards.find((card) => card.player === seat)
                  const winner = trick.winner === seat
                  return (
                    <span
                      key={seat}
                      role="cell"
                      className={`trick-history-card${winner ? ' trick-history-card-winner' : ''}`}
                      aria-label={
                        play
                          ? `${name} played ${play.card.rank} of ${suitFull(play.card.suit)}` +
                            (winner ? ' and won the trick' : '')
                          : `${name} did not play`
                      }
                    >
                      {play ? cardAbbrev(play.card) : '—'}
                    </span>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default TrickHistory
