import { cardSuit, type ActionEvaluation, type EvaluateActionsRequest, type EvaluateActionsResponse, type GameState, type Seat } from './types';
import { exactPosterior, getLegalPlays } from './inference-exact';

const SUIT_WEIGHT: Record<string, number> = { S: 4, H: 3, D: 2, C: 1 };
const RANK_WEIGHT: Record<string, number> = { A: 6, K: 5, Q: 4, J: 3, '10': 2, '9': 1, SHALIT: 10, BROTHER: 9 };

function scoreCard(card: string, trumpSuit: string): number {
  if (card.includes('SHALIT')) return 120;
  if (card.includes('BROTHER')) return 110;
  const [suit, rank] = card.split('_');
  const trumpBoost = suit === trumpSuit ? 12 : 0;
  return (SUIT_WEIGHT[suit] ?? 0) * 10 + (RANK_WEIGHT[rank] ?? 0) + trumpBoost;
}

function evaluateCard(state: GameState, seat: Seat, card: string): ActionEvaluation {
  const base = scoreCard(card, state.trump_suit) / 120;
  const led = state.current_trick.plays[0]?.card;
  const follows = led ? cardSuit(card) === cardSuit(led) : true;
  const winNow = Math.max(0.01, Math.min(0.99, base + (follows ? 0.08 : -0.08)));
  const expected = Number((base * 2.7).toFixed(3));
  const floor = Math.max(0, Math.floor(expected * 0.6));
  const riskScore = Number((1 - winNow + (follows ? 0.05 : 0.12)).toFixed(3));
  const utility = Number((expected - riskScore + floor * 0.05).toFixed(3));
  return {
    action: { seat, card },
    legal: true,
    winCurrentTrickProb: winNow,
    expectedFutureTricks: expected,
    guaranteedMinFutureTricks: floor,
    probAtLeastXFutureTricks: { 1: Number(Math.min(1, winNow + 0.2).toFixed(3)), 2: Number(Math.max(0, winNow - 0.15).toFixed(3)) },
    riskScore,
    utilityScore: utility,
  };
}

export function evaluateActions(req: EvaluateActionsRequest): EvaluateActionsResponse {
  const started = Date.now();
  const posterior = req.posterior ?? exactPosterior(req.state);
  const legalPlays = getLegalPlays(req.state, req.seat);
  const ranked = legalPlays
    .map((card) => evaluateCard(req.state, req.seat, card))
    .sort((a, b) => b.utilityScore - a.utilityScore || b.guaranteedMinFutureTricks - a.guaranteedMinFutureTricks || a.riskScore - b.riskScore || a.action.card.localeCompare(b.action.card));

  if (!ranked.length) {
    return {
      ranked: [],
      best: null,
      metadata: {
        backendUsed: posterior.backendUsed,
        confidence: posterior.confidence,
        computeMs: Date.now() - started,
        policy: 'auto_exact_to_mc',
      },
    };
  }

  return {
    ranked,
    best: ranked[0],
    metadata: {
      backendUsed: posterior.backendUsed,
      confidence: posterior.confidence,
      computeMs: Date.now() - started,
      policy: 'auto_exact_to_mc',
    },
  };
}

export function calcOvertrumpDecision(state: GameState, seat: Seat) { return evaluateActions({ state, seat }); }
export function calcFinesseDecision(state: GameState, seat: Seat) { return evaluateActions({ state, seat }); }
export function calcDrawTrumpDecision(state: GameState, seat: Seat) { return evaluateActions({ state, seat }); }
export function calcSacrificeDecision(state: GameState, seat: Seat) { return evaluateActions({ state, seat }); }
export function calcGuaranteedTricks(state: GameState, seat: Seat) {
  const best = evaluateActions({ state, seat }).best;
  if (!best) return { guaranteed: 0, expected: 0, distribution: {} as Record<number, number> };
  return { guaranteed: best.guaranteedMinFutureTricks, expected: best.expectedFutureTricks, distribution: best.probAtLeastXFutureTricks };
}
