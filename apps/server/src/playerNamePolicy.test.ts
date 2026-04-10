import { describe, expect, it } from 'vitest';
import {
  assertAllowedPlayerName,
  BLACKLISTED_PLAYER_NAMES,
  isBlacklistedPlayerName,
  ReservedPlayerNameError,
} from './playerNamePolicy.js';
import { getBlacklistedNameFieldErrors, getJoinNameValidationError } from './playerNameValidation.js';

describe('player name blacklist policy', () => {
  it('matches reserved names with normalization', () => {
    expect(BLACKLISTED_PLAYER_NAMES).toEqual(['Player A', 'Player B', 'Player C', 'Player D']);
    expect(isBlacklistedPlayerName('Player A')).toBe(true);
    expect(isBlacklistedPlayerName('  pLaYeR   a  ')).toBe(true);
  });

  it('allows non-blacklisted names', () => {
    expect(isBlacklistedPlayerName('Player Z')).toBe(false);
    expect(() => assertAllowedPlayerName('Legit Player')).not.toThrow();
  });

  it('throws clear errors for reserved names', () => {
    expect(() => assertAllowedPlayerName('Player B')).toThrow(ReservedPlayerNameError);
    expect(() => assertAllowedPlayerName('Player B')).toThrow('reserved');
  });
});

describe('server-level player name validation', () => {
  it('returns structured join validation error for reserved names', () => {
    expect(getJoinNameValidationError('Player A')).toEqual({
      code: 'PLAYER_NAME_BLACKLISTED',
      field: 'name',
      message: 'Player name is reserved. Please choose another name.',
    });
    expect(getJoinNameValidationError('Totally Fine')).toBeNull();
  });

  it('returns field-level blacklist errors for manual inserts', () => {
    expect(
      getBlacklistedNameFieldErrors({
        A: 'Player A',
        B: 'Ben',
        C: ' Player  c ',
        D: 'Dina',
      }),
    ).toEqual({
      A: 'A is blacklisted',
      C: 'C is blacklisted',
    });
    expect(
      getBlacklistedNameFieldErrors({
        A: 'Avi',
        B: 'Ben',
        C: 'Chaim',
        D: 'Dina',
      }),
    ).toEqual({});
  });
});
