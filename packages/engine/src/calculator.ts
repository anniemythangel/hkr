export const RULESET_ID = 'hooker_local_v1' as const;

export type Seat = 'you' | 'partner' | 'left' | 'right';
export type Mode = 'hidden' | 'visible';
export type Location = Seat | 'kitty_top' | 'burned_pool' | 'played';
export type Backend = 'exact' | 'monte_carlo';
export type Confidence = 'high' | 'medium' | 'low';

export type Action = { seat: Seat; card: string };

export type ObjectiveConfig = {
  tricksTarget?: number;
  riskAversion?: number;
  preferGuaranteedFloor?: boolean;
};

export type GameState = {
  ruleset_id: typeof RULESET_ID;
  mode: Mode;
  seats: Seat[];
  dealer?: Seat;
  lead_seat?: Seat;
  current_turn: Seat;
  trick_number: number;
  cards: string[];
  zones: {
    hand_you: string[];
    hand_partner: string[];
    hand_left: string[];
    hand_right: string[];
    kitty_top: string | null;
    burned_pool: string[];
  };
  trick_history: Array<{
    index: number;
    lead_seat: Seat;
    plays: Array<{ seat: Seat; card: string }>;
    winner_seat: Seat;
  }>;
  current_trick: {
    lead_seat: Seat | null;
    plays: Array<{ seat: Seat; card: string }>;
  };
  constraints: {
    voids: Record<Seat, string[]>;
    known_locations: Record<string, Location>;
    forbidden_locations: Record<string, Location[]>;
  };
  engine: { seed: number; backend: Backend; confidence: Confidence };
  ui?: {
    input_mode?: 'click' | 'drag';
    selected_card?: string | null;
    timeline_index?: number;
    timeline?: GameState[];
    timeline_cursor?: number;
    branch_base_id?: string;
    branch_id?: string;
    [k: string]: unknown;
  };
};

export type PosteriorRequest = {
  state: GameState;
  seatPerspective: Seat;
  backendPreference?: Backend | 'auto';
  sampleBudget?: number;
};

export type CardLocationDistribution = {
  card: string;
  probs: Record<Location, number>;
};

export type PosteriorSummary = {
  backendUsed: Backend;
  seed: number;
  worldsConsidered: number;
  worldsAccepted: number;
  confidence: Confidence;
  cardLocationDistributions: CardLocationDistribution[];
  voidProbabilities: Record<Seat, Record<string, number>>;
  keyCardPossession: Record<string, Record<Location, number>>;
};

export type ActionEvaluation = {
  action: Action;
  legal: boolean;
  winCurrentTrickProb: number;
  expectedFutureTricks: number;
  guaranteedMinFutureTricks: number;
  probAtLeastXFutureTricks: Record<number, number>;
  riskScore: number;
  utilityScore: number;
};

export type EvaluateActionsRequest = {
  state: GameState;
  seat: Seat;
  objective?: ObjectiveConfig;
  posterior?: PosteriorSummary;
};

export type EvaluateActionsResponse = {
  ranked: ActionEvaluation[];
  best: ActionEvaluation;
  metadata: {
    backendUsed: Backend;
    confidence: Confidence;
    computeMs: number;
  };
};

export type InsightCard = {
  id: string;
  priority: number;
  title: string;
  claim: string;
  evidence: string;
  confidence: Confidence;
  mode: Mode;
  tags: string[];
};

export type GenerateInsightsRequest = {
  state: GameState;
  seat: Seat;
  posterior: PosteriorSummary;
  evaluation: EvaluateActionsResponse;
};

const ALL_SEATS: Seat[] = ['you', 'partner', 'left', 'right'];
const ALL_LOCATIONS: Location[] = ['you', 'partner', 'left', 'right', 'kitty_top', 'burned_pool', 'played'];

const SUIT_WEIGHT: Record<string, number> = { S: 4, H: 3, D: 2, C: 1 };
const RANK_WEIGHT: Record<string, number> = { A: 6, K: 5, Q: 4, J: 3, '10': 2, '9': 1 };

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function cardSuit(card: string): string {
  return card.split('_')[0] ?? '';
}

function cardRank(card: string): string {
  const parts = card.split('_');
  return parts.length > 1 ? parts[1] : '';
}

