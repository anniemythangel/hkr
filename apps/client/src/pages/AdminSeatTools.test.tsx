/** @vitest-environment jsdom */
import { describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { act } from 'react-dom/test-utils'
import AdminSeatTools from './AdminSeatTools'

describe('AdminSeatTools', () => {
  it('renders hidden admin seat actions', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    await act(async () => {
      root.render(<AdminSeatTools />)
    })
    expect(container.textContent).toContain('Force clear seat')
    expect(container.textContent).toContain('Force clear all seats')
  })
})
