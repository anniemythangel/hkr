/** @vitest-environment jsdom */

import { describe, expect, it } from 'vitest'
import { act } from 'react-dom/test-utils'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server'
import { RULESET_ID, type CalculatorGameState } from '@hooker/engine'
import CalculatorPage from './Calculator'

const cards = [
  'S_J_SHALIT', 'S_J_BROTHER', 'S_A', 'S_K', 'S_Q', 'S_10', 'S_9',
  'H_A', 'H_K', 'H_Q', 'H_J', 'H_10', 'H_9',
  'D_A', 'D_K', 'D_Q', 'D_J', 'D_10', 'D_9',
  'C_A', 'C_K', 'C_Q', 'C_J', 'C_10', 'C_9',
]

function emptyYouHandState(): CalculatorGameState {
  return {
    ruleset_id: RULESET_ID,
    trump_suit: 'S',
    mode: 'hidden',
    seats: ['you', 'partner', 'left', 'right'],
    dealer: 'right',
    lead_seat: 'you',
    current_turn: 'you',
    trick_number: 1,
    cards,
    zones: {
      hand_you: [],
      hand_partner: ['S_K', 'D_10', 'H_9', 'C_Q', 'C_10'],
      hand_left: ['S_10', 'H_A', 'D_Q', 'D_J', 'C_9'],
      hand_right: ['S_9', 'H_K', 'H_Q', 'D_9', 'C_A'],
      kitty_top: 'D_K',
      burned_pool: ['S_A', 'H_10', 'C_K'],
    },
    trick_history: [],
    current_trick: { lead_seat: null, plays: [] },
    constraints: { voids: { you: [], partner: [], left: [], right: [] }, known_locations: {}, forbidden_locations: {} },
    engine: { seed: 42, backend: 'exact', confidence: 'high' },
    ui: { input_mode: 'click', timeline_index: 0 },
  }
}

describe('Calculator page overhaul', () => {
  it('renders svg card assets and persistent help labels', () => {
    const html = renderToStaticMarkup(<CalculatorPage />)
    expect(html).toContain('/cards/')
    expect(html).toContain('Reset to canonical initial calculator state')
    expect(html).toContain('How to use this calculator')
    expect(html).toContain('Quick / Coach / Advanced')
    expect(html).toContain('Glossary / Help')
    expect(html).toContain('Quick = shortest answer')
  })

  it('renders controls, timeline legend, and timeline state counter', () => {
    const html = renderToStaticMarkup(<CalculatorPage />)
    expect(html).toContain('Undo')
    expect(html).toContain('Redo')
    expect(html).toContain('Jump to First State')
    expect(html).toContain('New What-If Branch')
    expect(html).toContain('type="range"')
    expect(html).toContain('Legend:')
    expect(html).toContain('normal saved step')
    expect(html).toContain('State 1 of 1')
  })

  it('renders fallback recommendation state when no best action exists', () => {
    const html = renderToStaticMarkup(<CalculatorPage initialState={emptyYouHandState()} />)
    expect(html).toContain('No legal recommendation available for current known hand assignment')
  })

  it('uses the same guarded assignment path for click and drop with no selected card', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    act(() => {
      root.render(<CalculatorPage />)
    })

    const assignButtons = Array.from(container.querySelectorAll('button')).filter((button) => button.textContent?.trim() === 'Assign')
    const firstZone = container.querySelector('div[style*="dashed"]') as HTMLElement

    expect(assignButtons.length).toBeGreaterThan(0)
    expect(assignButtons[0]?.hasAttribute('disabled')).toBe(true)

    act(() => {
      firstZone.dispatchEvent(new Event('drop', { bubbles: true }))
    })

    expect(container.textContent).toContain('Select a card before assigning.')
  })
})
