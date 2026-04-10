import { FormEvent, useMemo, useState } from 'react'

type HonorOutcome = 'Talson' | 'Usha' | 'Neutral'
type RoundField = 'R1' | 'R2' | 'R3'
type FormState = {
  recordedAt: string
  A: string
  B: string
  C: string
  D: string
  R1: string
  R2: string
  R3: string
  honorA: HonorOutcome
  honorB: HonorOutcome
  honorC: HonorOutcome
  honorD: HonorOutcome
  token: string
}
type HonorField = 'honorA' | 'honorB' | 'honorC' | 'honorD'

const TOKEN_STORAGE_KEY = 'stats.manual.adminToken'
const SCORE_PATTERN = /^(\d{1,2})-(\d{1,2})$/

const SERVER = resolveServerBase()

function resolveServerBase() {
  const configured = import.meta.env.VITE_WS_URL?.trim()
  if (configured) {
    return configured.replace(/^ws/i, 'http').replace(/\/$/, '')
  }
  if (import.meta.env.DEV) {
    return 'http://localhost:3001'
  }
  return window.location.origin
}

function parseRoundValue(input: string): { ok: true } | { ok: false; error: string } {
  const value = input.trim()
  const match = SCORE_PATTERN.exec(value)
  if (!match) {
    return { ok: false, error: 'Use NN-EE format (example: 16-12)' }
  }
  const ns = Number.parseInt(match[1] ?? '', 10)
  const ew = Number.parseInt(match[2] ?? '', 10)
  if (!Number.isInteger(ns) || !Number.isInteger(ew)) {
    return { ok: false, error: 'Scores must be integers' }
  }
  if (ns < 0 || ns > 16 || ew < 0 || ew > 16) {
    return { ok: false, error: 'Scores must be between 0 and 16' }
  }
  return { ok: true }
}

export default function StatsManualPage() {
  const [form, setForm] = useState<FormState>({
    recordedAt: new Date().toISOString().slice(0, 16),
    A: '',
    B: '',
    C: '',
    D: '',
    R1: '',
    R2: '',
    R3: '',
    honorA: 'Neutral',
    honorB: 'Neutral',
    honorC: 'Neutral',
    honorD: 'Neutral',
    token: sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? '',
  })
  const [status, setStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const honorFieldBySeat: Record<'A' | 'B' | 'C' | 'D', HonorField> = {
    A: 'honorA',
    B: 'honorB',
    C: 'honorC',
    D: 'honorD',
  }

  const roundErrors = useMemo(() => {
    const errors: Partial<Record<RoundField, string>> = {}
    ;(['R1', 'R2', 'R3'] as RoundField[]).forEach((field) => {
      if (!form[field].trim()) return
      const parsed = parseRoundValue(form[field])
      if (!parsed.ok) errors[field] = parsed.error
    })
    return errors
  }, [form])

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const blocking = (['R1', 'R2', 'R3'] as RoundField[]).some((field) => !parseRoundValue(form[field]).ok)
    if (blocking) {
      setStatus('error')
      setMessage('Please fix round score format errors before submitting.')
      return
    }
    sessionStorage.setItem(TOKEN_STORAGE_KEY, form.token)
    setStatus('saving')
    setMessage('')
    try {
      const payload = {
        recordedAt: new Date(form.recordedAt).toISOString(),
        A: form.A,
        B: form.B,
        C: form.C,
        D: form.D,
        R1: form.R1.trim(),
        R2: form.R2.trim(),
        R3: form.R3.trim(),
        honorA: form.honorA,
        honorB: form.honorB,
        honorC: form.honorC,
        honorD: form.honorD,
      }
      const res = await fetch(`${SERVER}/stats/manual/matches`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${form.token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error ?? 'Manual insert failed')
      }
      setStatus('success')
      setMessage(`Inserted ${data.matchId}`)
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : 'Manual insert failed')
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">Manual Stats Insert</h1>
      </header>
      <main className="panel">
        <form onSubmit={(event) => void onSubmit(event)}>
          <p>Maintainer-only form to insert historical matches.</p>
          <label>
            Manual Admin Token
            <input value={form.token} onChange={(event) => setForm((prev) => ({ ...prev, token: event.target.value }))} required />
          </label>
          <label>
            Date
            <input
              type="datetime-local"
              value={form.recordedAt}
              onChange={(event) => setForm((prev) => ({ ...prev, recordedAt: event.target.value }))}
              required
            />
          </label>
          {(['A', 'B', 'C', 'D'] as const).map((seat) => (
            <label key={seat}>
              {seat}
              <input value={form[seat]} onChange={(event) => setForm((prev) => ({ ...prev, [seat]: event.target.value }))} required />
            </label>
          ))}
          {(['R1', 'R2', 'R3'] as RoundField[]).map((field) => (
            <label key={field}>
              {field}
              <input value={form[field]} onChange={(event) => setForm((prev) => ({ ...prev, [field]: event.target.value }))} required />
              {roundErrors[field] ? <small className="error">{roundErrors[field]}</small> : null}
            </label>
          ))}
          {(['A', 'B', 'C', 'D'] as const).map((seat) => {
            const honorField = honorFieldBySeat[seat]
            return (
              <label key={`honor-${seat}`}>
                Honor {seat}
                <select
                  value={form[honorField]}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      [honorField]: event.target.value as HonorOutcome,
                    }))
                  }
                >
                  <option value="Talson">Talson</option>
                  <option value="Usha">Usha</option>
                  <option value="Neutral">Neutral</option>
                </select>
              </label>
            )
          })}
          <button type="submit" disabled={status === 'saving'}>
            {status === 'saving' ? 'Submitting…' : 'Submit Manual Match'}
          </button>
        </form>
        {status === 'success' ? <p>{message}</p> : null}
        {status === 'error' ? <p className="error">{message}</p> : null}
      </main>
    </div>
  )
}
