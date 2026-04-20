import { nanoid } from '../utils/nanoid';
import type {
  GameAction,
  GameClientEvent,
  GameSnapshot,
  KittySnapshot,
  SeatSnapshot,
  Suit,
  TrickSnapshot
} from '../types/game';

const seats: SeatSnapshot[] = [
  {
    id: 'seat-1',
    label: 'North',
    playerName: 'Cheche',
    isReady: true,
    isYou: false,
    canSwap: false,
    avatarColor: '#f97316',
    isTurn: false
  },
  {
    id: 'seat-2',
    label: 'East',
    playerName: 'Moshe',
    isReady: true,
    isYou: false,
    canSwap: true,
    avatarColor: '#22d3ee',
    isTurn: false
  },
  {
    id: 'seat-3',
    label: 'South',
    playerName: 'Adiel (You)',
    isReady: true,
    isYou: true,
    canSwap: false,
    avatarColor: '#84cc16',
    isTurn: true
  },
  {
    id: 'seat-4',
    label: 'West',
    playerName: 'Gal',
    isReady: false,
    isYou: false,
    canSwap: true,
    avatarColor: '#a855f7',
    isTurn: false
  }
];

const trumpSuit: Suit = 'diamonds';

const trick: TrickSnapshot = {
  id: 'trick-1',
  leaderSeatId: 'seat-2',
  plays: [
    {
      seatId: 'seat-2',
      card: {
        id: 'card-1',
        rank: 'J',
        suit: 'diamonds',
        effectiveSuit: 'diamonds',
        isLegal: true
      }
    },
    {
      seatId: 'seat-3',
      card: {
        id: 'card-2',
        rank: 'A',
        suit: 'diamonds',
        effectiveSuit: 'diamonds',
        isLegal: true
      }
    }
  ]
};

const kitty: KittySnapshot = {
  ownerSeatId: 'seat-3',
  trumpSuit,
  cards: [
    { id: 'kitty-1', rank: '9', suit: 'clubs' },
    { id: 'kitty-2', rank: 'A', suit: 'hearts' },
    { id: 'kitty-3', rank: '10', suit: 'spades' }
  ]
};

const baseSnapshot: GameSnapshot = {
  roomCode: 'hooker-1234',
  seats,
  phase: 'TrickPlay',
  scoreboard: {
    teamA: 7,
    teamB: 6,
    target: 10
  },
  yourHand: [
    {
      id: 'hand-1',
      rank: '9',
      suit: 'diamonds',
      effectiveSuit: 'diamonds',
      isLegal: true
    },
    {
      id: 'hand-2',
      rank: 'J',
      suit: 'hearts',
      effectiveSuit: 'hearts',
      isLegal: false
    },
    {
      id: 'hand-3',
      rank: 'A',
      suit: 'diamonds',
      effectiveSuit: 'diamonds',
      isLegal: true
    },
    {
      id: 'hand-4',
      rank: 'Q',
      suit: 'clubs',
      effectiveSuit: 'clubs',
      isLegal: false
    }
  ],
  legalCardIds: ['hand-1', 'hand-3'],
  trick,
  kitty,
  teamAssignments: {
    'seat-1': 'A',
    'seat-2': 'B',
    'seat-3': 'B',
    'seat-4': 'A'
  },
  statusLog: [
    {
      id: nanoid(),
      message: 'Moshe: I got ♠ trump ok',
      timestamp: new Date().toISOString()
    },
    {
      id: nanoid(),
      message: 'Gal accepts',
      timestamp: new Date().toISOString()
    },
    {
      id: nanoid(),
      message: 'Cheche: Legal?',
      timestamp: new Date().toISOString()
    }
  ],
  youSeatId: 'seat-3',
  isYourTurn: true,
  pendingAction: 'PlayCard'
};

export class MockGameClient {
  private listeners = new Set<(event: GameClientEvent) => void>();
  private snapshot: GameSnapshot = baseSnapshot;
  private interval?: ReturnType<typeof setInterval>;

  connect() {
    this.emit({ type: 'snapshot', payload: this.snapshot });
    this.interval = setInterval(() => {
      const id = nanoid();
      const newLog = {
        id,
        message: 'Status: waiting for Adiel…',
        timestamp: new Date().toISOString()
      };
      this.snapshot = {
        ...this.snapshot,
        statusLog: [newLog, ...this.snapshot.statusLog].slice(0, 8)
      };
      this.emit({ type: 'snapshot', payload: this.snapshot });
    }, 10000);
  }

  disconnect() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  subscribe(listener: (event: GameClientEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: GameClientEvent) {
    this.listeners.forEach((listener) => listener(event));
  }

  send(action: GameAction) {
    if (action.type === 'PlayCard' && !this.snapshot.legalCardIds.includes(action.cardId)) {
      this.emit({ type: 'toast', payload: 'You must follow suit' });
      return;
    }

    if (action.type === 'DiscardCard' && this.snapshot.phase !== 'KittyExchange') {
      this.emit({ type: 'toast', payload: 'You can’t discard that card' });
      return;
    }

    this.emit({ type: 'toast', payload: `Action sent: ${action.type}` });
  }
}

export const mockGameClient = new MockGameClient();
