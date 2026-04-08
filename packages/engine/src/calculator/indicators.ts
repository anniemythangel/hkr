import { type Confidence, type GameState, type SummaryIndicator } from './types';

function conf(v: number): Confidence {
  if (v > 0.75 || v < 0.25) return 'high';
  if (v > 0.6 || v < 0.4) return 'medium';
  return 'low';
}

export function computeSummaryIndicators(state: GameState, previous?: SummaryIndicator[]): SummaryIndicator[] {
  const trump = state.trump_suit;
  const remainingTrump = state.cards.filter((c) => c.startsWith(`${trump}_`) || c.includes('S_J_'));
  const yourTrump = state.zones.hand_you.filter((c) => remainingTrump.includes(c)).length;
  const partnerKnownTrump = state.zones.hand_partner.filter((c) => remainingTrump.includes(c)).length;
  const rivalKnownTrump = state.zones.hand_left.concat(state.zones.hand_right).filter((c) => remainingTrump.includes(c)).length;
  const totalKnown = yourTrump + partnerKnownTrump + rivalKnownTrump;
  const rivalShare = totalKnown ? rivalKnownTrump / totalKnown : 0.5;
  const partnerHighTrump = partnerKnownTrump > 0 ? 0.7 : 0.35;
  const nextTrickWin = Math.min(0.95, 0.4 + yourTrump * 0.1);
  const targetChance = Math.min(0.95, 0.35 + (yourTrump + partnerKnownTrump) * 0.08 - rivalShare * 0.15);

  const arr: Omit<SummaryIndicator, 'trendVsPrevious'>[] = [
    { id: 'rival_trump', title: 'Rivals hold 3/4 trump', value: rivalShare, confidence: conf(rivalShare), hint: 'Estimated from known + legal unknown placements.' },
    { id: 'partner_high_trump', title: 'Partner high-trump likelihood', value: partnerHighTrump, confidence: conf(partnerHighTrump), hint: 'Presence of known partner trump and public constraints.' },
    { id: 'next_win', title: 'Next-trick win chance', value: nextTrickWin, confidence: conf(nextTrickWin), hint: 'Current lead context and top-trump control.' },
    { id: 'target', title: 'Chance to hit target tricks', value: targetChance, confidence: conf(targetChance), hint: 'Team-level projection from available control cards.' },
  ];

  return arr.map((it) => {
    const prev = previous?.find((p) => p.id === it.id)?.value ?? it.value;
    return { ...it, trendVsPrevious: Number((it.value - prev).toFixed(3)) };
  });
}