function scoreCard(card: string): number {
  if (card.includes('SHALIT')) return 100;
  if (card.includes('BROTHER')) return 95;
  return (SUIT_WEIGHT[cardSuit(card)] ?? 0) * 10 + (RANK_WEIGHT[cardRank(card)] ?? 0);
}

function seatHandKey(seat: Seat): keyof GameState['zones'] {
  return `hand_${seat}` as keyof GameState['zones'];
}

function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state));
}

function normalizeTimeline(state: GameState): GameState {
  const copy = cloneState(state);
  copy.ui = copy.ui ?? {};
  if (!copy.ui.timeline || copy.ui.timeline.length === 0) {
    copy.ui.timeline = [cloneState({ ...copy, ui: { ...copy.ui, timeline: undefined } })];
    copy.ui.timeline_cursor = 0;
  }
  copy.ui.input_mode = copy.ui.input_mode ?? 'click';
  copy.ui.timeline_index = copy.ui.timeline_cursor ?? 0;
  return copy;
}

export function validateState(state: GameState): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (state.ruleset_id !== RULESET_ID) errors.push('ruleset_id must be hooker_local_v1');
  if (!['hidden', 'visible'].includes(state.mode)) errors.push('mode invalid');
  if (JSON.stringify(state.seats) !== JSON.stringify(ALL_SEATS)) errors.push('seats must be canonical');
  if (state.trick_number < 1) errors.push('trick_number must be >= 1');
  const zoneCards = [
    ...state.zones.hand_you,
    ...state.zones.hand_partner,
    ...state.zones.hand_left,
    ...state.zones.hand_right,
    ...(state.zones.kitty_top ? [state.zones.kitty_top] : []),
    ...state.zones.burned_pool,
    ...state.trick_history.flatMap((t) => t.plays.map((p) => p.card)),
    ...state.current_trick.plays.map((p) => p.card),
  ];
  const dupes = zoneCards.filter((c, i) => zoneCards.indexOf(c) !== i);
  if (dupes.length) errors.push(`duplicate cards detected: ${[...new Set(dupes)].join(',')}`);
  if (state.zones.burned_pool.length > 3) errors.push('burned_pool max 3 cards');
  for (const [card, loc] of Object.entries(state.constraints.known_locations)) {
    if (!ALL_LOCATIONS.includes(loc)) errors.push(`known location invalid for ${card}`);
  }
  return { ok: errors.length === 0, errors };
}

export function getLegalPlays(state: GameState, seat: Seat): string[] {
  const hand = state.zones[seatHandKey(seat)] as string[];
  if (state.current_trick.plays.length === 0) return [...hand];
  const ledSuit = cardSuit(state.current_trick.plays[0].card);
  const follows = hand.filter((c) => cardSuit(c) === ledSuit);
  return follows.length ? follows : [...hand];
}

export function resolveTrickWinner(
  _state: GameState,
  trick: { lead_seat: Seat; plays: Array<{ seat: Seat; card: string }> },
): Seat {
  if (!trick.plays.length) return trick.lead_seat;
  const ledSuit = cardSuit(trick.plays[0].card);
  let winner = trick.plays[0];
  let best = scoreCard(winner.card);
  for (const play of trick.plays.slice(1)) {
    const s = cardSuit(play.card) === ledSuit || play.card.includes('SHALIT') || play.card.includes('BROTHER')
      ? scoreCard(play.card)
      : -1;
    if (s > best) {
      best = s;
      winner = play;
    }
  }
  return winner.seat;
}

export function applyPlay(state: GameState, action: Action): GameState {
  const next = cloneState(state);
  const legal = getLegalPlays(next, action.seat);
  if (!legal.includes(action.card)) throw new Error('illegal play');
  const hand = next.zones[seatHandKey(action.seat)] as string[];
  const idx = hand.indexOf(action.card);
  hand.splice(idx, 1);
  if (!next.current_trick.lead_seat) next.current_trick.lead_seat = action.seat;
  next.current_trick.plays.push({ seat: action.seat, card: action.card });
  if (next.current_trick.plays.length === 4 && next.current_trick.lead_seat) {
    const winner = resolveTrickWinner(next, {
      lead_seat: next.current_trick.lead_seat,
      plays: next.current_trick.plays,
    });
    next.trick_history.push({
      index: next.trick_number,
      lead_seat: next.current_trick.lead_seat,
      plays: [...next.current_trick.plays],
      winner_seat: winner,
    });
    next.trick_number += 1;
    next.current_trick = { lead_seat: null, plays: [] };
    next.current_turn = winner;
  }
  return next;
}

