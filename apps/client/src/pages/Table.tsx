import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import TableLayout from '../components/TableLayout'
import ConsolePanel from '../components/ConsolePanel'
import ChatBox from '../components/ChatBox'
import TrickHistory from '../components/TrickHistory'
import Scoreboard from '../components/Scoreboard'
import { Suit, Card, PlayerId, TEAMS, GAME_ROTATION } from '@hooker/shared'

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

  const seatingOrder = useMemo(() => {
    const seats = snapshot?.seating ?? []
    if (!seats.length) return []
    if (mySeat == null) return seats.slice()
    const index = seats.indexOf(mySeat)
    if (index <= 0) return seats.slice()
    return [...seats.slice(index), ...seats.slice(0, index)]
  }, [snapshot, mySeat])

  const trickCounts = useMemo(() => {
    if (!snapshot) return { NorthSouth: 0, EastWest: 0 };
    const counts = { NorthSouth: 0, EastWest: 0 };
    for (const trick of snapshot.completedTricks) {
      if (!trick.winner) continue;
      const team = snapshot.teamAssignments.NorthSouth.includes(trick.winner) ? 'NorthSouth' : 'EastWest';
      counts[team] += 1;
    }
    return counts;
  }, [snapshot]);

  const scoreboardTeams = useMemo(() => {
    if (!snapshot) return [];
    return TEAMS.map((teamId) => {
      const label = teamId === 'NorthSouth' ? 'North / South' : 'East / West';
      const members = snapshot.teamAssignments[teamId].map((seat) => ({
        id: seat,
        name: nameForSeat(seat),
      }));
      return {
        id: teamId,
        label,
        members,
        handTricks: trickCounts[teamId],
      };
    });
  }, [snapshot, nameForSeat, trickCounts]);

  const playerNames = useMemo(() => {
    const mapping = { A: 'A', B: 'B', C: 'C', D: 'D' } as Record<PlayerId, string>;
    (['A', 'B', 'C', 'D'] as PlayerId[]).forEach((seat) => {
      mapping[seat] = nameForSeat(seat);
    });
    return mapping;
  }, [nameForSeat]);

  const matchRotation = useMemo(() => {
    return GAME_ROTATION.map((config, index) => {
      const result = snapshot?.gameResults.find((entry) => entry.gameIndex === index);
      const teams = result?.teams ?? config.teams;
      const seating = result?.seating ?? config.seating;
      return {
        gameIndex: index,
        seating,
        teams: TEAMS.map((teamId) => ({
          id: teamId,
          label: teamId === 'NorthSouth' ? 'North / South' : 'East / West',
          members: teams[teamId].map((seat) => ({
            id: seat,
            name: nameForSeat(seat),
          })),
        })),
      };
    });
  }, [nameForSeat, snapshot?.gameResults]);

  return (
    <div className="page">
      <header className="header">
        <div>
          <h1 className="title">Hooker Engine Demo</h1>
          <p className="subtitle">Friendlier MVP preview</p>
        </div>
        <div className="status-chip" role="status">Status: {status}</div>
      </header>

      <main>
        {error ? <div className="error" role="alert">{error}</div> : null}
        {snapshot && mySeat ? (
          <>
            <TableLayout
              snapshot={snapshot}
              playerId={mySeat}
              displayName={displayName}
              nameForSeat={nameForSeat}
              legalKeys={legalKeys}
              seatingOrder={seatingOrder}
              onKitty={handleKittyDecision}
              onDiscard={handleDiscard}
              onPlay={handlePlayCard}
              onDeclareTrump={handleDeclareTrump}
              scoreboard={
                <Scoreboard
                  scores={snapshot.scores}
                  teams={scoreboardTeams}
                  dealer={snapshot.dealer}
                  dealerName={nameForSeat(snapshot.dealer)}
                  trickIndex={snapshot.completedTricks.length}
                  lastHandSummary={snapshot.lastHandSummary}
                  match={{
                    phase: snapshot.phase,
                    gameIndex: snapshot.gameIndex,
                    results: snapshot.gameResults,
                    rotation: matchRotation,
                    playerNames,
                    playerGameWins: snapshot.playerGameWins,
                  }}
                />
              }
              consolePanel={<ConsolePanel entries={logs} />}
              chatBox={
                <ChatBox
                  messages={chatMessages}
                  onSend={sendChat}
                  disabled={status !== 'connected'}
                  name={displayName}
                />
              }
              trickHistory={
                <TrickHistory
                  tricks={snapshot.completedTricks}
                  seatingOrder={seatingOrder.length ? seatingOrder : snapshot.seating}
                  nameForSeat={nameForSeat}
                />
              }
            />
          </>
        ) : (
          <section className="panel placeholder-panel"><p>Reconnecting…</p></section>
        )}
      </main>
    </div>
  )
}
