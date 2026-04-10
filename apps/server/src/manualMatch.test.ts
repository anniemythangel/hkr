import { describe, expect, it } from 'vitest';
import { manualMatchInsertSchema, parseManualRoundScore, validateManualAuthorization } from './manualMatch.js';

describe('manual match authorization', () => {
  it('returns unauthorized when bearer token does not match', () => {
    expect(validateManualAuthorization('Bearer wrong', 'secret-token')).toBe('unauthorized');
  });

  it('returns missing_token when STATS_MANUAL_TOKEN is not configured', () => {
    expect(validateManualAuthorization('Bearer anything', undefined)).toBe('missing_token');
  });
});

describe('manual match round parser', () => {
  it('parses NN-EE score strings', () => {
    expect(parseManualRoundScore('16-12')).toEqual({
      ok: true,
      value: {
        northSouth: 16,
        eastWest: 12,
      },
    });
  });

  it('rejects malformed scores and out-of-range values', () => {
    expect(parseManualRoundScore('x-y')).toEqual({
      ok: false,
      error: 'Score must match NN-EE format (example: 16-12)',
    });
    expect(parseManualRoundScore('17-1')).toEqual({
      ok: false,
      error: 'Score values must be between 0 and 16',
    });
  });

  it('rejects invalid schema payload round values', () => {
    const parsed = manualMatchInsertSchema.safeParse({
      recordedAt: '2026-04-10T10:00:00.000Z',
      A: 'Avi',
      B: 'Ben',
      C: 'Chaim',
      D: 'Dov',
      R1: '16-12',
      R2: '99-1',
      R3: 'bad',
      honorA: 'Neutral',
      honorB: 'Neutral',
      honorC: 'Neutral',
      honorD: 'Neutral',
    });
    expect(parsed.success).toBe(false);
  });
});
