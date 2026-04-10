import { PLAYERS } from '@hooker/shared';
import { isBlacklistedPlayerName } from './playerNamePolicy.js';

export interface JoinNameValidationError {
  code: 'PLAYER_NAME_BLACKLISTED';
  field: 'name';
  message: string;
}

export function getJoinNameValidationError(name: string): JoinNameValidationError | null {
  if (!isBlacklistedPlayerName(name)) {
    return null;
  }
  return {
    code: 'PLAYER_NAME_BLACKLISTED',
    field: 'name',
    message: 'Player name is reserved. Please choose another name.',
  };
}

export function getBlacklistedNameFieldErrors(names: Record<'A' | 'B' | 'C' | 'D', string>): Partial<Record<'A' | 'B' | 'C' | 'D', string>> {
  const fieldErrors: Partial<Record<'A' | 'B' | 'C' | 'D', string>> = {};
  for (const field of PLAYERS) {
    if (isBlacklistedPlayerName(names[field])) {
      fieldErrors[field] = `${field} is blacklisted`;
    }
  }
  return fieldErrors;
}
