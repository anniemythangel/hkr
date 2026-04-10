import { Fragment, useEffect, useMemo, useState } from 'react'
import { GAME_ROTATION } from '@hooker/shared'

type PlayerStats = {
  profileId: string
  displayName: string
  talson: number
  usha: number
  neutral: number
  matches: number
  lastPlayed: string | null
}

type MatchHonorOutcome = 'Talson' | 'Usha' | 'Neutral'

type PlayerDetails = {
  profileId: string
  displayName: string
  aliases: Array<{ aliasRaw: string; aliasNormalized: string }>
  recentOutcomes: Array<{ matchId: string; outcome: MatchHonorOutcome; recordedAt: string }>
  recentOutcomesNextCursor: string | null
}

type MatchHistoryRow = {
  matchId: string
  recordedAt: string
  players: {
    A: { profileId: string | null; displayName: string }
    B: { profileId: string | null; displayName: string }
    C: { profileId: string | null; displayName: string }
    D: { profileId: string | null; displayName: string }
  }
  rounds: Array<{ round: 1 | 2 | 3; northSouth: number; eastWest: number }>
  honors: { A: MatchHonorOutcome; B: MatchHonorOutcome; C: MatchHonorOutcome; D: MatchHonorOutcome }
}

const SERVER = resolveServerBase()
const HONOR_LABELS: Record<MatchHonorOutcome, string> = {
  Talson: 'Talson',
  Usha: 'Usha',
  Neutral: 'Benonimi',
}

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

