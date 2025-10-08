import { describe, expect, it } from 'vitest';
import type { Card, Suit } from '@hooker/shared';
import { effectiveSuit, isNassih, isNassihAhh, canFollowSuit } from '../src/trick';

const C = (rank: Card['rank'], suit: Suit): Card => ({ rank, suit });

describe('Hooker Nassih rules', () => {
  it('Nassih and Nassih Ahh identification', () => {
    expect(isNassih(C('J', 'spades'), 'spades')).toBe(true);
    expect(isNassihAhh(C('J', 'clubs'), 'spades')).toBe(true);
    expect(isNassihAhh(C('J', 'hearts'), 'spades')).toBe(false);
  });

  it('Nassih Ahh follows its printed suit (not trump)', () => {
    const trump: Suit = 'spades';
    const jClub = C('J', 'clubs');
    expect(effectiveSuit(jClub, trump)).toBe('clubs');

    const ledSpade: Suit = 'spades';
    const hand = [jClub];
    expect(canFollowSuit(hand, ledSpade, trump)).toBe(false);
  });
});
