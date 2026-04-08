export const RULESET_ID = 'hooker_local_v1' as const;

export type Seat = 'you' | 'partner' | 'left' | 'right';
export type TrumpSuit = 'S' | 'H' | 'D' | 'C';
export type Mode = 'hidden' | 'visible';
export type Location = Seat | 'kitty_top' | 'burned_pool' | 'played';
export type Backend = 'exact' | 'monte_carlo';
export type Confidence = 'high' | 'medium' | 'low';

export type Action = { seat: Seat; card: string };
export type ObjectiveConfig = { tricksTarget?: number; riskAversion?: number; preferGuaranteedFloor?: boolean };

export type GameState = {
  ruleset_id: typeof RULESET_ID;
  trump_suit: TrumpSuit;
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
  current_trick: { lead_seat: Seat | null; plays: Array<{ seat: Seat; card: string }> };
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
    timeline_meta?: Array<{ index: number; branch: boolean; checkpoint: boolean }>;
    branch_base_id?: string;
    branch_id?: string;
    [k: string]: unknown;
  };
};

export type PosteriorRequest = { state: GameState; seatPerspective: Seat; backendPreference?: Backend | 'auto'; sampleBudget?: number };
export type CardLocationDistribution = { card: string; probs: Record<Location, number> };
export type PosteriorSummary = {
  backendUsed: Backend;
  seed: number;
  worldsConsidered: number;
  worldsAccepted: number;
  confidence: Confidence;
  diagnostics: { attempted: number; accepted: number; acceptanceRatio: number; backendUsed: Backend; confidence: Confidence };
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

export type EvaluateActionsRequest = { state: GameState; seat: Seat; objective?: ObjectiveConfig; posterior?: PosteriorSummary };
export type EvaluateActionsResponse = {
  ranked: ActionEvaluation[];
  best: ActionEvaluation | null;
  metadata: { backendUsed: Backend; confidence: Confidence; computeMs: number; policy: 'auto_exact_to_mc' | 'forced' };
};

export type InsightCard = { id: string; priority: number; title: string; claim: string; evidence: string; confidence: Confidence; mode: Mode; tags: string[] };
export type GenerateInsightsRequest = { state: GameState; seat: Seat; posterior: PosteriorSummary; evaluation: EvaluateActionsResponse };

export type SummaryIndicator = {
  id: string;
  title: string;
  value: number;
  trendVsPrevious: number;
  confidence: Confidence;
  hint: string;
};

export const ALL_SEATS: Seat[] = ['you', 'partner', 'left', 'right'];
export const ALL_LOCATIONS: Location[] = ['you', 'partner', 'left', 'right', 'kitty_top', 'burned_pool', 'played'];

export function seatHandKey(seat: Seat): keyof GameState['zones'] {
  return `hand_${seat}` as keyof GameState['zones'];
}

export function cloneState<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function cardSuit(card: string): string {
  return card.split('_')[0] ?? '';
}
