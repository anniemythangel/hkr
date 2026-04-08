import { cloneState, type GameState, type Location, type Mode } from './types';

export function normalizeTimeline(state: GameState): GameState {
  const copy = cloneState(state);
  copy.ui = copy.ui ?? {};
  if (!copy.ui.timeline || copy.ui.timeline.length === 0) {
    copy.ui.timeline = [cloneState({ ...copy, ui: { ...copy.ui, timeline: undefined } })];
    copy.ui.timeline_cursor = 0;
    copy.ui.timeline_meta = [{ index: 0, branch: false, checkpoint: true }];
  }
  copy.ui.timeline_index = copy.ui.timeline_cursor ?? 0;
  copy.ui.selected_card = copy.ui.selected_card ?? null;
  return copy;
}

function unassignCardRaw(state: GameState, card: string): GameState {
  state.zones.hand_you = state.zones.hand_you.filter((c) => c !== card);
  state.zones.hand_partner = state.zones.hand_partner.filter((c) => c !== card);
  state.zones.hand_left = state.zones.hand_left.filter((c) => c !== card);
  state.zones.hand_right = state.zones.hand_right.filter((c) => c !== card);
  state.zones.burned_pool = state.zones.burned_pool.filter((c) => c !== card);
  if (state.zones.kitty_top === card) state.zones.kitty_top = null;
  delete state.constraints.known_locations[card];
  return state;
}

export function pushTimeline(state: GameState, checkpoint = false): GameState {
  const next = normalizeTimeline(state);
  const cursor = next.ui!.timeline_cursor ?? 0;
  const timeline = next.ui!.timeline!.slice(0, cursor + 1);
  timeline.push(cloneState({ ...next, ui: { ...next.ui, timeline: undefined, timeline_cursor: undefined, timeline_meta: undefined } }));
  next.ui!.timeline = timeline;
  next.ui!.timeline_cursor = timeline.length - 1;
  next.ui!.timeline_index = next.ui!.timeline_cursor;
  next.ui!.timeline_meta = [...(next.ui!.timeline_meta ?? []), { index: next.ui!.timeline_cursor, branch: !!next.ui!.branch_id, checkpoint }];
  return next;
}

export function assignCardToZone(state: GameState, card: string, zone: Location): GameState {
  const next = normalizeTimeline(cloneState(state));
  unassignCardRaw(next, card);
  if (zone === 'played') return pushTimeline(next, true);
  if (zone === 'kitty_top') {
    if (next.zones.kitty_top) throw new Error('kitty_top already assigned');
    next.zones.kitty_top = card;
  } else if (zone === 'burned_pool') {
    if (next.zones.burned_pool.length >= 3) throw new Error('burned_pool full');
    next.zones.burned_pool.push(card);
  } else {
    const hand = next.zones[`hand_${zone}`];
    if (hand.length >= 5) throw new Error(`${zone} hand is full`);
    hand.push(card);
  }
  next.constraints.known_locations[card] = zone;
  next.ui!.selected_card = null;
  return pushTimeline(next);
}

export function unassignCard(state: GameState, card: string): GameState {
  return unassignCardRaw(cloneState(state), card);
}

export function setMode(state: GameState, mode: Mode): GameState {
  const next = cloneState(state);
  next.mode = mode;
  return pushTimeline(next, true);
}

export function undo(state: GameState): GameState {
  const next = normalizeTimeline(state);
  return jumpToTimeline(next, Math.max(0, (next.ui!.timeline_cursor ?? 0) - 1));
}
export function redo(state: GameState): GameState {
  const next = normalizeTimeline(state);
  return jumpToTimeline(next, Math.min(next.ui!.timeline!.length - 1, (next.ui!.timeline_cursor ?? 0) + 1));
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
  const next = normalizeTimeline(cloneState(state));
  const baseId = `base-${next.engine.seed}-${next.ui!.timeline_cursor ?? 0}`;
  const branchId = `branch-${(next.ui!.timeline_cursor ?? 0) + 1}`;
  next.ui!.branch_base_id = baseId;
  next.ui!.branch_id = branchId;
  return { baseId, branchId, state: pushTimeline(next, true) };
}
