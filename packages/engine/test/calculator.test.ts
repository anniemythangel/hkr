import { describe, expect, it } from 'vitest';

import { readFileSync } from 'node:fs';
import {
  RULESET_ID,
  assignCardToZone,
  computePosterior,
  computeSummaryIndicators,
  evaluateActions,
  maskStateForPerspective,
  randomizeScenario,
  resetCalculatorState,
  setMode,
  undo,
  redo,
  validateState,
  type GameState,
} from '../src/calculator';

const cards = [
  'S_J_SHALIT','S_J_BROTHER','S_A','S_K','S_Q','S_10','S_9',
  'H_A','H_K','H_Q','H_J','H_10','H_9',
  'D_A','D_K','D_Q','D_J','D_10','D_9',
  'C_A','C_K','C_Q','C_J','C_10','C_9',
];

function baseState(): GameState {
  return {
    ruleset_id: RULESET_ID,
    trump_suit: 'S',
    mode: 'hidden',
    seats: ['you', 'partner', 'left', 'right'],
    dealer: 'right',
    lead_seat: 'you',
    current_turn: 'you',
    trick_number: 1,
    cards,
    zones: { hand_you: ['S_J_SHALIT', 'S_J_BROTHER', 'S_A', 'C_9', 'H_Q'], hand_partner: ['S_10'], hand_left: [], hand_right: [], kitty_top: 'D_K', burned_pool: [] },
    trick_history: [],
    current_trick: { lead_seat: null, plays: [] },
    constraints: { voids: { you: [], partner: [], left: [], right: [] }, known_locations: { S_J_SHALIT: 'you', S_J_BROTHER: 'you', S_A: 'you', S_10: 'partner', D_K: 'kitty_top' }, forbidden_locations: {} },
    engine: { seed: 42, backend: 'exact', confidence: 'high' },
    ui: { input_mode: 'click' },
  };
}

describe('calculator hardening', () => {
  it('requires trump suit and catches duplicate card placement', () => {
    const s = baseState();
    s.zones.hand_left.push('S_A');
    const result = validateState(s);
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('multiple locations');
  });

  it('hidden mode masks private known assignments before posterior', () => {
    const s = baseState();
    const masked = maskStateForPerspective(s, 'you');
    expect(masked.constraints.known_locations.S_10).toBeUndefined();
    const posterior = computePosterior({ state: s, seatPerspective: 'you', backendPreference: 'exact' });
    const s10 = posterior.cardLocationDistributions.find((d) => d.card === 'S_10')!;
    expect(s10.probs.partner).toBeLessThan(1);
  });

  it('visible mode may use full assignments', () => {
    const s = setMode(baseState(), 'visible');
    const posterior = computePosterior({ state: s, seatPerspective: 'you', backendPreference: 'exact' });
    const s10 = posterior.cardLocationDistributions.find((d) => d.card === 'S_10')!;
    expect(s10.probs.partner).toBe(1);
  });

  it('monte carlo is deterministic by seed and emits diagnostics', () => {
    const s = baseState();
    s.constraints.known_locations = {};
    const a = computePosterior({ state: s, seatPerspective: 'you', backendPreference: 'monte_carlo', sampleBudget: 200 });
    const b = computePosterior({ state: s, seatPerspective: 'you', backendPreference: 'monte_carlo', sampleBudget: 200 });
    expect(a.cardLocationDistributions[0].probs.you).toBe(b.cardLocationDistributions[0].probs.you);
    expect(a.diagnostics.attempted).toBe(200);
  });

  it('evaluation order is stable and includes required metrics', () => {
    const s = baseState();
    const evals = evaluateActions({ state: s, seat: 'you' });
    expect(evals.ranked.length).toBeGreaterThan(0);
    expect(evals.best.probAtLeastXFutureTricks[1]).toBeTypeOf('number');
  });

  it('assignment timeline supports undo/redo', () => {
    let s = baseState();
    s = assignCardToZone(s, 'C_A', 'burned_pool');
    const after = JSON.stringify(s.zones);
    s = undo(s);
    s = redo(s);
    expect(JSON.stringify(s.zones)).toBe(after);
  });

  it('reset and randomize are deterministic', () => {
    const s = randomizeScenario(baseState(), 7);
    const t = randomizeScenario(baseState(), 7);
    expect(s.zones.hand_you).toEqual(t.zones.hand_you);
    const reset = resetCalculatorState(s);
    expect(reset.ui?.timeline_cursor).toBe(0);
  });



  it('golden fixture defines stable response shape metadata', () => {
    const fixture = JSON.parse(readFileSync(new URL('./fixtures/calculator-golden.json', import.meta.url), 'utf-8'));
    expect(fixture.shape.recommendation).toContain('utilityScore');
    expect(fixture.stability.ordering).toBe('utility-floor-risk-lexical');
  });

  it('indicator API recomputes values', () => {
    const s = baseState();
    const first = computeSummaryIndicators(s);
    s.zones.hand_partner.push('S_K');
    const second = computeSummaryIndicators(s, first);
    expect(second.find((x) => x.id === 'partner_high_trump')?.trendVsPrevious).not.toBe(0);
  });
});
