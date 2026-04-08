import { cloneState, type GameState, type Seat } from './types';

export function maskStateForPerspective(state: GameState, seatPerspective: Seat): GameState {
  if (state.mode === 'visible') return cloneState(state);
  const next = cloneState(state);
  const privateSeats = (['you', 'partner', 'left', 'right'] as const).filter((s) => s !== seatPerspective);
  for (const s of privateSeats) {
    next.zones[`hand_${s}`] = [];
  }
  for (const [card, loc] of Object.entries(next.constraints.known_locations)) {
    if (loc !== seatPerspective && loc !== 'played' && loc !== 'kitty_top' && loc !== 'burned_pool') {
      delete next.constraints.known_locations[card];
    }
  }
  return next;
}
