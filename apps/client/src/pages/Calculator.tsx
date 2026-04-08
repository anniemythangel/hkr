import { useMemo, useState } from 'react'
import {
  RULESET_ID,
  assignCardToZone,
  branchScenario,
  computePosterior,
  evaluateActions,
  generateInsights,
  jumpToTimeline,
  redo,
  setMode,
  type CalculatorGameState,
  type Location,
  undo,
} from '@hooker/engine'

const cards = [
  'S_J_SHALIT','S_J_BROTHER','S_A','S_K','S_Q','S_10','S_9',
  'H_A','H_K','H_Q','H_J','H_10','H_9',
  'D_A','D_K','D_Q','D_J','D_10','D_9',
  'C_A','C_K','C_Q','C_J','C_10','C_9',
]

function makeInitialState(): CalculatorGameState {
  return {
    ruleset_id: RULESET_ID,
    mode: 'hidden',
    seats: ['you', 'partner', 'left', 'right'],
    dealer: 'right',
    lead_seat: 'you',
    current_turn: 'you',
    trick_number: 1,
    cards,
    zones: {
      hand_you: ['S_J_SHALIT', 'S_J_BROTHER', 'S_A', 'C_9', 'H_Q'],
      hand_partner: [],
      hand_left: [],
      hand_right: [],
      kitty_top: null,
      burned_pool: [],
    },
    trick_history: [],
    current_trick: { lead_seat: null, plays: [] },
    constraints: {
      voids: { you: [], partner: [], left: [], right: [] },
      known_locations: {
        S_J_SHALIT: 'you',
        S_J_BROTHER: 'you',
        S_A: 'you',
      },
      forbidden_locations: {},
    },
    engine: { seed: 42, backend: 'exact', confidence: 'high' },
    ui: { input_mode: 'click', timeline_index: 0 },
  }
}

export default function CalculatorPage() {
  const [state, setState] = useState<CalculatorGameState>(() => makeInitialState())
  const [selected, setSelected] = useState<string | null>(null)

  const posterior = useMemo(() => computePosterior({ state, seatPerspective: 'you', backendPreference: 'auto', sampleBudget: 1200 }), [state])
  const evaluation = useMemo(() => evaluateActions({ state, seat: 'you', posterior }), [state, posterior])
  const insights = useMemo(() => generateInsights({ state, seat: 'you', posterior, evaluation }), [state, posterior, evaluation])

  const zones: Array<{ label: string; loc: Location }> = [
    { label: 'You', loc: 'you' },
    { label: 'Partner', loc: 'partner' },
    { label: 'Left', loc: 'left' },
    { label: 'Right', loc: 'right' },
    { label: 'Kitty Top', loc: 'kitty_top' },
    { label: 'Burned Pool', loc: 'burned_pool' },
  ]

  const assign = (loc: Location) => {
    if (!selected) return
    try {
      setState((s) => assignCardToZone(s, selected, loc))
    } catch {
      // explicit user feedback
      alert('Invalid assignment for selected zone')
    }
  }

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }} onKeyDown={(e) => {
      if (e.key === 'z') setState((s) => undo(s))
      if (e.key === 'y') setState((s) => redo(s))
      if (e.key === 'h') setState((s) => setMode(s, 'hidden'))
      if (e.key === 'v') setState((s) => setMode(s, 'visible'))
    }} tabIndex={0}>
      <h2>Hooker Calculator ({state.mode})</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => setState((s) => setMode(s, 'hidden'))}>Hidden</button>
        <button onClick={() => setState((s) => setMode(s, 'visible'))}>Visible</button>
        <button onClick={() => setState((s) => ({ ...s, ui: { ...s.ui, input_mode: s.ui?.input_mode === 'click' ? 'drag' : 'click' } }))}>Input: {state.ui?.input_mode ?? 'click'}</button>
        <button onClick={() => setState((s) => undo(s))}>Undo</button>
        <button onClick={() => setState((s) => redo(s))}>Redo</button>
        <button onClick={() => setState((s) => jumpToTimeline(s, 0))}>Timeline Start</button>
        <button onClick={() => setState((s) => branchScenario(s).state)}>Branch</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: 12 }}>
        <section style={{ border: '1px solid #ddd', padding: 10 }}>
          <h3>1) State Entry Board</h3>
          <p>Click-to-assign default, drag fallback is available via mode toggle.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cards.map((c) => (
              <button key={c} onClick={() => setSelected(c)} style={{ background: selected === c ? '#d0ebff' : undefined }}>{c}</button>
            ))}
          </div>
          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
            {zones.map((z) => (
              <div
                key={z.loc}
                draggable={state.ui?.input_mode === 'drag'}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => assign(z.loc)}
                style={{ border: '1px dashed #aaa', padding: 8 }}
              >
                <div><strong>{z.label}</strong></div>
                <button onClick={() => assign(z.loc)}>Assign selected</button>
              </div>
            ))}
          </div>
        </section>

        <section style={{ border: '1px solid #ddd', padding: 10 }}>
          <h3>2) Recommendations + Insights</h3>
          <div>Backend: {evaluation.metadata.backendUsed} / Confidence: {evaluation.metadata.confidence}</div>
          {evaluation.ranked.map((r) => (
            <div key={r.action.card} style={{ marginTop: 8, borderTop: '1px solid #eee' }}>
              <strong>{r.action.card}</strong> EV {r.expectedFutureTricks.toFixed(2)} | Floor {r.guaranteedMinFutureTricks}
            </div>
          ))}
          <h4>Explain my hand</h4>
          {insights.map((i) => (
            <div key={i.id}><strong>{i.title}:</strong> {i.claim} ({i.evidence})</div>
          ))}
        </section>

        <section style={{ border: '1px solid #ddd', padding: 10 }}>
          <h3>3) Probabilities</h3>
          <p>Locations: you, partner, left, right, kitty_top, burned_pool.</p>
          {posterior.cardLocationDistributions.slice(0, 8).map((d) => (
            <div key={d.card} style={{ marginBottom: 6 }}>
              <strong>{d.card}</strong>
              <div style={{ fontSize: 12 }}>
                y:{d.probs.you.toFixed(2)} p:{d.probs.partner.toFixed(2)} l:{d.probs.left.toFixed(2)} r:{d.probs.right.toFixed(2)} k:{d.probs.kitty_top.toFixed(2)} b:{d.probs.burned_pool.toFixed(2)}
              </div>
            </div>
          ))}
        </section>
      </div>
    </div>
  )
}
