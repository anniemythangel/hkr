import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ParticipantRole, PlayerId, PLAYERS } from '@hooker/shared'
import { useSocket } from '../hooks/useSocket'

const DEFAULT_SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'
const PLAYER_IDS: PlayerId[] = PLAYERS

export default function Lobby() {
  const { connect, token, clearToken, defaultServer, status, lobby } = useSocket(DEFAULT_SERVER)
  const [serverUrl, setServerUrl] = useState(token?.serverUrl ?? defaultServer)
  const [roomId, setRoomId] = useState(token?.roomId ?? 'demo')
  const [role, setRole] = useState<ParticipantRole>(token?.role ?? 'player')
  const [playerId, setPlayerId] = useState<PlayerId>(token?.seat ?? 'A')
  const [followSeat, setFollowSeatState] = useState<PlayerId>(token?.followSeat ?? token?.seat ?? 'A')
  const [name, setName] = useState(token?.name ?? `Player ${playerId}`)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    setName(prev => {
      if (role === 'player') {
        if (!prev || /^Player [A-D]$/.test(prev) || prev === 'Spectator') {
          return `Player ${playerId}`
        }
        return prev
      }
      if (!prev || /^Player [A-D]$/.test(prev) || prev === `Player ${playerId}`) {
        return 'Spectator'
      }
      return prev
    })
  }, [playerId, role])

  useEffect(() => {
    if (role === 'spectator') {
      setFollowSeatState(current => current ?? playerId)
    }
  }, [role, playerId])

  const lobbyStatusLabel = lobby
    ? lobby.matchStarted
      ? 'Match in progress'
      : lobby.status === 'waitingForPlayers'
        ? 'Waiting for players'
        : lobby.status === 'waitingForReady'
          ? 'Waiting for ready checks'
          : 'Ready to start'
    : 'Seat availability updates after you connect.'

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    const trimmedRoom = roomId.trim()
    const trimmedName = name.trim()
    if (!trimmedRoom) return setFormError('Room ID is required')
    if (!trimmedName) return setFormError('Display name is required')
    setFormError(null)
    setActionMessage(null)
    if (role === 'spectator') {
      connect({ serverUrl, roomId: trimmedRoom, name: trimmedName, role: 'spectator', followSeat })
    } else {
      connect({ serverUrl, roomId: trimmedRoom, seat: playerId, name: trimmedName, role: 'player' })
    }
    nav(`/room/${encodeURIComponent(trimmedRoom)}`)
  }

  const handleLaunchNewGame = async () => {
    if (isResetting) return
    const trimmedRoom = roomId.trim()
    if (!trimmedRoom) {
      setActionMessage(null)
      setFormError('Room ID is required to launch a new game')
      return
    }
    const confirmed = window.confirm(
      'This will reset the current match, reshuffle the decks, and start from the beginning. Continue?',
    )
    if (!confirmed) return

    setIsResetting(true)
    setFormError(null)
    setActionMessage(null)

    const effectiveServer = (serverUrl?.trim() || defaultServer).replace(/\/?$/, '')
    try {
      const response = await fetch(
        `${effectiveServer}/rooms/${encodeURIComponent(trimmedRoom)}/reset`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ requestedBy: name.trim() || null }),
        },
      )

      const contentType = response.headers.get('content-type')
      let payload: any = null
      if (contentType && contentType.includes('application/json')) {
        payload = await response.json()
      } else {
        const text = await response.text()
        if (text) {
          payload = { message: text }
        }
      }

      if (!response.ok || payload?.ok === false) {
        const errorMessage = payload?.error || payload?.message || `Request failed (${response.status})`
        throw new Error(errorMessage)
      }

      const successMessage =
        payload?.message || `New game launched for room "${trimmedRoom}". Everyone has been reset.`
      setActionMessage(successMessage)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      setFormError(`Failed to launch new game: ${message}`)
    } finally {
      setIsResetting(false)
    }
  }

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
          <form className="panel join-panel" onSubmit={handleJoin}>
            <h2 className="panel-heading">Join a room</h2>
            <div className="form-grid">
              <label>
                <span>Server</span>
                <input value={serverUrl} onChange={e=>setServerUrl(e.target.value)} placeholder={defaultServer} autoComplete="off" />
              </label>
              <label>
                <span>Room ID</span>
                <input value={roomId} onChange={e=>setRoomId(e.target.value)} autoComplete="off" />
              </label>
              <fieldset className="role-fieldset">
                <legend>Role</legend>
                <label className="role-option">
                  <input
                    type="radio"
                    name="role"
                    value="player"
                    checked={role === 'player'}
                    onChange={() => setRole('player')}
                  />
                  <span>Player</span>
                </label>
                <label className="role-option">
                  <input
                    type="radio"
                    name="role"
                    value="spectator"
                    checked={role === 'spectator'}
                    onChange={() => {
                      setRole('spectator')
                      setFollowSeatState(playerId)
                    }}
                  />
                  <span>Spectator</span>
                </label>
              </fieldset>
              <label>
                <span>{role === 'spectator' ? 'Start viewing seat' : 'Seat'}</span>
                <select
                  value={role === 'spectator' ? followSeat : playerId}
                  onChange={e => {
                    const seat = e.target.value as PlayerId
                    if (role === 'spectator') {
                      setFollowSeatState(seat)
                    } else {
                      setPlayerId(seat)
                    }
                  }}
                >
                  {PLAYER_IDS.map(id => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
              <label>
                <span>Display name</span>
                <input value={name} onChange={e=>setName(e.target.value)} autoComplete="off" />
              </label>
            </div>
            <div className="form-actions">
              <button type="submit">Join room</button>
              <button type="button" onClick={handleLaunchNewGame} disabled={isResetting}>
                {isResetting ? 'Launching…' : 'New Game'}
              </button>
              {token && (
                <button type="button" className="link-button" onClick={clearToken}>
                  Clear saved session
                </button>
              )}
            </div>
            {actionMessage && <div className="success">{actionMessage}</div>}
            {formError && <div className="error">{formError}</div>}
          </form>
          <section className="panel lobby-status-panel">
            <h2 className="panel-heading">Room status</h2>
            {lobby ? (
              <>
                <p>{lobbyStatusLabel}</p>
                <ul className="waiting-seat-list">
                  {PLAYER_IDS.map(seat => {
                    const seatState = lobby.seats[seat]
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
                        <span>{seat}: {name}</span>
                        <span>{seatStatus}</span>
                      </li>
                    )
                  })}
                </ul>
              </>
            ) : (
              <p className="waiting-note">Seat availability appears after you join or reconnect to a room.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
