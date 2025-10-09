import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import {
  advanceState,
  createDeck,
  createMatch,
  handleDeclareTrump,
  handleDiscard,
  handleKittyDecision,
  handlePlayCard,
  getSnapshot,
  effectiveSuit,
} from '@hooker/engine';
import { Card, PlayerId } from '@hooker/shared';
import type { GameState, Result } from '@hooker/engine';

const SUIT_MAP = {
  C: 'clubs',
  D: 'diamonds',
  H: 'hearts',
  S: 'spades',
} as const;

function card(rank: Card['rank'], suit: keyof typeof SUIT_MAP): Card {
  return { rank, suit: SUIT_MAP[suit] };
}

function buildDeck(specs: Array<[Card['rank'], keyof typeof SUIT_MAP]>) {
  return specs.map(([rank, suit]) => card(rank, suit));
}

function unwrap(result: Result<GameState>): GameState {
  if (!result.ok) {
    throw new Error(result.error);
  }
  return result.state;
}

const aceDeck = buildDeck([
  ['A', 'S'],
  ['9', 'C'],
  ['9', 'D'],
  ['9', 'H'],
]);

const handDeck = buildDeck([
  ['9', 'C'],
  ['9', 'D'],
  ['9', 'H'],
  ['9', 'S'],
  ['10', 'C'],
  ['10', 'D'],
  ['10', 'H'],
  ['10', 'S'],
  ['Q', 'C'],
  ['Q', 'D'],
  ['Q', 'H'],
  ['Q', 'S'],
  ['K', 'C'],
  ['K', 'D'],
  ['K', 'H'],
  ['K', 'S'],
  ['A', 'C'],
  ['A', 'D'],
  ['A', 'H'],
  ['A', 'S'],
  ['J', 'C'],
  ['J', 'D'],
  ['J', 'H'],
  ['J', 'S'],
]);

const aceDrawDeck = (() => {
  const prefix = buildDeck([
    ['9', 'C'],
    ['9', 'D'],
    ['9', 'H'],
    ['9', 'S'],
    ['10', 'C'],
    ['A', 'D'],
  ]);
  const remainder = createDeck().filter(
    (entry) => !prefix.some((pref) => pref.rank === entry.rank && pref.suit === entry.suit),
  );
  return [...prefix, ...remainder];
})();

describe('deck creation', () => {
  it('creates 24 unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(24);
    const unique = new Set(deck.map((c) => `${c.rank}-${c.suit}`));
    expect(unique.size).toBe(24);
  });
});

describe('effective suit', () => {
  it('keeps Nassih Ahh as printed suit', () => {
    const trump = 'spades';
    const nassihAhh = card('J', 'C');
    expect(effectiveSuit(nassihAhh, trump)).toBe('clubs');
  });

  it('follows trump for Nassih', () => {
    const trump = 'hearts';
    const nassih = card('J', 'H');
    expect(effectiveSuit(nassih, trump)).toBe('hearts');
  });
});

describe('ace draw snapshots', () => {
  it('exposes the dealer draw order in the snapshot', () => {
    const state = createMatch({ decks: [aceDrawDeck, handDeck] });
    const snapshot = getSnapshot(state, 'A');
    expect(snapshot.aceDraw).toEqual({
      gameIndex: 0,
      dealer: 'C',
      draws: [
        { player: 'A', card: card('9', 'C') },
        { player: 'C', card: card('9', 'D') },
        { player: 'B', card: card('9', 'H') },
        { player: 'D', card: card('9', 'S') },
        { player: 'A', card: card('10', 'C') },
        { player: 'C', card: card('A', 'D') },
      ],
    });
  });

  it('clears the ace deck after advancing beyond a hand score', () => {
    const state = createMatch({ decks: [aceDrawDeck, handDeck] });
    const handScoreState = {
      ...state,
      phase: 'HandScore' as const,
      scores: { NorthSouth: 5, EastWest: 2 },
    };
    const advanced = advanceState(handScoreState);
    expect(advanced.aceDeck).toBeNull();
  });
});

