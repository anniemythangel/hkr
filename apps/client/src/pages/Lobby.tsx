import { FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PlayerId } from '@hooker/shared'
import { useSocket } from '../hooks/useSocket'

const DEFAULT_SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'
const PLAYER_IDS: PlayerId[] = ['A','B','C','D']

export default function Lobby() {
  const { connect, token, clearToken, defaultServer, status } = useSocket(DEFAULT_SERVER)
  const [serverUrl, setServerUrl] = useState(token?.serverUrl ?? defaultServer)
  const [roomId, setRoomId] = useState(token?.roomId ?? 'demo')
  const [playerId, setPlayerId] = useState<PlayerId>(token?.seat ?? 'A')
  const [name, setName] = useState(token?.name ?? `Player ${playerId}`)
  const [formError, setFormError] = useState<string | null>(null)
  const nav = useNavigate()

  useEffect(() => {
    setName(prev => (!prev || /^Player [A-D]$/.test(prev)) ? `Player ${playerId}` : prev)
  }, [playerId])

  const handleJoin = (e: FormEvent) => {
    e.preventDefault()
    if (!roomId.trim()) return setFormError('Room ID is required')
    if (!name.trim()) return setFormError('Display name is required')
    setFormError(null)
    connect({ serverUrl, roomId, seat: playerId, name })
    nav(`/room/${encodeURIComponent(roomId)}`)
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
              {token && <button type="button" className="link-button" onClick={clearToken}>Clear saved seat</button>}
            </div>
            {formError && <div className="error">{formError}</div>}
          </form>
        </div>
      </main>
    </div>
  )
}