export default function StatsPage() {
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorText, setErrorText] = useState('')
  const [selected, setSelected] = useState<PlayerDetails | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const [historyRows, setHistoryRows] = useState<MatchHistoryRow[]>([])
  const [historyCursor, setHistoryCursor] = useState<string | null>(null)
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false)
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null)

  useEffect(() => {
    let ignore = false
    const load = async () => {
      setStatus('loading')
      setErrorText('')
      try {
        const healthRes = await fetch(`${SERVER}/stats/health`)
        const healthData = await healthRes.json()
        if (!healthRes.ok || !healthData?.stats?.available) {
          throw new Error('Stats are currently unavailable on this server.')
        }

        const [playersRes, historyRes] = await Promise.all([
          fetch(`${SERVER}/stats/players`),
          fetch(`${SERVER}/stats/matches?limit=25`),
        ])
        const [playersData, historyData] = await Promise.all([playersRes.json(), historyRes.json()])
        if (!playersRes.ok) throw new Error(playersData?.error ?? 'Failed to load player stats.')
        if (!historyRes.ok) throw new Error(historyData?.error ?? 'Failed to load match history.')
        if (ignore) return
        setPlayers(playersData.players ?? [])
        setHistoryRows(historyData.rows ?? [])
        setHistoryCursor(historyData.nextCursor ?? null)
        setStatus('ready')
      } catch (error) {
        if (ignore) return
        setPlayers([])
        setHistoryRows([])
        setStatus('error')
        setErrorText(error instanceof Error ? error.message : 'Failed to load stats.')
      }
    }

    void load()
    return () => {
      ignore = true
    }
  }, [])

  const leaders = useMemo(
    () => ({
      talson: [...players].sort((a, b) => b.talson - a.talson)[0],
      usha: [...players].sort((a, b) => b.usha - a.usha)[0],
      matches: [...players].sort((a, b) => b.matches - a.matches)[0],
    }),
    [players],
  )

  const loadPlayerDetails = async (profileId: string, cursor?: string) => {
    setLoadingDetails(true)
    try {
      const query = new URLSearchParams()
      query.set('limit', '20')
      if (cursor) query.set('beforeRecordedAt', cursor)
      const res = await fetch(`${SERVER}/stats/players/${encodeURIComponent(profileId)}?${query.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load player details')
      const loaded = data.player as PlayerDetails
      setSelected((prev) => {
        if (!cursor || !prev || prev.profileId !== loaded.profileId) return loaded
        return {
          ...loaded,
          recentOutcomes: [...prev.recentOutcomes, ...loaded.recentOutcomes],
        }
      })
      setSelectedId(profileId)
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Failed to load player details')
      setStatus('error')
    } finally {
      setLoadingDetails(false)
    }
  }

  const formatRound = (round: { northSouth: number; eastWest: number }) => `${round.northSouth}-${round.eastWest}`
  const formatHonorLabel = (outcome: MatchHonorOutcome) => HONOR_LABELS[outcome]

  const formatRoundBreakdown = (row: MatchHistoryRow, round: MatchHistoryRow['rounds'][number]) => {
    const rotation = GAME_ROTATION[round.round - 1]
    const northSouthNames = rotation.teams.NorthSouth.map((seat) => row.players[seat].displayName).join(' + ')
    const eastWestNames = rotation.teams.EastWest.map((seat) => row.players[seat].displayName).join(' + ')
    const winnerText =
      round.northSouth === round.eastWest
        ? `Tie between ${northSouthNames} and ${eastWestNames}`
        : round.northSouth > round.eastWest
          ? `${northSouthNames} won`
          : `${eastWestNames} won`
    return `Round ${round.round}: ${round.northSouth}-${round.eastWest} (${winnerText})`
  }

  const loadMoreHistory = async () => {
    if (!historyCursor) return
    setHistoryLoadingMore(true)
    try {
      const query = new URLSearchParams()
      query.set('limit', '25')
      query.set('before', historyCursor)
      const res = await fetch(`${SERVER}/stats/matches?${query.toString()}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error ?? 'Failed to load more match history.')
      setHistoryRows((prev) => [...prev, ...(data.rows ?? [])])
      setHistoryCursor(data.nextCursor ?? null)
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : 'Failed to load match history.')
      setStatus('error')
    } finally {
      setHistoryLoadingMore(false)
    }
  }

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">Player Stats</h1>
      </header>
      <main className="panel stats-page">
        {status === 'loading' ? <p>Loading stats…</p> : null}
        {status === 'error' ? <p className="error">{errorText || 'Could not load stats.'}</p> : null}
        {status === 'ready' && players.length === 0 ? <p>No stats yet. Play a completed match to populate this page.</p> : null}

        {status === 'ready' && players.length > 0 ? (
          <>
            <p className="stats-leaders" aria-label="Leaders summary">
              <span className="stats-leader-chip">Leader 🏆: {leaders.talson?.displayName ?? '-'}</span>
              <span className="stats-leader-chip">Usha 💩: {leaders.usha?.displayName ?? '-'}</span>
              <span className="stats-leader-chip">Talson 😎: {leaders.talson?.displayName ?? '-'}</span>
              <span className="stats-leader-chip">Matches ♞: {leaders.matches?.displayName ?? '-'}</span>
            </p>
            <div className="stats-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Talson</th>
                    <th>Usha</th>
                    <th>Benonimi</th>
                    <th>Matches</th>
                    <th>Last played</th>
                  </tr>
                </thead>
                <tbody>
                  {players.map((player) => (
                    <tr key={player.profileId} onClick={() => void loadPlayerDetails(player.profileId)}>
                      <td>{player.displayName}</td>
                      <td>{player.talson}</td>
                      <td>{player.usha}</td>
                      <td>{player.neutral}</td>
                      <td>{player.matches}</td>
                      <td>{player.lastPlayed ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        {selected && status !== 'loading' ? (
          <section>
            <h2>{selected.displayName}</h2>
            <p>Aliases: {selected.aliases.map((alias) => alias.aliasRaw).join(', ') || 'None'}</p>
            <ul>
              {selected.recentOutcomes.map((outcome) => (
                <li key={`${outcome.matchId}-${outcome.recordedAt}`}>
                  {outcome.matchId} · {formatHonorLabel(outcome.outcome)} · {outcome.recordedAt}
                </li>
              ))}
            </ul>
            {selected.recentOutcomesNextCursor ? (
              <button
                type="button"
                disabled={loadingDetails || selectedId !== selected.profileId}
                onClick={() => void loadPlayerDetails(selected.profileId, selected.recentOutcomesNextCursor ?? undefined)}
              >
                {loadingDetails ? 'Loading…' : 'Load more'}
              </button>
            ) : null}
          </section>
        ) : null}

        <section>
          <h2>Match History</h2>
          {historyRows.length === 0 ? <p>No completed matches yet.</p> : null}
          <div className="stats-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>A</th>
                  <th>B</th>
                  <th>C</th>
                  <th>D</th>
                  <th>R1</th>
                  <th>R2</th>
                  <th>R3</th>
                  <th>Honors</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => {
                  const expanded = expandedMatchId === row.matchId
                  return (
                    <Fragment key={row.matchId}>
                      <tr>
                        <td>
                          <button
                            type="button"
                            className="stats-date-toggle"
                            aria-expanded={expanded}
                            onClick={() => setExpandedMatchId(expanded ? null : row.matchId)}
                          >
                            {new Date(row.recordedAt).toLocaleString()}
                          </button>
                        </td>
                        <td>{row.players.A.displayName}</td>
                        <td>{row.players.B.displayName}</td>
                        <td>{row.players.C.displayName}</td>
                        <td>{row.players.D.displayName}</td>
                        <td>{formatRound(row.rounds[0])}</td>
                        <td>{formatRound(row.rounds[1])}</td>
                        <td>{formatRound(row.rounds[2])}</td>
                        <td className="honor-chip-list">
                          {(['A', 'B', 'C', 'D'] as const).map((seat) => (
                            <span key={`${row.matchId}-${seat}`} className={`honor-chip honor-${row.honors[seat].toLowerCase()}`}>
                              {seat}: {formatHonorLabel(row.honors[seat])}
                            </span>
                          ))}
                        </td>
                      </tr>
                      {expanded ? (
                        <tr>
                          <td colSpan={9}>
                            <strong>Per-round breakdown:</strong>
                            <ul>
                              {row.rounds.map((round) => {
                                return (
                                  <li key={`${row.matchId}-${round.round}`}>
                                    {formatRoundBreakdown(row, round)}
                                  </li>
                                )
                              })}
                            </ul>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
          {historyCursor ? (
            <button type="button" disabled={historyLoadingMore} onClick={() => void loadMoreHistory()}>
              {historyLoadingMore ? 'Loading…' : 'Load more history'}
            </button>
          ) : null}
        </section>
      </main>
    </div>
  )
}
