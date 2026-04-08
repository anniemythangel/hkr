import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import CalculatorPage from './Calculator'

describe('Calculator page overhaul', () => {
  it('renders svg card assets and tooltips/help labels', () => {
    const html = renderToStaticMarkup(<CalculatorPage />)
    expect(html).toContain('/cards/')
    expect(html).toContain('Reset to canonical initial calculator state')
    expect(html).toContain('Glossary / Help')
  })

  it('renders controls for undo/redo/branch/jump and timeline', () => {
    const html = renderToStaticMarkup(<CalculatorPage />)
    expect(html).toContain('Undo')
    expect(html).toContain('Redo')
    expect(html).toContain('Jump to First State')
    expect(html).toContain('New What-If Branch')
    expect(html).toContain('type="range"')
  })
})
