import type { Suit } from '../types/game';

export const suitToIcon = (suit: Suit) => {
  switch (suit) {
    case 'clubs':
      return '♣';
    case 'diamonds':
      return '♦';
    case 'hearts':
      return '♥';
    case 'spades':
      return '♠';
    default:
      return '?';
  }
};

export const suitToLabel = (suit: Suit) => suit.charAt(0).toUpperCase() + suit.slice(1);
