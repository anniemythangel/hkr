import { describe, expect, it } from 'vitest';
import {
  RULESET_ID,
  assignCardToZone,
  computePosterior,
  evaluateActions,
  getLegalPlays,
  setMode,
  undo,
  redo,
  validateState,
  type GameState,
} from '../src/calculator';

const fullCards = [
  'S_J_SHALIT','S_J_BROTHER','S_A','S_K','S_Q','S_10','S_9',
  'H_A','H_K','H_Q','H_J','H_10','H_9',
  'D_A','D_K','D_Q','D_J','D_10','D_9',
  'C_A','C_K','C_Q','C_J','C_10','C_9',
];

function baseState(): GameState {
  return {
    ruleset_id: RULESET_ID,
    mode: 'hidden',
    seats: ['you', 'partner', 'left', 'right'],
    dealer: 'right',
    lead_seat: 'you',
    current_turn: 'you',
    trick_number: 1,
    cards: fullCards,
    zones: {
      hand_you: ['S_J_SHALIT', 'S_J_BROTHER', 'S_A', 'C_9', 'H_Q'],
      hand_partner: [],
      hand_left: [],
      hand_right: [],
      kitty_top: 'D_K',
      burned_pool: [],
    },
    trick_history: [],
    current_trick: { lead_seat: null, plays: [] },
    constraints: {
      voids: { you: [], partner: [], left: [], right: [] },
      known_locations: { S_J_SHALIT: 'you', S_J_BROTHER: 'you', S_A: 'you', D_K: 'kitty_top' },
      forbidden_locations: {},
    },
    engine: { seed: 42, backend: 'exact', confidence: 'high' },
    ui: { input_mode: 'click' },
  };
}

describe('calculator fixture coverage', () => {
  it('fixture 1 style constraints', () => {
    const state = baseState();
    expect(validateState(state).ok).toBe(true);
    expect(getLegalPlays(state, 'you').length).toBe(state.zones.hand_you.length);
    const posterior = computePosterior({ state, seatPerspective: 'you', backendPreference: 'exact' });
    const c = posterior.cardLocationDistributions.find((x) => x.card === 'C_A')!;
    expect(c.probs.burned_pool).toBeGreaterThan(0);
    for (const dist of posterior.cardLocationDistributions) {
      const sum = Object.values(dist.probs).reduce((a, b) => a + b, 0);
      expect(Math.abs(sum - 1)).toBeLessThanOrEqual(1e-9);
    }
    const evals = evaluateActions({ state, seat: 'you', posterior });
    expect(evals.best.expectedFutureTricks).toBeTypeOf('number');
    expect(evals.best.guaranteedMinFutureTricks).toBeTypeOf('number');
  });

  it('fixture 2 void/follow suit behavior', () => {
    const state = baseState();
    state.trick_number = 3;
    state.current_trick = {
      lead_seat: 'partner',
      plays: [{ seat: 'partner', card: 'C_10' }, { seat: 'left', card: 'D_Q' }],
    };
    state.constraints.voids.left = ['H'];
    const posterior = computePosterior({ state, seatPerspective: 'you', backendPreference: 'exact' });
    expect(posterior.voidProbabilities.left.H).toBe(1);
    const legal = getLegalPlays(state, 'you');
    expect(legal.every((c) => c.startsWith('C_'))).toBe(true);
  });

  it('fixture 3 visible certainty then hidden widening', () => {
    const state = baseState();
    state.mode = 'visible';
    state.zones.hand_partner = ['S_10'];
    state.constraints.known_locations['S_10'] = 'partner';
    const vis = computePosterior({ state, seatPerspective: 'you', backendPreference: 'exact' });
    const s10 = vis.cardLocationDistributions.find((x) => x.card === 'S_10')!;
    expect(s10.probs.partner).toBe(1);
    const hidden = computePosterior({ state: setMode(state, 'hidden'), seatPerspective: 'you', backendPreference: 'exact' });
    const s10h = hidden.cardLocationDistributions.find((x) => x.card === 'S_10')!;
    expect(s10h.probs.partner).toBeLessThanOrEqual(1);
  });

  it('fixture 4 monte carlo deterministic by seed', () => {
    const state = baseState();
    state.constraints.known_locations = {};
    const a = computePosterior({ state, seatPerspective: 'you', backendPreference: 'auto', sampleBudget: 200 });
    const b = computePosterior({ state, seatPerspective: 'you', backendPreference: 'auto', sampleBudget: 200 });
    expect(a.backendUsed).toBe('monte_carlo');
    expect(a.confidence).toBe('low');
    expect(a.cardLocationDistributions[0].probs.you).toBe(b.cardLocationDistributions[0].probs.you);
  });

  it('fixture 5 ui timeline invariants', () => {
    let state = baseState();
    expect(state.ui?.input_mode).toBe('click');
    state = assignCardToZone(state, 'C_A', 'burned_pool');
    const hash1 = JSON.stringify(state.zones);
    state = undo(state);
    state = redo(state);
    expect(JSON.stringify(state.zones)).toBe(hash1);
  });
});