function visibleSanitized(state: GameState): GameState {
  if (state.mode === 'visible') return state;
  const s = cloneState(state);
  s.zones.hand_partner = [];
  s.zones.hand_left = [];
  s.zones.hand_right = [];
  return s;
}

function candidateLocationsForCard(state: GameState, card: string): Location[] {
  const known = state.constraints.known_locations[card];
  if (known) return [known];
  const forbidden = new Set(state.constraints.forbidden_locations[card] ?? []);
  const base = ['you', 'partner', 'left', 'right', 'kitty_top', 'burned_pool'] as Location[];
  return base.filter((l) => !forbidden.has(l));
}

function exactPosterior(state: GameState): PosteriorSummary {
  const distributions: CardLocationDistribution[] = [];
  for (const card of state.cards) {
    const locs = candidateLocationsForCard(state, card);
    const p = 1 / locs.length;
    const probs = Object.fromEntries(ALL_LOCATIONS.map((loc) => [loc, 0])) as Record<Location, number>;
    for (const loc of locs) probs[loc] = p;
    if (state.trick_history.some((t) => t.plays.some((pl) => pl.card === card)) || state.current_trick.plays.some((pl) => pl.card === card)) {
      for (const l of ALL_LOCATIONS) probs[l] = l === 'played' ? 1 : 0;
    }
    distributions.push({ card, probs });
  }
  return {
    backendUsed: 'exact',
    seed: state.engine.seed,
    worldsConsidered: distributions.length,
    worldsAccepted: distributions.length,
    confidence: 'high',
    cardLocationDistributions: distributions,
    voidProbabilities: {
      you: Object.fromEntries(state.constraints.voids.you.map((s) => [s, 1])),
      partner: Object.fromEntries(state.constraints.voids.partner.map((s) => [s, 1])),
      left: Object.fromEntries(state.constraints.voids.left.map((s) => [s, 1])),
      right: Object.fromEntries(state.constraints.voids.right.map((s) => [s, 1])),
    },
    keyCardPossession: Object.fromEntries(
      distributions
        .filter((d) => d.card.includes('J_') || d.card.includes('A'))
        .map((d) => [d.card, d.probs]),
    ),
  };
}

function monteCarloPosterior(state: GameState, sampleBudget = 1000): PosteriorSummary {
  const rng = makeRng(state.engine.seed);
  const counts = new Map<string, Record<Location, number>>();
  for (const card of state.cards) counts.set(card, Object.fromEntries(ALL_LOCATIONS.map((l) => [l, 0])) as Record<Location, number>);
  let accepted = 0;
  for (let i = 0; i < sampleBudget; i++) {
    accepted++;
    for (const card of state.cards) {
      const locs = candidateLocationsForCard(state, card);
      const loc = locs[Math.floor(rng() * locs.length)]!;
      counts.get(card)![loc] += 1;
    }
  }
  const distributions: CardLocationDistribution[] = state.cards.map((card) => {
    const c = counts.get(card)!;
    const probs = Object.fromEntries(ALL_LOCATIONS.map((l) => [l, c[l] / accepted])) as Record<Location, number>;
    return { card, probs };
  });
  return {
    backendUsed: 'monte_carlo',
    seed: state.engine.seed,
    worldsConsidered: sampleBudget,
    worldsAccepted: accepted,
    confidence: sampleBudget >= 2500 ? 'high' : sampleBudget >= 1000 ? 'medium' : 'low',
    cardLocationDistributions: distributions,
    voidProbabilities: {
      you: Object.fromEntries(state.constraints.voids.you.map((s) => [s, 1])),
      partner: Object.fromEntries(state.constraints.voids.partner.map((s) => [s, 1])),
      left: Object.fromEntries(state.constraints.voids.left.map((s) => [s, 1])),
      right: Object.fromEntries(state.constraints.voids.right.map((s) => [s, 1])),
    },
    keyCardPossession: {},
  };
}

