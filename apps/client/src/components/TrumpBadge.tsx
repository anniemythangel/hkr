import type { Suit } from '@hooker/shared';
import { suitFull } from '../utils/cardAssets';

const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

interface TrumpBadgeProps {
  suit: Suit;
}

export function TrumpBadge({ suit }: TrumpBadgeProps) {
  const label = `${suitFull(suit)} trump`;
  return (
    <span className="trump-badge" role="status" aria-label={label}>
      <span className="trump-symbol" aria-hidden="true">
        {SUIT_SYMBOL[suit]}
      </span>
      <span className="trump-text">{suitFull(suit)}</span>
    </span>
  );
}

export default TrumpBadge;
