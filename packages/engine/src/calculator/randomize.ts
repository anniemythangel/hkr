import { cloneState, type GameState } from './types';
import { assignCardToZone, normalizeTimeline, pushTimeline } from './timeline';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
}

export function resetCalculatorState(canonical: GameState): GameState {
  const reset = cloneState(canonical);
  reset.ui = { input_mode: 'click', selected_card: null, timeline_index: 0 };
  return normalizeTimeline(reset);
}

export function randomizeScenario(state: GameState, seed = state.engine.seed): GameState {
  const rng = makeRng(seed);
  let next = resetCalculatorState(state);
  next.engine.seed = seed;
  const shuffled = [...next.cards].sort(() => rng() - 0.5);
  const you = shuffled.slice(0, 5);
  const partner = shuffled.slice(5, 10);
  const left = shuffled.slice(10, 15);
  const right = shuffled.slice(15, 20);
  const kitty = shuffled[20] ?? null;
  const burned = shuffled.slice(21, 24);

  next.zones.hand_you = [];
  next.zones.hand_partner = [];
  next.zones.hand_left = [];
  next.zones.hand_right = [];
  next.zones.kitty_top = null;
  next.zones.burned_pool = [];
  next.constraints.known_locations = {};
  you.forEach((c) => { next = assignCardToZone(next, c, 'you'); });
  partner.forEach((c) => { next = assignCardToZone(next, c, 'partner'); });
  left.forEach((c) => { next = assignCardToZone(next, c, 'left'); });
  right.forEach((c) => { next = assignCardToZone(next, c, 'right'); });
  if (kitty) next = assignCardToZone(next, kitty, 'kitty_top');
  burned.forEach((c) => { next = assignCardToZone(next, c, 'burned_pool'); });
  return pushTimeline(next, true);
}
