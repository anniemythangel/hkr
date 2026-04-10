import { z } from 'zod';

const MANUAL_SCORE_PATTERN = /^(\d{1,2})-(\d{1,2})$/;
const MIN_ROUND_SCORE = 0;
const MAX_ROUND_SCORE = 16;

export const manualRoundScoreSchema = z
  .string()
  .regex(MANUAL_SCORE_PATTERN, 'Score must match NN-EE format (example: 16-12)')
  .transform((raw, ctx) => {
    const parsed = parseManualRoundScore(raw);
    if (!parsed.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error });
      return z.NEVER;
    }
    return parsed.value;
  });

export const manualMatchInsertSchema = z.object({
  matchId: z.string().min(1).optional(),
  recordedAt: z.string().datetime(),
  A: z.string().min(1),
  B: z.string().min(1),
  C: z.string().min(1),
  D: z.string().min(1),
  R1: manualRoundScoreSchema,
  R2: manualRoundScoreSchema,
  R3: manualRoundScoreSchema,
  honorA: z.enum(['Talson', 'Usha', 'Neutral']),
  honorB: z.enum(['Talson', 'Usha', 'Neutral']),
  honorC: z.enum(['Talson', 'Usha', 'Neutral']),
  honorD: z.enum(['Talson', 'Usha', 'Neutral']),
});

export function parseManualRoundScore(raw: string): { ok: true; value: { northSouth: number; eastWest: number } } | { ok: false; error: string } {
  const text = raw.trim();
  const match = MANUAL_SCORE_PATTERN.exec(text);
  if (!match) {
    return { ok: false, error: 'Score must match NN-EE format (example: 16-12)' };
  }
  const northSouth = Number.parseInt(match[1] ?? '', 10);
  const eastWest = Number.parseInt(match[2] ?? '', 10);
  if (!Number.isInteger(northSouth) || !Number.isInteger(eastWest)) {
    return { ok: false, error: 'Score values must be integers' };
  }
  if (northSouth < MIN_ROUND_SCORE || northSouth > MAX_ROUND_SCORE || eastWest < MIN_ROUND_SCORE || eastWest > MAX_ROUND_SCORE) {
    return { ok: false, error: `Score values must be between ${MIN_ROUND_SCORE} and ${MAX_ROUND_SCORE}` };
  }
  return { ok: true, value: { northSouth, eastWest } };
}

export function validateManualAuthorization(authHeader: string | undefined, manualToken: string | undefined): 'ok' | 'missing_token' | 'unauthorized' {
  if (!manualToken) {
    return 'missing_token';
  }
  if (authHeader !== `Bearer ${manualToken}`) {
    return 'unauthorized';
  }
  return 'ok';
}
