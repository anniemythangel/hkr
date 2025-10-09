import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { Scoreboard } from '../Scoreboard'
import type { PlayerId, TeamAssignments, TeamId } from '@hooker/shared'
import { GAME_ROTATION, TEAMS } from '@hooker/shared'

const playerNames: Record<PlayerId, string> = {
  A: 'Aria',
  B: 'Bennett',
  C: 'Cass',
  D: 'Dee',
}

const rotation = GAME_ROTATION.map((config, index) => ({
  gameIndex: index,
  seating: config.seating,
  teams: TEAMS.map((teamId) => ({
    id: teamId,
    label: teamId === 'NorthSouth' ? 'North / South' : 'East / West',
    members: config.teams[teamId].map((seat) => ({
      id: seat,
      name: playerNames[seat],
    })),
  })),
}))

function toAssignments(entry: (typeof rotation)[number]): TeamAssignments {
  const byTeam = new Map<TeamId, PlayerId[]>()
  entry.teams.forEach((team) => {
    byTeam.set(team.id, team.members.map((member) => member.id))
  })
  return {
    NorthSouth: byTeam.get('NorthSouth') as [PlayerId, PlayerId],
    EastWest: byTeam.get('EastWest') as [PlayerId, PlayerId],
  }
}

type Summary = {
  gameIndex: number
  winner: TeamId
  scores: Record<TeamId, number>
  seating: PlayerId[]
  teams: TeamAssignments
}

function renderScoreboard(overrides: {
  phase: 'MatchSetup' | 'KittyDecision' | 'TrickPlay' | 'MatchOver'
  gameIndex: number
  results: Summary[]
  playerGameWins: Record<PlayerId, number>
}) {
  const current = rotation[overrides.gameIndex]
  const html = renderToStaticMarkup(
    <Scoreboard
      scores={{ NorthSouth: 6, EastWest: 4 }}
      teams={current.teams.map((team) => ({ ...team, handTricks: 2 }))}
      dealer={current.seating[0]}
      dealerName={playerNames[current.seating[0]]}
      trickIndex={2}
      match={{
        phase: overrides.phase,
        gameIndex: overrides.gameIndex,
        results: overrides.results,
        rotation,
        playerNames,
        playerGameWins: overrides.playerGameWins,
      }}
    />,
  )
  return html
}

const gameResults: Summary[] = rotation.map((entry) => ({
  gameIndex: entry.gameIndex,
  winner: 'NorthSouth' as TeamId,
  scores: { NorthSouth: 10, EastWest: 6 },
  seating: entry.seating,
  teams: toAssignments(entry),
}))

describe('Scoreboard', () => {
  it('renders the opening game state', () => {
    const html = renderScoreboard({
      phase: 'TrickPlay',
      gameIndex: 0,
      results: [],
      playerGameWins: { A: 0, B: 0, C: 0, D: 0 },
    })
    expect(html).toContain('Match Game 1 of 3')
    expect(html).toContain('Game to 10')
    expect(html).toContain('Game 1')
    expect(html).toContain('Game 2')
    expect(html).toContain('Game 3')
  })

  it('shows completed games with results mid-match', () => {
    const html = renderScoreboard({
      phase: 'MatchSetup',
      gameIndex: 1,
      results: [gameResults[0]],
      playerGameWins: { A: 1, B: 1, C: 0, D: 0 },
    })
    expect(html).toContain('Match Game 2 of 3')
    expect(html).toContain('North / South won 10-6')
  })

  it('announces honors when the match ends', () => {
    const html = renderScoreboard({
      phase: 'MatchOver',
      gameIndex: 2,
      results: gameResults,
      playerGameWins: { A: 3, B: 1, C: 1, D: 1 },
    })
    expect(html).toContain('Match Complete')
    expect(html).toContain('Honors')
    expect(html).toContain('Talson')
  })
})
