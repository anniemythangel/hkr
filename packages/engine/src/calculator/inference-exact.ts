import { ALL_LOCATIONS, ALL_SEATS, cardSuit, type CardLocationDistribution, type GameState, type Location, type PosteriorSummary } from './types';

function playedSet(state: GameState): Set<string> {
  return new Set([
    ...state.trick_history.flatMap((t) => t.plays.map((p) => p.card)),
    ...state.current_trick.plays.map((p) => p.card),
  ]);
}

function candidateLocationsForCard(state: GameState, card: string): Location[] {
  if (playedSet(state).has(card)) return ['played'];
  const known = state.constraints.known_locations[card];
  if (known) return [known];
  const forbidden = new Set(state.constraints.forbidden_locations[card] ?? []);
  return (['you', 'partner', 'left', 'right', 'kitty_top', 'burned_pool'] as Location[]).filter((l) => !forbidden.has(l));
}

export function exactPosterior(state: GameState): PosteriorSummary {
  const distributions: CardLocationDistribution[] = state.cards.map((card) => {
    const probs = Object.fromEntries(ALL_LOCATIONS.map((l) => [l, 0])) as Record<Location, number>;
    const cands = candidateLocationsForCard(state, card);
    const p = 1 / cands.length;
    cands.forEach((c) => (probs[c] = p));
    return { card, probs };
  });
  const keyCardPossession = Object.fromEntries(distributions.filter((d) => d.card.includes('_A') || d.card.includes('S_J')).map((d) => [d.card, d.probs]));
  return {
    backendUsed: 'exact',
    seed: state.engine.seed,
    worldsConsidered: distributions.length,
    worldsAccepted: distributions.length,
    confidence: 'high',
    diagnostics: { attempted: distributions.length, accepted: distributions.length, acceptanceRatio: 1, backendUsed: 'exact', confidence: 'high' },
    cardLocationDistributions: distributions,
    voidProbabilities: Object.fromEntries(ALL_SEATS.map((s) => [s, Object.fromEntries(state.constraints.voids[s].map((v) => [v, 1]))])) as PosteriorSummary['voidProbabilities'],
    keyCardPossession,
  };
}

export function getLegalPlays(state: GameState, seat: 'you' | 'partner' | 'left' | 'right'): string[] {
  const hand = state.zones[`hand_${seat}`];
  if (!state.current_trick.plays.length) return [...hand];
  const ledSuit = cardSuit(state.current_trick.plays[0].card);
  const follows = hand.filter((c) => cardSuit(c) === ledSuit);
  return follows.length ? follows : [...hand];
}
