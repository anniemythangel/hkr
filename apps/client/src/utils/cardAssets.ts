// apps/client/src/utils/cardAssets.ts
import type { Card, Suit } from '@hooker/shared';

function suitToLetter(suit: Suit): 'S' | 'H' | 'D' | 'C' {
  const s = String(suit).toLowerCase();
  if (s.startsWith('s')) return 'S';
  if (s.startsWith('h')) return 'H';
  if (s.startsWith('d')) return 'D';
  return 'C';
}

export function suitFull(suit: Suit): 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs' {
  const s = String(suit).toLowerCase();
  if (s.startsWith('s')) return 'Spades';
  if (s.startsWith('h')) return 'Hearts';
  if (s.startsWith('d')) return 'Diamonds';
  return 'Clubs';
}

function rankToAsset(rank: Card['rank']): 'A'|'K'|'Q'|'J'|'T'|'9' {
  // Your SVGs use "T" for tens
  return rank === '10' ? 'T' : (rank as any); // 'A','K','Q','J','9'
}

export function cardAssetUrl(card: Card) {
  // Served from /public/cards -> URL path starts at /cards
  return `/cards/${rankToAsset(card.rank)}${suitToLetter(card.suit)}.svg`;
}
