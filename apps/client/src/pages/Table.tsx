import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import TableLayout from '../components/TableLayout'
import ConsolePanel from '../components/ConsolePanel'
import ChatBox from '../components/ChatBox'
import { Suit, Card, PlayerId } from '@hooker/shared'

export default function TablePage() {
  const { roomId: routeRoom } = useParams()
  const {
    status, snapshot, error, logs, chatMessages,
    connect, emitAction, sendChat, token, defaultServer, roster
  } = useSocket(import.meta.env.VITE_WS_URL ?? 'http://localhost:3001')
  const nav = useNavigate()
  const displayName = token?.name ?? 'Player'

  useEffect(() => {
    if (!token) {
      nav('/', { replace: true })
      return
    }
    if (routeRoom && decodeURIComponent(routeRoom) !== token.roomId) {
      nav(`/room/${encodeURIComponent(token.roomId)}`, { replace: true })
      return
    }
    if (status === 'disconnected') {
      connect({
        serverUrl: token.serverUrl || defaultServer,
        roomId: token.roomId,
        seat: token.seat,
        name: token.name,
      })
    }
  }, [token, status, connect, defaultServer, nav, routeRoom])

  const legalKeys = useMemo(
    () => new Set(snapshot?.legalCards.map((c) => `${c.rank}-${c.suit}`) ?? []),
    [snapshot?.legalCards],
  )
  const mySeat: PlayerId | undefined = token?.seat
  const nameForSeat = useMemo(
    () => (seat: PlayerId) => roster?.[seat]?.name?.trim() || `Player ${seat}`,
    [roster],
  )

  const emit = (event: string, payload: unknown) => emitAction(event, payload)
  const handleKittyDecision = (accept:boolean)=>emit('kittyDecision',{accept})
  const handleDiscard = (card:Card)=>emit('discard',{card})
  const handleDeclareTrump = (suit:Suit)=>emit('declareTrump',{suit})
  const handlePlayCard = (card:Card)=>emit('playCard',{card})

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1 className="title">Hooker Engine Demo</h1>
          <p className="subtitle">Friendlier MVP preview</p>
        </div>
        <div className="status-chip" role="status">Status: {status}</div>
      </header>

      <main className="app-grid">
        <div className="table-area">
          {error ? <div className="error" role="alert">{error}</div> : null}
          {snapshot && mySeat ? (
            <section className="panel table-panel" aria-live="polite">
              <TableLayout
                snapshot={snapshot}
                playerId={mySeat}
                displayName={displayName}
                nameForSeat={nameForSeat}
                legalKeys={legalKeys}
                onKitty={handleKittyDecision}
                onDiscard={handleDiscard}
                onPlay={handlePlayCard}
                onDeclareTrump={handleDeclareTrump}
              />
            </section>
          ) : (
            <section className="panel placeholder-panel"><p>Reconnecting…</p></section>
          )}
        </div>

        <aside className="side-panel">
          <ConsolePanel entries={logs} />
          <ChatBox messages={chatMessages} onSend={sendChat} disabled={status!=='connected'} name={displayName} />
        </aside>
      </main>
    </div>
  )
}
