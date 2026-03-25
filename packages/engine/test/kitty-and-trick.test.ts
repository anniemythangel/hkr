import { describe, expect, it } from 'vitest';
import {
  createMatch,
  getSnapshot,
  handleDeclareTrump,
  handleDiscard,
  handleKittyDecision,
  handlePlayCard,
} from '@hooker/engine';
import type { Card, PlayerId } from '@hooker/shared';
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
  if (!result.ok) throw new Error(result.error);
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

describe('accepted kitty card snapshots', () => {
  it('exposes accepted kitty card after acceptance and through trick play', () => {
    let state = createMatch({ decks: [aceDeck, handDeck] });
    expect(state.phase).toBe('KittyDecision');

    state = unwrap(handleKittyDecision(state, 'C', true));
    expect(state.phase).toBe('Discard');

    for (const viewer of ['A', 'B', 'C', 'D'] as PlayerId[]) {
      const snapshot = getSnapshot(state, viewer);
      expect(snapshot.acceptedKittyCard).toEqual(card('J', 'C'));
      expect(snapshot.kittyTopCard).toBeNull();
    }

    state = unwrap(handleDiscard(state, 'C', card('9', 'C')));
    expect(state.phase).toBe('TrumpDeclaration');
    expect(getSnapshot(state, 'A').acceptedKittyCard).toEqual(card('J', 'C'));

    state = unwrap(handleDeclareTrump(state, 'A', 'spades'));
    expect(state.phase).toBe('TrickPlay');
    expect(getSnapshot(state, 'D').acceptedKittyCard).toEqual(card('J', 'C'));

    state = unwrap(handlePlayCard(state, 'A', card('9', 'S')));
    expect(getSnapshot(state, 'B').acceptedKittyCard).toEqual(card('J', 'C'));
  });
});
