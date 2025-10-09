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

export const RESPONSIVE_MODE_CLASS = 'is-responsive-enabled'

export function syncResponsiveModeClass(target?: Element): void {
  if (typeof document === 'undefined') return
  const host = target ?? document.documentElement
  host.classList.toggle(RESPONSIVE_MODE_CLASS, ENABLE_RESPONSIVE_UI)
}
