import { FormEvent, useState } from 'react'
import { PLAYERS, type PlayerId } from '@hooker/shared'

const DEFAULT_SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'

export default function AdminSeatTools() {
  const [serverUrl, setServerUrl] = useState(DEFAULT_SERVER)
  const [roomId, setRoomId] = useState('demo')
  const [seat, setSeat] = useState<PlayerId>('A')
  const [token, setToken] = useState('')
  const [result, setResult] = useState<string>('')

  const runAction = async (path: string) => {
    const ok = window.confirm('Are you sure? This releases seat claims but does not reset match state.')
    if (!ok) return
    const response = await fetch(`${serverUrl.replace(/\/?$/, '')}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const text = await response.text()
    setResult(`${response.status}: ${text}`)
  }

  const handleSeat = async (e: FormEvent) => {
    e.preventDefault()
    await runAction(`/admin/rooms/${encodeURIComponent(roomId)}/seats/${seat}/release`)
  }

  return (
    <div className="page">
      <main className="app-grid">
        <section className="panel join-panel">
          <h2 className="panel-heading">Admin seat tools</h2>
          <form onSubmit={handleSeat} className="form-grid">
            <label><span>Server</span><input value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} /></label>
            <label><span>Room ID</span><input value={roomId} onChange={(e) => setRoomId(e.target.value)} /></label>
            <label><span>Seat</span>
              <select value={seat} onChange={(e) => setSeat(e.target.value as PlayerId)}>
                {PLAYERS.map((id) => <option key={id} value={id}>{id}</option>)}
              </select>
            </label>
            <label><span>Admin token</span><input type="password" value={token} onChange={(e) => setToken(e.target.value)} /></label>
            <div className="form-actions">
              <button type="submit">Force clear seat</button>
              <button type="button" onClick={() => runAction(`/admin/rooms/${encodeURIComponent(roomId)}/seats/release-all`)}>Force clear all seats</button>
            </div>
          </form>
          {result ? <pre>{result}</pre> : null}
        </section>
      </main>
    </div>
  )
}
