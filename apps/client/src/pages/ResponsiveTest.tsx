import { useCallback, useMemo, useState } from 'react'
import type {
  Card,
  MatchSnapshot,
  PlayerId,
  Suit,
  Trick,
} from '@hooker/shared'
import { GAME_ROTATION, PLAYERS, TEAMS } from '@hooker/shared'
import TableLayout from '../components/TableLayout'
import Scoreboard from '../components/Scoreboard'
import ConsolePanel from '../components/ConsolePanel'
import TrickHistory from '../components/TrickHistory'
import ChatBox from '../components/ChatBox'
import type { ChatMessage, ConsoleEntry } from '../hooks/useSocket'

const PLAYER_ID: PlayerId = 'A'
const PLAYER_NAME = 'Test Pilot'

const SEAT_NAMES: Record<PlayerId, string> = {
  A: PLAYER_NAME,
  B: 'River',
  C: 'Sky',
  D: 'Vale',
}

const TEAM_ASSIGNMENTS = {
  NorthSouth: ['A', 'C'],
  EastWest: ['B', 'D'],
} as const

const DISCARD_CARD: Card = { rank: '9', suit: 'clubs' }

type TrickPlan = {
  leader: PlayerId
  cards: Trick['cards']
  winner: PlayerId
  trump?: Suit
}

const TRICK_PLAN: TrickPlan[] = [
  {
    leader: 'A',
    winner: 'A',
    trump: 'hearts',
    cards: [
      { player: 'A', card: { rank: '10', suit: 'hearts' } },
      { player: 'B', card: { rank: '9', suit: 'hearts' } },
      { player: 'C', card: { rank: 'J', suit: 'hearts' } },
      { player: 'D', card: { rank: 'Q', suit: 'hearts' } },
    ],
  },
  {
    leader: 'A',
    winner: 'C',
    cards: [
      { player: 'A', card: { rank: 'Q', suit: 'clubs' } },
      { player: 'B', card: { rank: '9', suit: 'spades' } },
      { player: 'C', card: { rank: 'K', suit: 'clubs' } },
      { player: 'D', card: { rank: '10', suit: 'diamonds' } },
    ],
  },
  {
    leader: 'A',
    winner: 'A',
    cards: [
      { player: 'A', card: { rank: 'K', suit: 'diamonds' } },
      { player: 'B', card: { rank: 'J', suit: 'diamonds' } },
      { player: 'C', card: { rank: 'A', suit: 'diamonds' } },
      { player: 'D', card: { rank: '9', suit: 'diamonds' } },
    ],
  },
  {
    leader: 'A',
    winner: 'A',
    cards: [
      { player: 'A', card: { rank: 'A', suit: 'spades' } },
      { player: 'B', card: { rank: 'J', suit: 'spades' } },
      { player: 'C', card: { rank: 'Q', suit: 'spades' } },
      { player: 'D', card: { rank: 'K', suit: 'spades' } },
    ],
  },
  {
    leader: 'A',
    winner: 'C',
    cards: [
      { player: 'A', card: { rank: 'J', suit: 'clubs' } },
      { player: 'B', card: { rank: 'K', suit: 'hearts' } },
      { player: 'C', card: { rank: 'A', suit: 'clubs' } },
      { player: 'D', card: { rank: 'Q', suit: 'diamonds' } },
    ],
  },
]

const PLAYER_HAND_AFTER_KITTY: Card[] = [
  DISCARD_CARD,
  ...TRICK_PLAN.map((plan) => plan.cards[0].card),
]

const INITIAL_SNAPSHOT: MatchSnapshot = {
  phase: 'KittyDecision',
  gameIndex: 0,
  seating: ['A', 'B', 'C', 'D'],
  dealer: 'D',
  trump: undefined,
  kittyTopCard: { rank: 'A', suit: 'hearts' },
  kittySize: 2,
  kittyOfferee: PLAYER_ID,
  acceptor: PLAYER_ID,
  forcedAccept: true,
  scores: { NorthSouth: 2, EastWest: 1 },
  teamAssignments: {
    NorthSouth: [...TEAM_ASSIGNMENTS.NorthSouth],
    EastWest: [...TEAM_ASSIGNMENTS.EastWest],
  },
  selfHand: PLAYER_HAND_AFTER_KITTY,
  otherHandCounts: {
    A: PLAYER_HAND_AFTER_KITTY.length,
    B: 5,
    C: 5,
    D: 5,
  },
  currentTrick: undefined,
  completedTricks: [],
  legalCards: [],
  lastHandSummary: undefined,
  gameResults: [],
  playerGameWins: { A: 0, B: 0, C: 0, D: 0 },
  aceDraw: undefined,
}