describe('kitty flow and forced accept', () => {
  it('forces the initial offeree to accept after four passes and prevents discarding the kitty card', () => {
    let state = createMatch({ decks: [aceDeck, handDeck] });
    expect(state.phase).toBe('KittyDecision');
    const passes: PlayerId[] = ['C', 'B', 'D', 'A'];
    for (const player of passes) {
      const result = handleKittyDecision(state, player, false);
      expect(result.ok).toBe(true);
      state = unwrap(result);
    }
    expect(state.hand.forcedAccept).toBe(true);
    expect(state.hand.kittyOfferee).toBe('C');

    const forcedPass = handleKittyDecision(state, 'C', false);
    expect(forcedPass.ok).toBe(false);

    const accept = handleKittyDecision(state, 'C', true);
    expect(accept.ok).toBe(true);
    state = unwrap(accept);
    expect(state.phase).toBe('Discard');
    expect(state.hand.hands.C).toHaveLength(6);

    const kittyCard = state.hand.pickedFromKitty!;
    const badDiscard = handleDiscard(state, 'C', kittyCard);
    expect(badDiscard.ok).toBe(false);

    const goodDiscard = handleDiscard(state, 'C', card('9', 'C'));
    expect(goodDiscard.ok).toBe(true);
    state = unwrap(goodDiscard);
    expect(state.hand.hands.C).toHaveLength(5);
  });

  it('plays a full scripted hand with boomerang acceptance and awards a single team', () => {
    let state = createMatch({ decks: [aceDeck, handDeck] });
    const passers: PlayerId[] = ['C', 'B', 'D', 'A'];
    for (const player of passers) {
      state = unwrap(handleKittyDecision(state, player, false));
    }
    state = unwrap(handleKittyDecision(state, 'C', true));
    state = unwrap(handleDiscard(state, 'C', card('9', 'C')));
    state = unwrap(handleDeclareTrump(state, 'A', 'spades'));

    const playSequence: Array<[PlayerId, Card]> = [
      ['A', card('9', 'S')],
      ['B', card('9', 'D')],
      ['D', card('9', 'H')],
      ['C', card('10', 'C')],
      ['A', card('10', 'S')],
      ['B', card('10', 'D')],
      ['D', card('10', 'H')],
      ['C', card('Q', 'C')],
      ['A', card('Q', 'S')],
      ['B', card('Q', 'D')],
      ['D', card('Q', 'H')],
      ['C', card('K', 'C')],
      ['A', card('K', 'S')],
      ['B', card('K', 'D')],
      ['D', card('K', 'H')],
      ['C', card('A', 'C')],
      ['A', card('A', 'S')],
      ['B', card('A', 'D')],
      ['D', card('A', 'H')],
      ['C', card('J', 'C')],
    ];

    for (const [player, playCard] of playSequence) {
      const result = handlePlayCard(state, player, playCard);
      expect(result.ok).toBe(true);
      state = unwrap(result);
    }

    expect(state.phase).toBe('HandScore');
    expect(state.lastHandSummary).toMatchObject({
      winningTeam: 'NorthSouth',
      points: 2,
      euchred: false,
      tricksWon: { NorthSouth: 4, EastWest: 1 },
    });
    expect(state.scores).toEqual({ NorthSouth: 2, EastWest: 0 });
  });
});

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function generateDeck(seed: number): Card[] {
  const rng = seededRandom(seed);
  const deck = createDeck();
  const result: Card[] = [];
  const pool = [...deck];
  while (pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [removed] = pool.splice(index, 1);
    result.push(removed);
  }
  return result;
}

