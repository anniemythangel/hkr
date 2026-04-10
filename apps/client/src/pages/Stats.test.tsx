/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import StatsPage from './Stats'
import { getPlayerColorClass, getPlayerEmoji, getPlayerIdentityKey } from '../utils/playerIdentity'

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
                B: { profileId: 'p2', displayName: 'Beni' },
                C: { profileId: 'p3', displayName: 'Chaim' },
                D: { profileId: 'p4', displayName: 'Dov' },
              },
              rounds: [
                { round: 1, northSouth: 16, eastWest: 12 },
                { round: 2, northSouth: 10, eastWest: 16 },
                { round: 3, northSouth: 12, eastWest: 12 },
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
    expect(container.textContent).toContain('B: Benonimi')
    expect(container.textContent).not.toContain('Neutral')

    const firstButton = container.querySelector('table button') as HTMLButtonElement
    expect(firstButton.classList.contains('stats-date-toggle')).toBe(true)
    await act(async () => {
      firstButton.click()
    })

    expect(container.textContent).toContain('Per-round breakdown')
    expect(container.textContent).toContain('Round 1: 16-12 (Avi + Beni won)')
    expect(container.textContent).toContain('Round 2: 10-16 (Beni + Dov won)')
    expect(container.textContent).toContain('Round 3: 12-12 (Tie between Avi + Dov and Beni + Chaim)')
    expect(container.querySelector('.honor-chip-list')).toBeTruthy()
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
    expect(container.textContent).toContain('Benonimi')
  })

  it('renders Talson trophy leader text and keeps tie labels where applicable', async () => {
    mockFetchSequence([
      { ok: true, body: { stats: { available: true } } },
      {
        ok: true,
        body: {
          players: [
            { profileId: 'p1', displayName: 'Azrikam', talson: 5, usha: 0, neutral: 0, matches: 4, lastPlayed: null },
            { profileId: 'p2', displayName: 'Beni', talson: 3, usha: 0, neutral: 1, matches: 4, lastPlayed: null },
            { profileId: 'p3', displayName: 'Chaim', talson: 1, usha: 0, neutral: 3, matches: 2, lastPlayed: null },
          ],
        },
      },
      { ok: true, body: { rows: [], nextCursor: null } },
    ])

    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<StatsPage />)
    })

    expect(container.textContent).toContain('Talson 🏆:')
    expect(container.textContent).toContain('Azrikam')
    expect(container.textContent).toContain('Talson 😎:')
    expect(container.textContent).toContain('Tie: Azrikam and Beni')
    expect(container.textContent).toContain('Usha 💩: Null')
  })

  it('renders identity chips and keeps emoji/color deterministic across table and history', async () => {
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
                B: { profileId: 'p2', displayName: 'Beni' },
                C: { profileId: 'p3', displayName: 'Chaim' },
                D: { profileId: 'p4', displayName: 'Dov' },
              },
              rounds: [
                { round: 1, northSouth: 16, eastWest: 12 },
                { round: 2, northSouth: 10, eastWest: 16 },
                { round: 3, northSouth: 12, eastWest: 12 },
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

    const chips = Array.from(container.querySelectorAll('.player-identity-chip'))
    expect(chips.length).toBeGreaterThan(0)

    const aviChips = chips.filter((chip) => chip.textContent?.includes('Avi'))
    expect(aviChips.length).toBeGreaterThanOrEqual(2)

    const aviKey = getPlayerIdentityKey('p1', 'Avi')
    const expectedClass = getPlayerColorClass(aviKey)
    const expectedEmoji = getPlayerEmoji(aviKey)

    aviChips.forEach((chip) => {
      expect(chip.classList.contains(expectedClass)).toBe(true)
      expect(chip.textContent).toContain(expectedEmoji)
    })
  })

})
