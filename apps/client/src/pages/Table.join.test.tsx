/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import TablePage from './Table'

vi.mock('../hooks/useSocket', () => ({
  useSocket: () => ({
    status: 'connected',
    snapshot: null,
    logs: [],
    chatMessages: [],
    connect: vi.fn(),
    emitAction: vi.fn(),
    sendChat: vi.fn(),
    setReady: vi.fn(),
    setFollowSeat: vi.fn(),
    roster: {},
    lobby: {
      seats: {
        A: { name: 'Ari', ready: false, present: false, graceRemainingMs: 4500, graceHeldByName: 'Ari' },
        B: { name: null, ready: false, present: false },
        C: { name: null, ready: false, present: false },
        D: { name: null, ready: false, present: false },
      },
      status: 'waitingForPlayers',
      allPresent: false,
      allReady: false,
      matchStarted: false,
    },
    token: { role: 'player', seat: 'A', roomId: 'demo', name: 'Ari', serverUrl: '' },
    defaultServer: 'http://localhost:3001',
    joinStatus: 'join_failed',
  }),
}))

describe('Table join UX', () => {
  it('renders grace hold explanation and countdown status', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(
        <MemoryRouter initialEntries={['/room/demo']}>
          <Routes><Route path="/room/:roomId" element={<TablePage />} /></Routes>
        </MemoryRouter>,
      )
    })
    expect(container.textContent).toContain('We’re holding this seat briefly so the disconnected player can return.')
    expect(container.textContent).toContain('Held')
  })
})
