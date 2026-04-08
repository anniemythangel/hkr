import type { GenerateInsightsRequest, InsightCard } from './types';

export function generateInsights(req: GenerateInsightsRequest): InsightCard[] {
  const best = req.evaluation.best;
  return [
    {
      id: 'best',
      priority: 1,
      title: 'Best play now',
      claim: `Play ${best.action.card}`,
      evidence: `Win now ${(best.winCurrentTrickProb * 100).toFixed(1)}%, expected ${best.expectedFutureTricks.toFixed(2)} tricks`,
      confidence: req.evaluation.metadata.confidence,
      mode: req.state.mode,
      tags: ['recommendation'],
    },
    {
      id: 'target',
      priority: 2,
      title: 'Target chance',
      claim: `P(at least 2) ${(best.probAtLeastXFutureTricks[2] * 100).toFixed(1)}%`,
      evidence: `Guaranteed floor ${best.guaranteedMinFutureTricks}`,
      confidence: req.evaluation.metadata.confidence,
      mode: req.state.mode,
      tags: ['target', 'floor'],
    },
  ];
}