export function computePosterior(req: PosteriorRequest): PosteriorSummary {
  const state = visibleSanitized(req.state);
  const unknownCards = state.cards.filter((c) => !state.constraints.known_locations[c]).length;
  const backend = req.backendPreference && req.backendPreference !== 'auto'
    ? req.backendPreference
    : unknownCards > 12
    ? 'monte_carlo'
    : 'exact';
  return backend === 'exact' ? exactPosterior(state) : monteCarloPosterior(state, req.sampleBudget ?? 1500);
}

export function evaluateActions(req: EvaluateActionsRequest): EvaluateActionsResponse {
  const started = Date.now();
  const posterior = req.posterior ?? computePosterior({ state: req.state, seatPerspective: req.seat, backendPreference: 'auto' });
  const objective = { tricksTarget: 1, riskAversion: 0.35, preferGuaranteedFloor: false, ...req.objective };
  const legal = getLegalPlays(req.state, req.seat);
  const ranked = legal.map((card) => {
    const base = scoreCard(card) / 100;
    const winCurrentTrickProb = Math.min(1, Math.max(0, base));
    const expectedFutureTricks = Number((base * 2.5).toFixed(3));
    const guaranteedMinFutureTricks = Math.floor(expectedFutureTricks * 0.5);
    const probAtLeastXFutureTricks: Record<number, number> = {
      [objective.tricksTarget]: Number(Math.min(1, base + 0.2).toFixed(3)),
    };
    const riskScore = Number((1 - winCurrentTrickProb + objective.riskAversion * 0.5).toFixed(3));
    const utilityScore = Number((expectedFutureTricks - riskScore - (objective.preferGuaranteedFloor ? (1 - guaranteedMinFutureTricks) * 0.1 : 0)).toFixed(3));
    return {
      action: { seat: req.seat, card },
      legal: true,
      winCurrentTrickProb,
      expectedFutureTricks,
      guaranteedMinFutureTricks,
      probAtLeastXFutureTricks,
      riskScore,
      utilityScore,
    } satisfies ActionEvaluation;
  }).sort((a, b) => b.utilityScore - a.utilityScore || b.guaranteedMinFutureTricks - a.guaranteedMinFutureTricks || a.riskScore - b.riskScore);

  return {
    ranked,
    best: ranked[0],
    metadata: {
      backendUsed: posterior.backendUsed,
      confidence: posterior.confidence,
      computeMs: Date.now() - started,
    },
  };
}

export function calcOvertrumpDecision(state: GameState, seat: Seat): EvaluateActionsResponse {
  return evaluateActions({ state, seat, objective: { tricksTarget: 1, riskAversion: 0.25 } });
}
export function calcFinesseDecision(state: GameState, seat: Seat): EvaluateActionsResponse {
  return evaluateActions({ state, seat, objective: { tricksTarget: 2, riskAversion: 0.5 } });
}
export function calcDrawTrumpDecision(state: GameState, seat: Seat): EvaluateActionsResponse {
  return evaluateActions({ state, seat, objective: { tricksTarget: 2, riskAversion: 0.3 } });
}
export function calcSacrificeDecision(state: GameState, seat: Seat): EvaluateActionsResponse {
  return evaluateActions({ state, seat, objective: { tricksTarget: 1, riskAversion: 0.8, preferGuaranteedFloor: true } });
}
export function calcGuaranteedTricks(state: GameState, seat: Seat): { guaranteed: number; expected: number; distribution: Record<number, number> } {
  const evals = evaluateActions({ state, seat });
  return {
    guaranteed: evals.best.guaranteedMinFutureTricks,
    expected: evals.best.expectedFutureTricks,
    distribution: evals.best.probAtLeastXFutureTricks,
  };
}

