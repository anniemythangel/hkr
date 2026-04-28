const FLAG_TRUE_VALUES = new Set(['1', 'true', 'on', 'yes'])
const FLAG_FALSE_VALUES = new Set(['0', 'false', 'off', 'no'])

function parseBooleanFlag(rawValue: string | undefined, fallback: boolean): boolean {
  if (!rawValue) {
    return fallback
  }
  const normalized = rawValue.trim().toLowerCase()
  if (FLAG_TRUE_VALUES.has(normalized)) return true
  if (FLAG_FALSE_VALUES.has(normalized)) return false
  return fallback
}

export const ENABLE_RESPONSIVE_UI = parseBooleanFlag(
  import.meta.env.VITE_ENABLE_RESPONSIVE,
  import.meta.env.DEV || import.meta.env.MODE === 'test',
)

export const ENABLE_STATS_UI = parseBooleanFlag(import.meta.env.VITE_ENABLE_STATS_UI, true)
export const ENABLE_RECONNECT_GRACE = parseBooleanFlag(import.meta.env.VITE_ENABLE_RECONNECT_GRACE, false)
export const ENABLE_JOIN_ACK_PROTOCOL = parseBooleanFlag(import.meta.env.VITE_ENABLE_JOIN_ACK_PROTOCOL, false)
export const ENABLE_ROOM_CHECKPOINTS = parseBooleanFlag(import.meta.env.VITE_ENABLE_ROOM_CHECKPOINTS, false)
export const ENABLE_ADMIN_SEAT_RELEASE = parseBooleanFlag(import.meta.env.VITE_ENABLE_ADMIN_SEAT_RELEASE, false)
export const ENABLE_HIDDEN_ADMIN_ROUTE = parseBooleanFlag(import.meta.env.VITE_ENABLE_HIDDEN_ADMIN_ROUTE, true)
export const ADMIN_TOOLS_PATH = import.meta.env.VITE_ADMIN_TOOLS_PATH || '/_admin/seat-tools'

export const RESPONSIVE_MODE_CLASS = 'is-responsive-enabled'

export function syncResponsiveModeClass(target?: Element): void {
  if (typeof document === 'undefined') return
  const host = target ?? document.documentElement
  host.classList.toggle(RESPONSIVE_MODE_CLASS, ENABLE_RESPONSIVE_UI)
}
