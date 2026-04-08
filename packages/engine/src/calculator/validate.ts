import { ALL_LOCATIONS, ALL_SEATS, type GameState, type Location, seatHandKey } from './types';

const CAPACITY: Record<Location, number> = {
  you: 5,
  partner: 5,
  left: 5,
  right: 5,
  kitty_top: 1,
  burned_pool: 3,
  played: 25,
};

export function validateState(state: GameState): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  if (state.ruleset_id !== 'hooker_local_v1') errors.push('ruleset_id must be hooker_local_v1');
  if (!state.trump_suit) errors.push('trump_suit is required');
  if (state.mode !== 'hidden' && state.mode !== 'visible') errors.push('mode invalid');
  if (JSON.stringify(state.seats) !== JSON.stringify(ALL_SEATS)) errors.push('seats must be canonical');

  const zoneMap = new Map<string, Location>();
  const addCard = (card: string, loc: Location) => {
    if (!state.cards.includes(card)) errors.push(`unknown card ${card}`);
    const prev = zoneMap.get(card);
    if (prev && prev !== loc) errors.push(`card ${card} assigned to multiple locations`);
    zoneMap.set(card, loc);
  };

  for (const s of ALL_SEATS) {
    const hand = state.zones[seatHandKey(s)] as string[];
    if (hand.length > CAPACITY[s]) errors.push(`${s} exceeds capacity`);
    hand.forEach((c) => addCard(c, s));
  }
  if (state.zones.kitty_top) addCard(state.zones.kitty_top, 'kitty_top');
  if (state.zones.burned_pool.length > CAPACITY.burned_pool) errors.push('burned_pool max 3 cards');
  state.zones.burned_pool.forEach((c) => addCard(c, 'burned_pool'));
  state.trick_history.forEach((t) => t.plays.forEach((p) => addCard(p.card, 'played')));
  state.current_trick.plays.forEach((p) => addCard(p.card, 'played'));

  for (const [card, loc] of Object.entries(state.constraints.known_locations)) {
    if (!ALL_LOCATIONS.includes(loc)) errors.push(`known location invalid for ${card}`);
    if (zoneMap.has(card) && zoneMap.get(card) !== loc) errors.push(`known location conflict for ${card}`);
  }
  for (const [card, forbidden] of Object.entries(state.constraints.forbidden_locations)) {
    if (forbidden.some((f) => !ALL_LOCATIONS.includes(f))) errors.push(`forbidden location invalid for ${card}`);
    if (state.constraints.known_locations[card] && forbidden.includes(state.constraints.known_locations[card])) {
      errors.push(`card ${card} cannot be both known and forbidden at same location`);
    }
  }

  return { ok: errors.length === 0, errors };
}
