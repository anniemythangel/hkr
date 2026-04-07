import { useEffect, useMemo, useState } from 'react'

type PlayerStats = {
  profileId: string
  displayName: string
  talson: number
  usha: number
  neutral: number
  matches: number
  lastPlayed: string | null
}

type PlayerDetails = {
  profileId: string
  displayName: string
  aliases: Array<{ aliasRaw: string; aliasNormalized: string }>
  recentOutcomes: Array<{ matchId: string; outcome: 'Talson' | 'Usha' | 'Neutral'; recordedAt: string }>
}

const SERVER = import.meta.env.VITE_WS_URL ?? 'http://localhost:3001'

export default function StatsPage() {
  const [players, setPlayers] = useState<PlayerStats[]>([])
  const [selected, setSelected] = useState<PlayerDetails | null>(null)

  useEffect(() => {
    fetch(`${SERVER}/stats/players`)
      .then((res) => res.json())
      .then((data) => setPlayers(data.players ?? []))
      .catch(() => setPlayers([]))
  }, [])

  const leaders = useMemo(() => ({
    talson: [...players].sort((a, b) => b.talson - a.talson)[0],
    usha: [...players].sort((a, b) => b.usha - a.usha)[0],
    matches: [...players].sort((a, b) => b.matches - a.matches)[0],
  }), [players])

  return (
    <div className="page">
      <header className="header">
        <h1 className="title">Player Stats</h1>
      </header>
      <main className="panel">
        <p>Leaders: Talson {leaders.talson?.displayName ?? '-'} · Usha {leaders.usha?.displayName ?? '-'} · Matches {leaders.matches?.displayName ?? '-'}</p>
        <table>
          <thead>
            <tr><th>Player</th><th>Talson</th><th>Usha</th><th>Neutral</th><th>Matches</th><th>Last played</th></tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.profileId} onClick={() => {
                fetch(`${SERVER}/stats/players/${encodeURIComponent(player.profileId)}`)
                  .then((res) => res.json())
                  .then((data) => setSelected(data.player ?? null))
              }}>
                <td>{player.displayName}</td><td>{player.talson}</td><td>{player.usha}</td><td>{player.neutral}</td><td>{player.matches}</td><td>{player.lastPlayed ?? '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {selected ? (
          <section>
            <h2>{selected.displayName}</h2>
            <p>Aliases: {selected.aliases.map((alias) => alias.aliasRaw).join(', ') || 'None'}</p>
            <ul>
              {selected.recentOutcomes.map((outcome) => (
                <li key={`${outcome.matchId}-${outcome.recordedAt}`}>{outcome.outcome} · {outcome.recordedAt}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  )
}
