import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayerId, PLAYERS } from '@hooker/shared'
import { useSocket } from '../hooks/useSocket'

const DEFAULT_SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'
const PLAYER_IDS: PlayerId[] = PLAYERS

export default function Lobby() {
  const { connect, token, clearToken, defaultServer, status, lobby } = useSocket(DEFAULT_SERVER)
  const [serverUrl, setServerUrl] = useState(token?.serverUrl ?? defaultServer)
  const [roomId, setRoomId] = useState(token?.roomId ?? 'demo')
  const [playerId, setPlayerId] = useState<PlayerId>(token?.seat ?? 'A')
  const [name, setName] = useState(token?.name ?? `Player ${playerId}`)
  const [formError, setFormError] = useState<string | null>(null)
  const [actionMessage, setActionMessage] = useState<string | null>(null)
  const [isResetting, setIsResetting] = useState(false)
  const nav = useNavigate()

  useEffect(() => {
    setName(prev => (!prev || /^Player [A-D]$/.test(prev)) ? `Player ${playerId}` : prev)
  }, [playerId])

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
    if (!roomId.trim()) return setFormError('Room ID is required')
    if (!name.trim()) return setFormError('Display name is required')
    setFormError(null)
    setActionMessage(null)
    connect({ serverUrl, roomId, seat: playerId, name })
    nav(`/room/${encodeURIComponent(roomId)}`)
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
            <h2 className="panel-heading">Sit at a table</h2>
            <div className="form-grid">
              <label>
                <span>Server</span>
                <input value={serverUrl} onChange={e=>setServerUrl(e.target.value)} placeholder={defaultServer} autoComplete="off" />
              </label>
              <label>
                <span>Room ID</span>
                <input value={roomId} onChange={e=>setRoomId(e.target.value)} autoComplete="off" />
              </label>
              <label>
                <span>Seat</span>
                <select value={playerId} onChange={e=>setPlayerId(e.target.value as PlayerId)}>
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
              {token && <button type="button" className="link-button" onClick={clearToken}>Clear saved seat</button>}
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
