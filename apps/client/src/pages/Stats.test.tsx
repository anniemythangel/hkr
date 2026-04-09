/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import StatsPage from './Stats'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

function mockFetchSequence(responses: Array<{ ok: boolean; body: unknown }>) {
  globalThis.fetch = vi.fn().mockImplementation(() => {
    const next = responses.shift()
    if (!next) {
      return Promise.reject(new Error('Unexpected fetch call'))
    }
    return Promise.resolve({ ok: next.ok, json: async () => next.body })
  }) as unknown as typeof fetch
}

describe('StatsPage', () => {
  it('renders loading then empty state', async () => {
    mockFetchSequence([
      { ok: true, body: { stats: { available: true } } },
      { ok: true, body: { players: [] } },
      { ok: true, body: { rows: [], nextCursor: null } },
    ])

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StatsPage />)
    })

    expect(container.textContent).toContain('No stats yet')
  })

  it('renders error state when health is unavailable', async () => {
    mockFetchSequence([{ ok: false, body: { stats: { available: false } } }])

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StatsPage />)
    })

    expect(container.textContent).toContain('Stats are currently unavailable')
  })

  it('renders match history honors and round breakdown expander', async () => {
    mockFetchSequence([
      { ok: true, body: { stats: { available: true } } },
      {
        ok: true,
        body: {
          players: [
            { profileId: 'p1', displayName: 'Avi', talson: 1, usha: 0, neutral: 0, matches: 1, lastPlayed: null },
          ],
        },
      },
      {
        ok: true,
        body: {
          rows: [
            {
              matchId: 'm1',
              recordedAt: '2026-01-01T00:00:00.000Z',
              players: {
                A: { profileId: 'p1', displayName: 'Avi' },
                B: { profileId: 'p2', displayName: 'B' },
                C: { profileId: 'p3', displayName: 'C' },
                D: { profileId: 'p4', displayName: 'D' },
              },
              rounds: [
                { round: 1, northSouth: 16, eastWest: 12 },
                { round: 2, northSouth: 10, eastWest: 16 },
                { round: 3, northSouth: 16, eastWest: 8 },
              ],
              honors: { A: 'Talson', B: 'Neutral', C: 'Usha', D: 'Neutral' },
            },
          ],
          nextCursor: null,
        },
      },
    ])

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StatsPage />)
    })

    expect(container.textContent).toContain('A: Talson')
    expect(container.textContent).toContain('C: Usha')

    const firstButton = container.querySelector('table button') as HTMLButtonElement
    await act(async () => {
      firstButton.click()
    })

    expect(container.textContent).toContain('Per-round breakdown')
    expect(container.textContent).toContain('Round 1: 16-12')
  })

  it('loads more outcomes for selected player', async () => {
    mockFetchSequence([
      { ok: true, body: { stats: { available: true } } },
      { ok: true, body: { players: [{ profileId: 'p1', displayName: 'Avi', talson: 2, usha: 0, neutral: 0, matches: 2, lastPlayed: null }] } },
      { ok: true, body: { rows: [], nextCursor: null } },
      {
        ok: true,
        body: {
          player: {
            profileId: 'p1',
            displayName: 'Avi',
            aliases: [],
            recentOutcomes: [{ matchId: 'm2', outcome: 'Talson', recordedAt: '2026-01-02T00:00:00.000Z' }],
            recentOutcomesNextCursor: '2026-01-02T00:00:00.000Z',
          },
        },
      },
      {
        ok: true,
        body: {
          player: {
            profileId: 'p1',
            displayName: 'Avi',
            aliases: [],
            recentOutcomes: [{ matchId: 'm1', outcome: 'Neutral', recordedAt: '2026-01-01T00:00:00.000Z' }],
            recentOutcomesNextCursor: null,
          },
        },
      },
    ])

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StatsPage />)
    })

    const playerRow = container.querySelector('tbody tr') as HTMLTableRowElement
    await act(async () => {
      playerRow.click()
    })

    const loadMore = Array.from(container.querySelectorAll('button')).find((node) => node.textContent?.includes('Load more')) as HTMLButtonElement
    await act(async () => {
      loadMore.click()
    })

    expect(container.textContent).toContain('m2')
    expect(container.textContent).toContain('m1')
  })
})