const INITIAL_LOGS: ConsoleEntry[] = [
  {
    type: 'system',
    text: 'Connected to preview table',
    when: Date.now() - 2000,
    actor: { seat: null, name: 'System' },
  },
  {
    type: 'move',
    text: 'Dealer flipped the kitty',
    when: Date.now() - 1000,
    actor: { seat: 'D', name: SEAT_NAMES.D },
  },
]

const INITIAL_CHAT: ChatMessage[] = [
  { name: SEAT_NAMES.B, text: 'GLHF!', when: Date.now() - 1500 },
  { name: SEAT_NAMES.C, text: 'Ready when you are.', when: Date.now() - 900 },
]

function cardsEqual(a: Card, b: Card) {
  return a.rank === b.rank && a.suit === b.suit
}

function formatCard(card: Card) {
  return `${card.rank} of ${card.suit}`
}

export default function ResponsiveTestPage() {
  const [snapshot, setSnapshot] = useState<MatchSnapshot>(INITIAL_SNAPSHOT)
  const [logs, setLogs] = useState<ConsoleEntry[]>(INITIAL_LOGS)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(INITIAL_CHAT)
  const [status, setStatus] = useState<'connected' | 'reconnecting'>('connected')
  const [tableVisible, setTableVisible] = useState(true)
  const [trickStep, setTrickStep] = useState(0)

  const legalKeys = useMemo(() => {
    return new Set(snapshot.legalCards.map((card) => `${card.rank}-${card.suit}`))
  }, [snapshot.legalCards])

  const seatingOrder = useMemo(() => {
    const seats = snapshot.seating
    const myIndex = seats.indexOf(PLAYER_ID)
    if (myIndex <= 0) return seats.slice()
    return [...seats.slice(myIndex), ...seats.slice(0, myIndex)]
  }, [snapshot.seating])

  const nameForSeat = useCallback((seat: PlayerId) => {
    return SEAT_NAMES[seat] ?? seat
  }, [])

  const trickCounts = useMemo(() => {
    const counts: Record<'NorthSouth' | 'EastWest', number> = { NorthSouth: 0, EastWest: 0 }
    const assignments = snapshot.teamAssignments
    snapshot.completedTricks.forEach((trick) => {
      if (!trick.winner) return
      const team = assignments.NorthSouth.includes(trick.winner) ? 'NorthSouth' : 'EastWest'
      counts[team] += 1
    })
    return counts
  }, [snapshot.completedTricks, snapshot.teamAssignments])

  const scoreboardTeams = useMemo(() => {
    return TEAMS.map((teamId) => ({
      id: teamId,
      label: teamId === 'NorthSouth' ? 'North / South' : 'East / West',
      members: snapshot.teamAssignments[teamId].map((seat) => ({ id: seat, name: nameForSeat(seat) })),
      handTricks: trickCounts[teamId],
    }))
  }, [nameForSeat, trickCounts, snapshot.teamAssignments])

  const playerNames = useMemo(() => {
    const mapping = {} as Record<PlayerId, string>
    PLAYERS.forEach((seat) => {
      mapping[seat] = nameForSeat(seat)
    })
    return mapping
  }, [nameForSeat])

  const matchRotation = useMemo(() => {
    return GAME_ROTATION.map((entry, index) => ({
      gameIndex: index,
      seating: entry.seating,
      teams: TEAMS.map((teamId) => ({
        id: teamId,
        label: teamId === 'NorthSouth' ? 'North / South' : 'East / West',
        members: entry.teams[teamId].map((seat) => ({ id: seat, name: nameForSeat(seat) })),
      })),
    }))
  }, [nameForSeat])

  const handleKitty = useCallback(
    (accept: boolean) => {
      if (!accept) {
        setLogs((prev) => [
          ...prev,
          {
            type: 'system',
            text: 'Pass prevented by forced accept rule',
            when: Date.now(),
            actor: { seat: PLAYER_ID, name: PLAYER_NAME },
            private: true,
          },
        ])
        return
      }

      setSnapshot((prev) => ({
        ...prev,
        phase: 'Discard',
        kittySize: 0,
        kittyTopCard: null,
        forcedAccept: false,
        legalCards: [DISCARD_CARD],
      }))
      setLogs((prev) => [
        ...prev,
        {
          type: 'move',
          text: 'Accepted the kitty',
          when: Date.now(),
          actor: { seat: PLAYER_ID, name: PLAYER_NAME },
        },
      ])
    },
    [],
  )

  const handleDiscard = useCallback((card: Card) => {
    setSnapshot((prev) => {
      const remainingHand = prev.selfHand.filter((entry) => !cardsEqual(entry, card))
      return {
        ...prev,
        phase: 'TrickPlay',
        selfHand: remainingHand,
        otherHandCounts: { ...prev.otherHandCounts, A: remainingHand.length },
        legalCards: [TRICK_PLAN[0].cards[0].card],
        currentTrick: { leader: TRICK_PLAN[0].leader, cards: [] },
        trump: TRICK_PLAN[0].trump ?? prev.trump ?? 'hearts',
      }
    })
    setLogs((prev) => [
      ...prev,
      {
        type: 'move',
        text: `Discarded ${formatCard(card)}`,
        when: Date.now(),
        actor: { seat: PLAYER_ID, name: PLAYER_NAME },
      },
    ])
  }, [])

  const handlePlay = useCallback(
    (card: Card) => {
      setSnapshot((prev) => {
        const plan = TRICK_PLAN[trickStep]
        if (!plan) return prev

        const playedCard = plan.cards[0].card
        const useCard = cardsEqual(card, playedCard) ? card : playedCard
        const updatedHand = prev.selfHand.filter((entry) => !cardsEqual(entry, useCard))
        const updatedOtherCounts = { ...prev.otherHandCounts, A: updatedHand.length }
        plan.cards.slice(1).forEach(({ player }) => {
          updatedOtherCounts[player] = Math.max(0, (updatedOtherCounts[player] ?? 0) - 1)
        })

        const completedTricks = [
          ...prev.completedTricks,
          { leader: plan.leader, cards: plan.cards, winner: plan.winner },
        ]
        const nextStep = trickStep + 1
        const hasMore = nextStep < TRICK_PLAN.length

        return {
          ...prev,
          selfHand: updatedHand,
          otherHandCounts: updatedOtherCounts,
          completedTricks,
          currentTrick: hasMore ? { leader: TRICK_PLAN[nextStep].leader, cards: [] } : undefined,
          legalCards: hasMore ? [TRICK_PLAN[nextStep].cards[0].card] : [],
          phase: hasMore ? 'TrickPlay' : 'HandScore',
          scores: hasMore
            ? prev.scores
            : { ...prev.scores, NorthSouth: prev.scores.NorthSouth + 2 },
          lastHandSummary: hasMore
            ? prev.lastHandSummary
            : {
                winningTeam: 'NorthSouth',
                points: 2,
                euchred: false,
                tricksWon: { NorthSouth: TRICK_PLAN.length, EastWest: 0 },
              },
          trump: plan.trump ?? prev.trump,
        }
      })

      const played = TRICK_PLAN[trickStep]?.cards[0].card ?? card

      setLogs((prev) => [
        ...prev,
        {
          type: 'move',
          text: `Played ${formatCard(played)}`,
          when: Date.now(),
          actor: { seat: PLAYER_ID, name: PLAYER_NAME },
        },
      ])
      setTrickStep((value) => value + 1)
    },
    [trickStep],
  )

  const handleSendChat = useCallback(
    (message: string) => {
      const entry = { name: PLAYER_NAME, text: message, when: Date.now() }
      setChatMessages((prev) => [...prev, entry])
      return true
    },
    [],
  )

  const simulateReconnect = () => {
    setStatus('reconnecting')
    setTableVisible(false)
    window.setTimeout(() => {
      setStatus('connected')
      setTableVisible(true)
    }, 250)
  }

  return (
    <div className="page responsive-test-page">
      <header className="header">
        <div>
          <h1 className="title">Responsive Regression Harness</h1>
          <p className="subtitle">Preview-only scenario for automated layout checks</p>
        </div>
        <div className="header-actions">
          <button type="button" onClick={simulateReconnect}>
            Simulate reconnect
          </button>
          <div className="status-chip" role="status">
            Status: {status}
          </div>
        </div>
      </header>

      <main>
        {tableVisible && snapshot ? (
          <TableLayout
            snapshot={snapshot}
            playerId={PLAYER_ID}
            displayName={PLAYER_NAME}
            nameForSeat={nameForSeat}
            legalKeys={legalKeys}
            seatingOrder={seatingOrder}
            onKitty={handleKitty}
            onDiscard={handleDiscard}
            onPlay={handlePlay}
            onDeclareTrump={() => undefined}
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
            chatBox={<ChatBox messages={chatMessages} onSend={handleSendChat} name={PLAYER_NAME} />}
            trickHistory={
              <TrickHistory
                tricks={snapshot.completedTricks}
                seatingOrder={seatingOrder}
                nameForSeat={nameForSeat}
              />
            }
          />
        ) : (
          <section className="panel placeholder-panel" aria-live="polite">
            <p>Reconnecting…</p>
          </section>
        )}
      </main>
    </div>
  )
}