describe('random hand simulations', () => {
  it('rejects off-suit plays when suit is available and completes hands', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1000 }), (seed) => {
        let state = createMatch({ decks: [generateDeck(seed), generateDeck(seed + 1)] });
        let handCompleted = false;
        while (!handCompleted) {
          if (state.phase === 'KittyDecision') {
            const current = state.hand.kittyOfferee!;
            const forced = state.hand.forcedAccept && current === state.hand.initialOfferee;
            const accept = forced || current === state.dealer;
            const decision = handleKittyDecision(state, current, accept);
            state = unwrap(decision);
          } else if (state.phase === 'Discard') {
            const acceptor = state.hand.acceptor!;
            const discardCard = state.hand.hands[acceptor].find(
              (c) => !state.hand.pickedFromKitty || c.rank !== state.hand.pickedFromKitty.rank || c.suit !== state.hand.pickedFromKitty.suit,
            );
            if (!discardCard) {
              throw new Error('No discard available');
            }
            const discard = handleDiscard(state, acceptor, discardCard);
            state = unwrap(discard);
          } else if (state.phase === 'TrumpDeclaration') {
            const dealer = state.dealer;
            const suit = state.hand.hands[dealer][0]?.suit ?? 'clubs';
            const declaration = handleDeclareTrump(state, dealer, suit);
            state = unwrap(declaration);
          } else if (state.phase === 'TrickPlay') {
            const trick = state.hand.currentTrick!;
            const seating = state.seating;
            const leaderIndex = seating.indexOf(trick.leader);
            const turnIndex = (leaderIndex + trick.cards.length) % seating.length;
            const currentPlayer = seating[turnIndex];
            const snapshot = getSnapshot(state, currentPlayer);
            const legal = snapshot.legalCards;
            expect(legal.length).toBeGreaterThan(0);
            const handCards = [...state.hand.hands[currentPlayer]];
            const illegal = handCards.find(
              (cardOption) => !legal.some((legalCard) => legalCard.rank === cardOption.rank && legalCard.suit === cardOption.suit),
            );
            if (illegal) {
              const attempt = handlePlayCard(state, currentPlayer, illegal);
              expect(attempt.ok).toBe(false);
            }
            const play = handlePlayCard(state, currentPlayer, legal[0]);
            state = unwrap(play);
          } else if (state.phase === 'HandScore') {
            handCompleted = true;
          } else {
            state = advanceState(state);
          }
        }
        expect(state.hand.completedTricks).toHaveLength(5);
      }),
    );
  });
});

describe('game termination', () => {
  it('stops the game once a team reaches ten points', () => {
    const decks: Card[][] = [aceDeck];
    for (let i = 0; i < 4; i += 1) {
      decks.push(handDeck);
    }
    let state = createMatch({ decks });
    for (let hand = 0; hand < 4; hand += 1) {
      const passers: PlayerId[] = ['C', 'B', 'D', 'A'];
      for (const player of passers) {
        state = unwrap(handleKittyDecision(state, player, false));
      }
      state = unwrap(handleKittyDecision(state, 'C', true));
      state = unwrap(handleDiscard(state, 'C', card('9', 'C')));
      state = unwrap(handleDeclareTrump(state, 'A', 'spades'));
      const sequence = [
        ['A', card('9', 'S')],
        ['B', card('9', 'D')],
        ['D', card('9', 'H')],
        ['C', card('10', 'C')],
        ['A', card('10', 'S')],
        ['B', card('10', 'D')],
        ['D', card('10', 'H')],
        ['C', card('Q', 'C')],
        ['A', card('Q', 'S')],
        ['B', card('Q', 'D')],
        ['D', card('Q', 'H')],
        ['C', card('K', 'C')],
        ['A', card('K', 'S')],
        ['B', card('K', 'D')],
        ['D', card('K', 'H')],
        ['C', card('A', 'C')],
        ['A', card('A', 'S')],
        ['B', card('A', 'D')],
        ['D', card('A', 'H')],
        ['C', card('J', 'C')],
      ] as Array<[PlayerId, Card]>;
      for (const [player, playCard] of sequence) {
        state = unwrap(handlePlayCard(state, player, playCard));
      }
      expect(state.phase).toBe('HandScore');
      state = advanceState(state);
    }
    expect(state.phase).toBe('GameOver');
    expect(Math.max(state.scores.NorthSouth, state.scores.EastWest)).toBeGreaterThanOrEqual(10);
  });
});
