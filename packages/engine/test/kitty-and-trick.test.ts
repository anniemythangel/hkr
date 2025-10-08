import { describe, it, expect } from 'vitest';
import { startHandForDealer, effectiveSuit, resolveTrick } from '../src'; // adjust imports

describe('Kitty offering order', () => {
  it('offers to the seat left of dealer', () => {
    const h = startHandForDealer(0 /* dealer=A */, 123 /* seed */);
    expect(h.initialOfferee).toBe(1); // B
  });

  it('boomerangs to initial offeree after full pass', () => {
    const h = startHandForDealer(0, 123);
    // simulate A(dealer)-> B pass, C pass, D pass, A pass
    // expect next state to force-accept on B (seat 1)
    // (Call your transition that advances offers and assert forced accept target)
  });
});

describe('Effective suit & trick ranking', () => {
  it('Nassih follows as trump; same-color J follows printed suit', () => {
    // trump = Spades
    const s = 'S';
    expect(effectiveSuit({suit:'S',rank:'J'}, s)).toBe('S'); // Nassih
    expect(effectiveSuit({suit:'C',rank:'J'}, s)).toBe('C'); // Nassih Ahh uses printed suit
  });

  it('Trick hierarchy Nassih > NassihAhh > other trumps > led suit', () => {
    const trump = 'S', led = 'H';
    const winner = resolveTrick(
      [
        {seat:0, card:{suit:'H',rank:'A'}}, // led Ace of hearts
        {seat:1, card:{suit:'S',rank:'J'}}, // Nassih (J of trump)
        {seat:2, card:{suit:'C',rank:'J'}}, // Nassih Ahh (same-color J)
        {seat:3, card:{suit:'S',rank:'A'}}, // other trump
      ],
      led,
      trump
    );
    expect(winner.seat).toBe(1);
  });
});
