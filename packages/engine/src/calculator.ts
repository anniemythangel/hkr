export * from './calculator/index';

import { cardSuit, seatHandKey, type Action, type GameState, type Seat } from './calculator/types';

function scoreCard(card: string): number {
  if (card.includes('SHALIT')) return 100;
  if (card.includes('BROTHER')) return 95;
  const [suit, rank] = card.split('_');
  const suitWeight: Record<string, number> = { S: 4, H: 3, D: 2, C: 1 };
  const rankWeight: Record<string, number> = { A: 6, K: 5, Q: 4, J: 3, '10': 2, '9': 1 };
  return (suitWeight[suit] ?? 0) * 10 + (rankWeight[rank] ?? 0);
}

export function resolveTrickWinner(_state: GameState, trick: { lead_seat: Seat; plays: Array<{ seat: Seat; card: string }> }): Seat {
  if (!trick.plays.length) return trick.lead_seat;
  const ledSuit = cardSuit(trick.plays[0].card);
  let winner = trick.plays[0];
  let best = scoreCard(winner.card);
  for (const play of trick.plays.slice(1)) {
    const valid = cardSuit(play.card) === ledSuit || play.card.includes('SHALIT') || play.card.includes('BROTHER');
    const v = valid ? scoreCard(play.card) : -1;
    if (v > best) {
      winner = play;
      best = v;
    }
  }
  return winner.seat;
}

export function applyPlay(state: GameState, action: Action): GameState {
  const next: GameState = JSON.parse(JSON.stringify(state));
  const hand = next.zones[seatHandKey(action.seat)] as string[];
  const idx = hand.indexOf(action.card);
  if (idx === -1) throw new Error('illegal play');
  hand.splice(idx, 1);
  if (!next.current_trick.lead_seat) next.current_trick.lead_seat = action.seat;
  next.current_trick.plays.push({ seat: action.seat, card: action.card });
  if (next.current_trick.plays.length === 4 && next.current_trick.lead_seat) {
    const winner = resolveTrickWinner(next, { lead_seat: next.current_trick.lead_seat, plays: next.current_trick.plays });
    next.trick_history.push({ index: next.trick_number, lead_seat: next.current_trick.lead_seat, plays: [...next.current_trick.plays], winner_seat: winner });
    next.trick_number += 1;
    next.current_trick = { lead_seat: null, plays: [] };
    next.current_turn = winner;
  }
  return next;
}
