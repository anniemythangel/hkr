// apps/client/src/utils/cardAssets.ts
import type { Card, Suit } from '@hooker/shared';

const suitLetter: Record<'S' | 'H' | 'D' | 'C', 'S' | 'H' | 'D' | 'C'> = {
  S: 'S',
  H: 'H',
  D: 'D',
  C: 'C',
};

const rankToAsset: Record<Card['rank'], 'A' | 'K' | 'Q' | 'J' | 'T' | '9'> = {
  A: 'A',
  K: 'K',
  Q: 'Q',
  J: 'J',
  '10': 'T',
  '9': '9',
};

const suitFullLabel: Record<Suit, 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs'> = {
  spades: 'Spades',
  hearts: 'Hearts',
  diamonds: 'Diamonds',
  clubs: 'Clubs',
};

export function suitFull(suit: Suit) {
  return suitFullLabel[suit];
}

export function cardAssetUrl(card: Card) {
  const suitKey = card.suit.charAt(0).toUpperCase() as keyof typeof suitLetter;
  return `/cards/${rankToAsset[card.rank]}${suitLetter[suitKey]}.svg`;
}
