const PLAYER_COLOR_CLASSES = [
  'player-identity-0',
  'player-identity-1',
  'player-identity-2',
  'player-identity-3',
  'player-identity-4',
  'player-identity-5',
  'player-identity-6',
  'player-identity-7',
  'player-identity-8',
  'player-identity-9',
  'player-identity-10',
  'player-identity-11',
]

const PLAYER_EMOJIS = ['🦊', '🦁', '🐼', '🐯', '🦉', '🐙', '🦄', '🐢', '🐧', '🐬', '🦋', '🐝']

export function getStableHash(input: string): number {
  let hash = 0
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0
  }
  return hash
}

function normalizeDisplayName(displayName: string): string {
  return displayName.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function getPlayerIdentityKey(profileId: string | null | undefined, displayName: string): string {
  const normalizedName = normalizeDisplayName(displayName)
  return profileId?.trim() || normalizedName || '-'
}

export function getPlayerColorClass(key: string): string {
  const hash = getStableHash(key)
  return PLAYER_COLOR_CLASSES[hash % PLAYER_COLOR_CLASSES.length]
}

export function getPlayerEmoji(key: string): string {
  const hash = getStableHash(key)
  return PLAYER_EMOJIS[hash % PLAYER_EMOJIS.length]
}