export function generateInsights(req: GenerateInsightsRequest): InsightCard[] {
  const best = req.evaluation.best;
  const control = req.state.zones.hand_you.filter((c) => c.includes('SHALIT') || c.includes('BROTHER')).length;
  return [
    {
      id: 'best-action',
      priority: 1,
      title: 'Best immediate action',
      claim: `Play ${best.action.card} for highest utility.`,
      evidence: `EV=${best.expectedFutureTricks.toFixed(2)}, floor=${best.guaranteedMinFutureTricks}, win-now=${(best.winCurrentTrickProb * 100).toFixed(1)}%`,
      confidence: req.evaluation.metadata.confidence,
      mode: req.state.mode,
      tags: ['recommendation', 'ev', 'floor'],
    },
    {
      id: 'trump-control',
      priority: 2,
      title: 'Trump control signal',
      claim: control > 0 ? 'You hold a top-trump sequence advantage.' : 'No confirmed top-trump sequence in hand.',
      evidence: `Top-trump markers in hand: ${control}`,
      confidence: control > 0 ? 'high' : 'medium',
      mode: req.state.mode,
      tags: ['control', 'trump'],
    },
  ];
}

export function assignCardToZone(state: GameState, card: string, zone: Location): GameState {
  let next = cloneState(normalizeTimeline(state));
  next = unassignCard(next, card);
  if (zone === 'played') return next;
  if (zone === 'kitty_top') next.zones.kitty_top = card;
  else if (zone === 'burned_pool') {
    if (next.zones.burned_pool.length >= 3) throw new Error('burned_pool full');
    next.zones.burned_pool.push(card);
  } else {
    const hand = next.zones[seatHandKey(zone)] as string[];
    hand.push(card);
  }
  next.constraints.known_locations[card] = zone;
  return pushTimeline(next);
}

export function unassignCard(state: GameState, card: string): GameState {
  const next = cloneState(state);
  next.zones.hand_you = next.zones.hand_you.filter((c) => c !== card);
  next.zones.hand_partner = next.zones.hand_partner.filter((c) => c !== card);
  next.zones.hand_left = next.zones.hand_left.filter((c) => c !== card);
  next.zones.hand_right = next.zones.hand_right.filter((c) => c !== card);
  next.zones.burned_pool = next.zones.burned_pool.filter((c) => c !== card);
  if (next.zones.kitty_top === card) next.zones.kitty_top = null;
  delete next.constraints.known_locations[card];
  return next;
}

function pushTimeline(state: GameState): GameState {
  const next = normalizeTimeline(state);
  const timeline = next.ui!.timeline!.slice(0, (next.ui!.timeline_cursor ?? 0) + 1);
  const snapshot = cloneState({ ...next, ui: { ...next.ui, timeline: undefined, timeline_cursor: undefined } });
  timeline.push(snapshot);
  next.ui!.timeline = timeline;
  next.ui!.timeline_cursor = timeline.length - 1;
  next.ui!.timeline_index = next.ui!.timeline_cursor;
  return next;
}

export function setMode(state: GameState, mode: Mode): GameState {
  const next = cloneState(state);
  next.mode = mode;
  return pushTimeline(next);
}

export function undo(state: GameState): GameState {
  const next = normalizeTimeline(state);
  const cursor = Math.max(0, (next.ui!.timeline_cursor ?? 0) - 1);
  return jumpToTimeline(next, cursor);
}

export function redo(state: GameState): GameState {
  const next = normalizeTimeline(state);
  const cursor = Math.min(next.ui!.timeline!.length - 1, (next.ui!.timeline_cursor ?? 0) + 1);
  return jumpToTimeline(next, cursor);
}

export function jumpToTimeline(state: GameState, index: number): GameState {
  const next = normalizeTimeline(state);
  const snap = next.ui!.timeline![index];
  if (!snap) throw new Error('timeline index out of range');
  const cloned = cloneState(snap);
  cloned.ui = next.ui;
  cloned.ui!.timeline_cursor = index;
  cloned.ui!.timeline_index = index;
  return cloned;
}

export function branchScenario(state: GameState): { baseId: string; branchId: string; state: GameState } {
  const next = normalizeTimeline(state);
  const baseId = `base-${next.engine.seed}-${next.ui!.timeline_cursor ?? 0}`;
  const branchId = `branch-${Date.now()}`;
  next.ui!.branch_base_id = baseId;
  next.ui!.branch_id = branchId;
  return { baseId, branchId, state: next };
}
