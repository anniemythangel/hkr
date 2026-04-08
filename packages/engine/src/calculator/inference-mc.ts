import { ALL_LOCATIONS, ALL_SEATS, cloneState, type Confidence, type GameState, type Location, type PosteriorSummary } from './types';

function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (1664525 * s + 1013904223) >>> 0) / 4294967296);
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function playedSet(state: GameState): Set<string> {
  return new Set([...state.trick_history.flatMap((t) => t.plays.map((p) => p.card)), ...state.current_trick.plays.map((p) => p.card)]);
}

function allowedLocations(state: GameState, card: string): Location[] {
  const played = playedSet(state);
  if (played.has(card)) return ['played'];
  const known = state.constraints.known_locations[card];
  if (known) return [known];
  const forbidden = new Set(state.constraints.forbidden_locations[card] ?? []);
  return (['you', 'partner', 'left', 'right', 'kitty_top', 'burned_pool'] as Location[]).filter((l) => !forbidden.has(l));
}

export function monteCarloPosterior(state: GameState, sampleBudget = 1500): PosteriorSummary {
  const rng = makeRng(state.engine.seed);
  const counts = new Map<string, Record<Location, number>>();
  state.cards.forEach((c) => counts.set(c, Object.fromEntries(ALL_LOCATIONS.map((l) => [l, 0])) as Record<Location, number>));

  let attempted = 0;
  let accepted = 0;
  const baseCaps: Record<Location, number> = {
    you: 5 - state.zones.hand_you.length,
    partner: 5 - state.zones.hand_partner.length,
    left: 5 - state.zones.hand_left.length,
    right: 5 - state.zones.hand_right.length,
    kitty_top: state.zones.kitty_top ? 0 : 1,
    burned_pool: 3 - state.zones.burned_pool.length,
    played: 0,
  };
  const preset: Record<string, Location> = {};
  for (const s of ALL_SEATS) state.zones[`hand_${s}`].forEach((c) => (preset[c] = s));
  if (state.zones.kitty_top) preset[state.zones.kitty_top] = 'kitty_top';
  state.zones.burned_pool.forEach((c) => (preset[c] = 'burned_pool'));
  playedSet(state).forEach((c) => (preset[c] = 'played'));

  for (let i = 0; i < sampleBudget; i++) {
    attempted++;
    const world = cloneState(preset);
    const caps = { ...baseCaps };
    const unknown = shuffle(state.cards.filter((c) => !world[c]), rng);
    let ok = true;
    for (const card of unknown) {
      const choices = shuffle(allowedLocations(state, card).filter((l) => l !== 'played' && caps[l] > 0), rng);
      const pick = choices[0];
      if (!pick) {
        ok = false;
        break;
      }
      world[card] = pick;
      caps[pick] -= 1;
    }
    if (!ok) continue;

    accepted++;
    state.cards.forEach((card) => counts.get(card)![world[card] ?? 'played'] += 1);
  }

  const denom = Math.max(accepted, 1);
  const confidence: Confidence = accepted / Math.max(attempted, 1) > 0.8 ? 'high' : accepted > sampleBudget * 0.35 ? 'medium' : 'low';
  return {
    backendUsed: 'monte_carlo',
    seed: state.engine.seed,
    worldsConsidered: attempted,
    worldsAccepted: accepted,
    confidence,
    diagnostics: {
      attempted,
      accepted,
      acceptanceRatio: attempted ? accepted / attempted : 0,
      backendUsed: 'monte_carlo',
      confidence,
    },
    cardLocationDistributions: state.cards.map((card) => ({ card, probs: Object.fromEntries(ALL_LOCATIONS.map((l) => [l, counts.get(card)![l] / denom])) as Record<Location, number> })),
    voidProbabilities: Object.fromEntries(ALL_SEATS.map((s) => [s, Object.fromEntries(state.constraints.voids[s].map((v) => [v, 1]))])) as PosteriorSummary['voidProbabilities'],
    keyCardPossession: {},
  };
}
