import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Card, MatchSnapshot, PlayerId } from '@hooker/shared'
import TableLayout from '../TableLayout'

function buildSnapshot(overrides: Partial<MatchSnapshot>): MatchSnapshot {
  return {
    phase: 'KittyDecision',
    gameIndex: 0,
    seating: ['A', 'C', 'B', 'D'],
    dealer: 'A',
    trump: undefined,
    kittyTopCard: null,
    acceptedKittyCard: null,
    kittySize: 4,
    kittyOfferee: 'C',
    acceptor: undefined,
    forcedAccept: false,
    scores: { NorthSouth: 0, EastWest: 0 },
    teamAssignments: { NorthSouth: ['A', 'B'], EastWest: ['C', 'D'] },
    selfHand: [],
    otherHandCounts: { A: 5, B: 5, C: 5, D: 5 },
    currentTrick: undefined,
    completedTricks: [],
    legalCards: [],
    lastHandSummary: undefined,
    gameResults: [],
    playerGameWins: { A: 0, B: 0, C: 0, D: 0 },
    aceDraw: undefined,
    viewer: { role: 'spectator', seat: 'A' },
    ...overrides,
  }
}

function renderTable(snapshot: MatchSnapshot) {
  return renderToStaticMarkup(
    <TableLayout
      snapshot={snapshot}
      viewerSeat="A"
      viewerRole="spectator"
      displayName="Alex"
      nameForSeat={(seat: PlayerId) => seat}
      legalKeys={new Set<string>()}
      seatingOrder={snapshot.seating}
      onKitty={() => {}}
      onDiscard={(_card: Card) => {}}
      onPlay={(_card: Card) => {}}
      onDeclareTrump={() => {}}
      scoreboard={null}
      consolePanel={null}
      chatBox={null}
      trickHistory={null}
    />,
  )
}

describe('TableLayout kitty pocket', () => {
  it('shows kitty top card during KittyDecision', () => {
    const html = renderTable(
      buildSnapshot({
        phase: 'KittyDecision',
        kittyTopCard: { rank: 'A', suit: 'hearts' },
        acceptedKittyCard: { rank: 'J', suit: 'clubs' },
      }),
    )

    expect(html).toContain('Kitty top')
    expect(html).toContain('Kitty top: A of Hearts')
    expect(html).not.toContain('Accepted kitty: J of Clubs')
  })

  it('shows accepted kitty card after kitty decision phase', () => {
    const html = renderTable(
      buildSnapshot({
        phase: 'TrumpDeclaration',
        kittyTopCard: null,
        acceptedKittyCard: { rank: 'J', suit: 'clubs' },
        kittySize: 4,
      }),
    )

    expect(html).toContain('Accepted kitty')
    expect(html).toContain('Accepted kitty: J of Clubs')
  })
})
