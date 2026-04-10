export const BLACKLISTED_PLAYER_NAMES = ['Player A', 'Player B', 'Player C', 'Player D'] as const;

export function normalizePlayerName(rawName: string): string {
  return rawName.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-US');
}

const BLACKLISTED_PLAYER_NAME_SET = new Set(BLACKLISTED_PLAYER_NAMES.map((name) => normalizePlayerName(name)));

export class ReservedPlayerNameError extends Error {
  readonly code = 'PLAYER_NAME_BLACKLISTED';

  constructor(readonly rawName: string) {
    super(`Player name "${rawName}" is reserved and cannot be used.`);
    this.name = 'ReservedPlayerNameError';
  }
}

export function isBlacklistedPlayerName(rawName: string): boolean {
  return BLACKLISTED_PLAYER_NAME_SET.has(normalizePlayerName(rawName));
}

export function assertAllowedPlayerName(rawName: string): void {
  if (isBlacklistedPlayerName(rawName)) {
    throw new ReservedPlayerNameError(rawName);
  }
}
