import type { Card, Suit, PlayerId, Trick } from '@hooker/shared';

export function cardEquals(a: Card, b: Card): boolean {
  return a.rank === b.rank && a.suit === b.suit;
}

// Determine if two suits share the same color (black or red).
function sameColor(a: Suit, b: Suit): boolean {
  const isBlack = (suit: Suit) => suit === 'spades' || suit === 'clubs';
  return (isBlack(a) && isBlack(b)) || (!isBlack(a) && !isBlack(b));
}

export function isNassih(card: Card, trump: Suit): boolean {
  // Nassih: the Jack of trump. Always treated as trump for follow/rank.
  return card.rank === 'J' && card.suit === trump;
}

export function isNassihAhh(card: Card, trump: Suit): boolean {
  // Nassih Ahh: Jack of the same color as trump (but not trump itself).
  return card.rank === 'J' && card.suit !== trump && sameColor(card.suit, trump);
}

// FOLLOW-SUIT: Nassih (J of trump) follows trump, while Nassih Ahh follows its printed suit.
export function effectiveSuit(card: Card, trump: Suit): Suit {
  if (isNassih(card, trump)) {
    return trump;
  }
  // Nassih Ahh sticks with its printed suit for follow-suit decisions.
  return card.suit;
}

// Check if any card in hand can follow the led suit given the Nassih/Nassih Ahh behaviour.
export function canFollowSuit(hand: Card[], ledSuit: Suit, trump: Suit): boolean {
  return hand.some((card) => effectiveSuit(card, trump) === ledSuit);
}

// Rank ordering helper arrays for non-Jack trump cards and led-suit cards.
const LED_ORDER: Card['rank'][] = ['A', 'K', 'Q', 'J', '10', '9'];
const TRUMP_ORDER: Card['rank'][] = ['A', 'K', 'Q', '10', '9']; // Jacks handled separately as Nassih / Nassih Ahh.

function trumpStrength(card: Card, trump: Suit): number {
  // Nassih outranks all trump; Nassih Ahh is second-highest trump.
  if (isNassih(card, trump)) {
    return 100;
  }
  if (isNassihAhh(card, trump)) {
    return 90;
  }
  if (card.suit === trump) {
    const idx = TRUMP_ORDER.indexOf(card.rank);
    return idx === -1 ? 0 : 80 - idx;
  }
  return 0;
}

function ledStrength(card: Card, led: Suit): number {
  if (card.suit !== led) {
    return 0;
  }
  const idx = LED_ORDER.indexOf(card.rank);
  return idx === -1 ? 0 : 10 - idx;
}

// Determine the trick winner applying the Nassih/Nassih Ahh trump hierarchy.
export function determineTrickWinner(cards: Trick['cards'], trump: Suit): PlayerId {
  const led = effectiveSuit(cards[0].card, trump);
  let best = cards[0];
  let bestScore = -1;

  for (const entry of cards) {
    // For ranking purposes the Nassih variants behave as trump even when following another suit.
    const trumpScore = trumpStrength(entry.card, trump);
    const score = trumpScore > 0 ? trumpScore : ledStrength(entry.card, led);
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best.player;
}
