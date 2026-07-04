import { useEffect } from 'react'

type WakeLockSentinel = EventTarget & {
  released: boolean
  release: () => Promise<void>
}

type WakeLockNavigator = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinel>
  }
}

export function useScreenWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined' || typeof navigator === 'undefined') return

    const wakeLock = (navigator as WakeLockNavigator).wakeLock
    if (!wakeLock) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const release = () => {
      const current = sentinel
      sentinel = null
      if (current && !current.released) {
        void current.release().catch(() => undefined)
      }
    }

    const request = async () => {
      if (cancelled || document.visibilityState !== 'visible' || sentinel) return
      try {
        sentinel = await wakeLock.request('screen')
        sentinel.addEventListener('release', () => {
          sentinel = null
        })
      } catch {
        // Unsupported, denied, or interrupted wake lock requests should never affect gameplay.
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void request()
      } else {
        release()
      }
    }

    void request()
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      release()
    }
  }, [enabled])
}
