import { evaluateActions } from './evaluate';
import { exactPosterior, getLegalPlays } from './inference-exact';
import { monteCarloPosterior } from './inference-mc';
import { computeSummaryIndicators } from './indicators';
import { generateInsights } from './insights';
import { maskStateForPerspective } from './mask';
import { randomizeScenario, resetCalculatorState } from './randomize';
import { assignCardToZone, branchScenario, jumpToTimeline, redo, setMode, undo, unassignCard } from './timeline';
import { type PosteriorRequest } from './types';
import { validateState } from './validate';

export * from './types';
export {
  validateState,
  maskStateForPerspective,
  getLegalPlays,
  evaluateActions,
  generateInsights,
  computeSummaryIndicators,
  assignCardToZone,
  unassignCard,
  setMode,
  undo,
  redo,
  jumpToTimeline,
  branchScenario,
  randomizeScenario,
  resetCalculatorState,
};

export function computePosterior(req: PosteriorRequest) {
  const masked = maskStateForPerspective(req.state, req.seatPerspective);
  const unknownCards = masked.cards.filter((c) => !masked.constraints.known_locations[c]).length;
  const backend = req.backendPreference && req.backendPreference !== 'auto' ? req.backendPreference : unknownCards > 10 ? 'monte_carlo' : 'exact';
  return backend === 'exact' ? exactPosterior(masked) : monteCarloPosterior(masked, req.sampleBudget ?? 1500);
}

export {
  exactPosterior,
  monteCarloPosterior,
};

export function calcOvertrumpDecision(state: import('./types').GameState, seat: import('./types').Seat) { return evaluateActions({ state, seat }); }
export function calcFinesseDecision(state: import('./types').GameState, seat: import('./types').Seat) { return evaluateActions({ state, seat }); }
export function calcDrawTrumpDecision(state: import('./types').GameState, seat: import('./types').Seat) { return evaluateActions({ state, seat }); }
export function calcSacrificeDecision(state: import('./types').GameState, seat: import('./types').Seat) { return evaluateActions({ state, seat }); }
export function calcGuaranteedTricks(state: import('./types').GameState, seat: import('./types').Seat) {
  const best = evaluateActions({ state, seat }).best;
  if (!best) return { guaranteed: 0, expected: 0, distribution: {} as Record<number, number> };
  return { guaranteed: best.guaranteedMinFutureTricks, expected: best.expectedFutureTricks, distribution: best.probAtLeastXFutureTricks };
}
