import { Card, PlayerId, Suit } from '@hooker/shared';
import { RANK_ORDER, TRUMP_ORDER } from './constants';
import { getNassih, getNassihAhh } from './utils';

export function cardEquals(a: Card, b: Card) {
  return a.rank === b.rank && a.suit === b.suit;
}

export function effectiveSuit(card: Card, trump: Suit): Suit {
  if (card.rank === 'J' && card.suit === trump) {
    return trump;
  }
  return card.suit;
}

export function isNassih(card: Card, trump: Suit) {
  return cardEquals(card, getNassih(trump));
}

export function isNassihAhh(card: Card, trump: Suit) {
  return cardEquals(card, getNassihAhh(trump));
}

export function determineTrickWinner(
  cards: { player: PlayerId; card: Card }[],
  trump: Suit,
): PlayerId {
  const nassih = cards.find(({ card }) => isNassih(card, trump));
  if (nassih) {
    return nassih.player;
  }

  const nassihAhh = cards.find(({ card }) => isNassihAhh(card, trump));
  if (nassihAhh) {
    return nassihAhh.player;
  }

  const trumpCards = cards.filter(({ card }) => card.suit === trump);
  if (trumpCards.length > 0) {
    return trumpCards.reduce((best, current) => {
      if (!best) return current;
      return TRUMP_ORDER[current.card.rank] > TRUMP_ORDER[best.card.rank] ? current : best;
    }).player;
  }

  const ledSuit = effectiveSuit(cards[0].card, trump);
  const ledCards = cards.filter(({ card }) => effectiveSuit(card, trump) === ledSuit);
  return ledCards.reduce((best, current) => {
    if (!best) return current;
    return RANK_ORDER[current.card.rank] > RANK_ORDER[best.card.rank] ? current : best;
  }).player;
}

export function canFollowSuit(hand: Card[], suit: Suit, trump: Suit) {
  return hand.some((card) => effectiveSuit(card, trump) === suit);
}
