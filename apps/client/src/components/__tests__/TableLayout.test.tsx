import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { describe, expect, it, vi, afterEach } from 'vitest';
import type { Card, MatchSnapshot, PlayerId, Trick } from '@hooker/shared';
import TableLayout from '../TableLayout';

let container: HTMLDivElement | null = null;
let root: Root | null = null;

afterEach(() => {
  if (root) {
    act(() => {
      root!.unmount();
    });
  }
  if (container?.parentNode) {
    container.parentNode.removeChild(container);
  }
  container = null;
  root = null;
  vi.useRealTimers();
});

function card(rank: Card['rank'], suit: Card['suit']): Card {
  return { rank, suit };
}

function buildTrick(leader: PlayerId, winner: PlayerId, plays: Array<[PlayerId, Card]>): Trick {
  return {
    leader,
    winner,
    cards: plays.map(([player, playedCard]) => ({
      player,
      card: { ...playedCard },
    })),
  };
}

function createSnapshot(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    phase: 'TrickPlay',
    gameIndex: 0,
    seating: ['A', 'B', 'C', 'D'],
    dealer: 'A',
    trump: 'hearts',
    kittyTopCard: null,
    kittySize: 0,
    kittyOfferee: undefined,
    acceptor: undefined,
    forcedAccept: false,
    scores: { NorthSouth: 0, EastWest: 0 },
    teamAssignments: {
      NorthSouth: ['A', 'C'] as [PlayerId, PlayerId],
      EastWest: ['B', 'D'] as [PlayerId, PlayerId],
    },
    selfHand: [card('9', 'clubs')],
    otherHandCounts: {
      A: 1,
      B: 1,
      C: 1,
      D: 1,
    },
    currentTrick: {
      leader: 'A',
      cards: [],
    },
    completedTricks: [],
    lastCompletedTrick: undefined,
    legalCards: [card('9', 'clubs')],
    lastHandSummary: undefined,
    gameResults: [],
    playerGameWins: { A: 0, B: 0, C: 0, D: 0 },
    aceDraw: undefined,
    viewer: { role: 'player', seat: 'A' },
    ...overrides,
  };
}

const LEGAL_KEYS = new Set(['9-clubs']);

function renderTable(snapshot: MatchSnapshot) {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(
      <TableLayout
        snapshot={snapshot}
        viewerSeat="A"
        viewerRole="player"
        displayName="Player A"
        nameForSeat={(seat) => seat}
        legalKeys={new Set(LEGAL_KEYS)}
        seatingOrder={snapshot.seating}
        onKitty={() => {}}
        onDiscard={() => {}}
        onPlay={() => {}}
        onDeclareTrump={() => {}}
        scoreboard={null}
        consolePanel={null}
        chatBox={null}
        trickHistory={null}
      />,
    );
  });
}

function rerenderTable(snapshot: MatchSnapshot) {
  if (!root || !container) {
    throw new Error('TableLayout not mounted');
  }
  act(() => {
    root!.render(
      <TableLayout
        snapshot={snapshot}
        viewerSeat="A"
        viewerRole="player"
        displayName="Player A"
        nameForSeat={(seat) => seat}
        legalKeys={new Set(LEGAL_KEYS)}
        seatingOrder={snapshot.seating}
        onKitty={() => {}}
        onDiscard={() => {}}
        onPlay={() => {}}
        onDeclareTrump={() => {}}
        scoreboard={null}
        consolePanel={null}
        chatBox={null}
        trickHistory={null}
      />,
    );
  });
}

function buttonByLabel(pattern: RegExp): HTMLButtonElement {
  if (!container) {
    throw new Error('No container rendered');
  }
  const buttons = Array.from(container.querySelectorAll('button')) as HTMLButtonElement[];
  const match = buttons.find((btn) => pattern.test(btn.getAttribute('aria-label') ?? ''));
  if (!match) {
    throw new Error(`No button found for pattern ${pattern}`);
  }
  return match;
}

function trickCardCount(): number {
  if (!container) {
    return 0;
  }
  return container.querySelectorAll('.trick-card-img').length;
}

describe('TableLayout trick linger behaviour', () => {
  it('keeps the last trick visible and disables actions until the linger completes', () => {
    vi.useFakeTimers();

    const trickHistory: Trick[] = [
      buildTrick('A', 'A', [
        ['A', card('9', 'clubs')],
        ['B', card('10', 'clubs')],
        ['C', card('J', 'clubs')],
        ['D', card('Q', 'clubs')],
      ]),
      buildTrick('B', 'B', [
        ['B', card('9', 'diamonds')],
        ['C', card('10', 'diamonds')],
        ['D', card('J', 'diamonds')],
        ['A', card('Q', 'diamonds')],
      ]),
      buildTrick('C', 'C', [
        ['C', card('9', 'hearts')],
        ['D', card('10', 'hearts')],
        ['A', card('J', 'hearts')],
        ['B', card('Q', 'hearts')],
      ]),
      buildTrick('D', 'D', [
        ['D', card('9', 'spades')],
        ['A', card('10', 'spades')],
        ['B', card('J', 'spades')],
        ['C', card('Q', 'spades')],
      ]),
    ];

    const finalTrick = buildTrick('A', 'A', [
      ['A', card('A', 'hearts')],
      ['B', card('K', 'hearts')],
      ['C', card('Q', 'hearts')],
      ['D', card('J', 'hearts')],
    ]);

    const handScoreSnapshot = createSnapshot({
      phase: 'HandScore',
      completedTricks: [...trickHistory, finalTrick],
      lastCompletedTrick: finalTrick,
      currentTrick: undefined,
    });

    renderTable(handScoreSnapshot);

    const nextHandSnapshot = createSnapshot({
      phase: 'TrickPlay',
      completedTricks: [],
      lastCompletedTrick: finalTrick,
      currentTrick: {
        leader: 'A',
        cards: [],
      },
    });

    rerenderTable(nextHandSnapshot);

    const button = buttonByLabel(/9 of Clubs/i);
    expect(button.disabled).toBe(true);
    expect(trickCardCount()).toBe(4);

    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(button.disabled).toBe(true);
    expect(trickCardCount()).toBe(4);

    act(() => {
      vi.advanceTimersByTime(2);
    });
    expect(button.disabled).toBe(false);
    expect(trickCardCount()).toBe(4);

    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(trickCardCount()).toBe(0);
  });
});
