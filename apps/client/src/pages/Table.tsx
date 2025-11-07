import { useCallback, useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useSocket } from '../hooks/useSocket'
import TableLayout from '../components/TableLayout'
import ConsolePanel from '../components/ConsolePanel'
import ChatBox from '../components/ChatBox'
import TrickHistory from '../components/TrickHistory'
import Scoreboard from '../components/Scoreboard'
import { Suit, Card, PlayerId, ParticipantRole, TEAMS, GAME_ROTATION, PLAYERS } from '@hooker/shared'

export default function TablePage() {
  const { roomId: routeRoom } = useParams()
  const {
    status, snapshot, error, logs, chatMessages,
    connect, emitAction, sendChat, setReady, setFollowSeat,
    roster, lobby, token, defaultServer
  } = useSocket(import.meta.env.VITE_WS_URL ?? 'http://localhost:3001')
  const nav = useNavigate()
  const participantRole: ParticipantRole = token?.role ?? 'player'
  const displayName = token?.name ?? (participantRole === 'spectator' ? 'Spectator' : 'Player')

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
      if (participantRole === 'spectator') {
        connect({
          serverUrl: token.serverUrl || defaultServer,
          roomId: token.roomId,
          name: token.name,
          role: 'spectator',
          followSeat: token.followSeat,
        })
      } else if (token.seat) {
        connect({
          serverUrl: token.serverUrl || defaultServer,
          roomId: token.roomId,
          seat: token.seat,
          name: token.name,
          role: 'player',
        })
      }
    }
  }, [token, status, connect, defaultServer, nav, routeRoom, participantRole])

  const legalKeys = useMemo(
    () => new Set(snapshot?.legalCards.map((c) => `${c.rank}-${c.suit}`) ?? []),
    [snapshot?.legalCards],
  )
  const isSpectator = participantRole === 'spectator'
  const playerSeat: PlayerId | undefined = !isSpectator ? token?.seat : undefined
  const viewerSeat: PlayerId | null = useMemo(() => {
    if (snapshot?.viewer?.seat) return snapshot.viewer.seat
    if (!isSpectator && token?.seat) return token.seat
    if (isSpectator && token?.followSeat) return token.followSeat
    const seats = snapshot?.seating ?? []
    return seats.length > 0 ? seats[0] : null
  }, [snapshot?.viewer?.seat, isSpectator, token?.seat, token?.followSeat, snapshot?.seating])
  const mySeatState = playerSeat ? lobby?.seats?.[playerSeat] : undefined
  const nameForSeat = useMemo(
    () => (seat: PlayerId) => {
      const lobbyName = lobby?.seats?.[seat]?.name?.trim()
      if (lobbyName) return lobbyName
      const rosterName = roster?.[seat]?.name?.trim()
      if (rosterName) return rosterName
      return `Player ${seat}`
    },
    [lobby, roster],
  )

  const emit = (event: string, payload: unknown) => emitAction(event, payload)
  const handleKittyDecision = (accept:boolean)=>emit('kittyDecision',{accept})
  const handleDiscard = (card:Card)=>emit('discard',{card})
  const handleDeclareTrump = (suit:Suit)=>emit('declareTrump',{suit})
  const handlePlayCard = (card:Card)=>emit('playCard',{card})
  const handleReadyToggle = useCallback(() => {
    setReady(!(mySeatState?.ready ?? false))
  }, [mySeatState?.ready, setReady])

  const seatingOrder = useMemo(() => {
    const seats = snapshot?.seating ?? []
    if (!seats.length) return []
    if (!viewerSeat) return seats.slice()
    const index = seats.indexOf(viewerSeat)
    if (index <= 0) return seats.slice()
    return [...seats.slice(index), ...seats.slice(0, index)]
  }, [snapshot, viewerSeat])

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

  const lobbyJoinedCount = useMemo(() => {
    if (!lobby) return 0
    return PLAYERS.reduce((count, seat) => count + (lobby.seats[seat]?.present ? 1 : 0), 0)
  }, [lobby])

  const lobbyReadyCount = useMemo(() => {
    if (!lobby) return 0
    return PLAYERS.reduce(
      (count, seat) => count + (lobby.seats[seat]?.present && lobby.seats[seat]?.ready ? 1 : 0),
      0,
    )
  }, [lobby])

  const lobbyStatusText = useMemo(() => {
    if (!lobby) return 'Waiting for lobby information…'
    if (lobby.matchStarted) {
      return 'Match is starting…'
    }
    switch (lobby.status) {
      case 'waitingForPlayers':
        return `Waiting for players to join (${lobbyJoinedCount}/4 seated)`
      case 'waitingForReady':
        return `Waiting for players to ready up (${lobbyReadyCount}/4 ready)`
      case 'ready':
        return 'All players ready! Starting match…'
      default:
        return 'Match in progress'
    }
  }, [lobby, lobbyJoinedCount, lobbyReadyCount])

  const readyButtonDisabled =
    status !== 'connected' || !playerSeat || !mySeatState?.present || Boolean(lobby?.matchStarted)
  const readyButtonLabel = mySeatState?.ready ? 'Cancel ready' : 'Ready up'
  const showReadyButton = Boolean(!isSpectator && playerSeat && lobby && !lobby.matchStarted)

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
        {snapshot && viewerSeat ? (
          <>
            <TableLayout
              snapshot={snapshot}
              viewerSeat={viewerSeat}
              viewerRole={participantRole}
              displayName={displayName}
              nameForSeat={nameForSeat}
              legalKeys={legalKeys}
              seatingOrder={seatingOrder}
              onKitty={handleKittyDecision}
              onDiscard={handleDiscard}
              onPlay={handlePlayCard}
              onDeclareTrump={handleDeclareTrump}
              onFollowSeat={isSpectator ? setFollowSeat : undefined}
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
          <section className="panel placeholder-panel waiting-panel">
            {status !== 'connected' ? (
              <p>Reconnecting…</p>
          ) : lobby?.matchStarted ? (
            <>
              <h2>Loading match…</h2>
              <p>{lobbyStatusText}</p>
            </>
          ) : lobby ? (
              <>
                <h2>Waiting in lobby</h2>
                <p>{lobbyStatusText}</p>
                <ul className="waiting-seat-list">
                  {PLAYERS.map((seat) => {
                    const seatState = lobby.seats[seat]
                    const isSelf = !isSpectator && seat === playerSeat
                    const isViewing = isSpectator && viewerSeat === seat
                    const name = seatState?.name ?? `Seat ${seat}`
                    const seatStatus = !seatState?.present
                      ? 'Open seat'
                      : seatState.ready
                        ? 'Ready'
                        : 'Not ready'
                    const statusKey = !seatState?.present
                      ? 'open'
                      : seatState.ready
                        ? 'ready'
                        : 'present'
                    return (
                      <li key={seat} className="waiting-seat-row" data-status={statusKey}>
                        <span>
                          {seat}: {name}
                          {isSelf ? ' (You)' : isViewing ? ' (Viewing)' : ''}
                        </span>
                        <span>{seatStatus}</span>
                      </li>
                    )
                  })}
                </ul>
                {showReadyButton ? (
                  <div className="waiting-actions">
                    <button type="button" onClick={handleReadyToggle} disabled={readyButtonDisabled}>
                      {readyButtonLabel}
                    </button>
                    <p className="waiting-note">Everyone must join and click ready before the game begins.</p>
                  </div>
                ) : (
                  <p className="waiting-note">Everyone must join and click ready before the game begins.</p>
                )}
              </>
            ) : (
              <p>Connecting to lobby…</p>
            )}
          </section>
        )}
      </main>
    </div>
  )
}
