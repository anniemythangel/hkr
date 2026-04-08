import { useMemo, useState, type DragEvent } from 'react'
import {
  RULESET_ID,
  assignCardToZone,
  branchScenario,
  computePosterior,
  computeSummaryIndicators,
  evaluateActions,
  generateInsights,
  jumpToTimeline,
  randomizeScenario,
  redo,
  resetCalculatorState,
  setMode,
  type CalculatorGameState,
  type Location,
  undo,
  validateState,
} from '@hooker/engine'

const cards = [
  'S_J_SHALIT', 'S_J_BROTHER', 'S_A', 'S_K', 'S_Q', 'S_10', 'S_9',
  'H_A', 'H_K', 'H_Q', 'H_J', 'H_10', 'H_9',
  'D_A', 'D_K', 'D_Q', 'D_J', 'D_10', 'D_9',
  'C_A', 'C_K', 'C_Q', 'C_J', 'C_10', 'C_9',
]

function cardImage(card: string) {
  if (card === 'S_J_SHALIT') return '/cards/JS.svg'
  if (card === 'S_J_BROTHER') return '/cards/JS.svg'
  const [suit, rank] = card.split('_')
  const r = rank === '10' ? 'T' : rank
  return `/cards/${r}${suit}.svg`
}

function makeInitialState(): CalculatorGameState {
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
      hand_you: ['S_J_SHALIT', 'S_J_BROTHER', 'S_A', 'C_9', 'H_Q'],
      hand_partner: [],
      hand_left: [],
      hand_right: [],
      kitty_top: null,
      burned_pool: [],
    },
    trick_history: [],
    current_trick: { lead_seat: null, plays: [] },
    constraints: { voids: { you: [], partner: [], left: [], right: [] }, known_locations: { S_J_SHALIT: 'you', S_J_BROTHER: 'you', S_A: 'you' }, forbidden_locations: {} },
    engine: { seed: 42, backend: 'exact', confidence: 'high' },
    ui: { input_mode: 'click', timeline_index: 0 },
  }
}

const ZONES: Array<{ label: string; loc: Location; help: string }> = [
  { label: 'Your hand', loc: 'you', help: 'Cards you currently hold.' },
  { label: 'Partner hand', loc: 'partner', help: 'Known partner cards.' },
  { label: 'Left opponent', loc: 'left', help: 'Known left-opponent cards.' },
  { label: 'Right opponent', loc: 'right', help: 'Known right-opponent cards.' },
  { label: 'Kitty top', loc: 'kitty_top', help: 'Single exposed kitty card.' },
  { label: 'Burned pool', loc: 'burned_pool', help: 'Cards removed from play.' },
]

type CalculatorPageProps = {
  initialState?: CalculatorGameState
}

function cloneGameState(state: CalculatorGameState): CalculatorGameState {
  return JSON.parse(JSON.stringify(state)) as CalculatorGameState
}

export default function CalculatorPage({ initialState }: CalculatorPageProps) {
  const [canonical] = useState<CalculatorGameState>(() => cloneGameState(initialState ?? makeInitialState()))
  const [state, setState] = useState<CalculatorGameState>(() => cloneGameState(initialState ?? makeInitialState()))
  const [selected, setSelected] = useState<string | null>(null)
  const [error, setError] = useState<string>('')
  const [viewMode, setViewMode] = useState<'Quick' | 'Coach' | 'Advanced'>('Quick')

  const posterior = useMemo(() => computePosterior({ state, seatPerspective: 'you', backendPreference: 'auto', sampleBudget: 1500 }), [state])
  const evaluation = useMemo(() => evaluateActions({ state, seat: 'you', posterior }), [state, posterior])
  const insights = useMemo(() => generateInsights({ state, seat: 'you', posterior, evaluation }), [state, posterior, evaluation])
  const indicators = useMemo(() => computeSummaryIndicators(state), [state])
  const timelineCount = state.ui?.timeline?.length ?? 1
  const timelineCursor = state.ui?.timeline_cursor ?? 0

  const assignSelectedCard = (loc: Location) => {
    if (!selected) {
      setError('Select a card before assigning.')
      return
    }

    try {
      setState((s) => assignCardToZone({ ...s, ui: { ...s.ui, selected_card: selected } }, selected, loc))
      setSelected(null)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid assignment')
    }
  }

  const onDropToZone = (event: DragEvent<HTMLDivElement>, loc: Location) => {
    event.preventDefault()
    assignSelectedCard(loc)
  }

  const health = validateState(state)

  return (
    <div style={{ padding: 16, display: 'grid', gap: 12 }}>
      <h2>Hooker Calculator</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button title="Reset to canonical initial calculator state" onClick={() => { setState(resetCalculatorState(cloneGameState(canonical))); setSelected(null); setError('') }}>Reset</button>
        <button title="Deterministic random hand by seed" onClick={() => setState((s) => randomizeScenario(s, s.engine.seed))}>Random Hand</button>
        <label title="Select trump suit used in evaluations">Trump
          <select value={state.trump_suit} onChange={(e) => setState((s) => ({ ...s, trump_suit: e.target.value as CalculatorGameState['trump_suit'] }))}>
            <option value="S">Spades</option><option value="H">Hearts</option><option value="D">Diamonds</option><option value="C">Clubs</option>
          </select>
        </label>
        <button title="Hidden mode uses only public/legal information" onClick={() => setState((s) => setMode(s, 'hidden'))}>Hidden</button>
        <button title="Visible mode uses full assignments" onClick={() => setState((s) => setMode(s, 'visible'))}>Visible</button>
        <button title="Undo last timeline node" onClick={() => setState((s) => undo(s))}>Undo</button>
        <button title="Redo timeline node" onClick={() => setState((s) => redo(s))}>Redo</button>
        <button title="Jump to first timeline node" onClick={() => setState((s) => jumpToTimeline(s, 0))}>Jump to First State</button>
        <button title="Create a new what-if branch" onClick={() => setState((s) => branchScenario(s).state)}>New What-If Branch</button>
      </div>

      <section style={{ border: '1px solid rgba(255,255,255,0.25)', padding: 10, background: 'rgba(6, 33, 25, 0.8)', color: '#e6fcf5' }}>
        <h3 style={{ marginTop: 0 }}>How to use this calculator</h3>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          <li><strong>Quick / Coach / Advanced:</strong> Quick = shortest answer. Coach = short advice in plain words. Advanced = extra context for experienced players.</li>
          <li><strong>Hidden / Visible:</strong> Hidden simulates real play by masking unknown hands; Visible keeps all assignments exposed for what-if analysis.</li>
          <li><strong>Random Hand:</strong> Builds a full deal each time: 5 cards each player + 1 kitty card + 3 burned cards. Same seed = same deal.</li>
          <li><strong>Undo / Redo / Jump to First / New What-If Branch:</strong> Walk through history, return to the first checkpoint, or fork a separate branch from the current state.</li>
          <li><strong>Timeline scrubber + markers:</strong> Drag the slider to move through past states. If you edit an older state, you start a new “what-if” path.</li>
        </ul>
      </section>

      {!!error && <div role="alert" style={{ background: '#ffe3e3', border: '1px solid #ffa8a8', padding: 8 }}>{error}</div>}
      {!health.ok && <div role="alert" style={{ background: '#fff3bf', padding: 8 }}>{health.errors.join(' | ')}</div>}

      <div style={{ display: 'flex', gap: 8 }}>
        {(['Quick', 'Coach', 'Advanced'] as const).map((m) => <button key={m} onClick={() => setViewMode(m)} title={`Switch to ${m} mode`}>{m}</button>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <section style={{ border: '1px solid #ddd', padding: 10 }}>
          <h3>Cards</h3>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {cards.map((c) => (
              <button key={c} onClick={() => setSelected(c)} style={{ border: selected === c ? '2px solid #1c7ed6' : '1px solid #ddd' }} title={`Select ${c}`}>
                <img src={cardImage(c)} alt={c} width={44} />
              </button>
            ))}
          </div>
          <p>Selected: <strong>{selected ?? 'none'}</strong></p>
          <div style={{ display: 'grid', gap: 6 }}>
            {ZONES.map((z) => (
              <div key={z.loc} onDragOver={(e) => e.preventDefault()} onDrop={(e) => onDropToZone(e, z.loc)} style={{ border: '1px dashed #aaa', padding: 8 }}>
                <strong title={z.help}>{z.label}</strong>
                <button disabled={!selected} onClick={() => assignSelectedCard(z.loc)} style={{ marginLeft: 8 }}>Assign</button>
              </div>
            ))}
          </div>
        </section>

        <section style={{ border: '1px solid #ddd', padding: 10 }}>
          <h3>Summary indicators</h3>
          {indicators.map((i) => (
            <div key={i.id} style={{ marginBottom: 8 }} title={i.hint}>
              <div>{i.title} <span style={{ fontSize: 12 }}>({i.confidence})</span></div>
              <div style={{ height: 8, background: '#eee' }}><div style={{ width: `${Math.round(i.value * 100)}%`, background: '#74c0fc', height: '100%' }} /></div>
              <small>Trend {i.trendVsPrevious >= 0 ? '+' : ''}{(i.trendVsPrevious * 100).toFixed(1)}%</small>
            </div>
          ))}
          <details>
            <summary>Glossary / Help</summary>
            <p>
              Win now = how often this card wins the trick right away.
              Future tricks = how many tricks this play usually helps you win later.
              Safe minimum = the low-end result you can usually count on.
              Chance to get 2+ = how often this line reaches two or more tricks.
              Confidence high/medium/low = how sure the calculator is with missing information.
            </p>
          </details>
        </section>

        <section style={{ border: '1px solid #ddd', padding: 10 }}>
          <h3>Recommendation</h3>
          <div>Backend: {posterior.backendUsed} ({posterior.confidence})</div>
          <div>Acceptance ratio: {(posterior.diagnostics.acceptanceRatio * 100).toFixed(1)}%</div>
          {evaluation.best
            ? evaluation.ranked.map((r) => (
              <div key={r.action.card} style={{ borderTop: '1px solid #eee', marginTop: 6 }}>
                <strong>{r.action.card}</strong>
                <div>Win now {(r.winCurrentTrickProb * 100).toFixed(1)}% | Future tricks {r.expectedFutureTricks.toFixed(2)} | Safe minimum {r.guaranteedMinFutureTricks} | Chance to get 2+ {(r.probAtLeastXFutureTricks[2] * 100).toFixed(1)}%</div>
              </div>
            ))
            : (
              <div style={{ marginTop: 8, padding: 8, background: '#edf2ff', border: '1px solid #bac8ff' }}>
                No legal recommendation available for current known hand assignment. Add a playable card to your hand or move on the timeline.
              </div>
            )}
          {viewMode !== 'Quick' && insights.map((i) => <div key={i.id}><strong>{i.title}:</strong> {i.claim}</div>)}
          {viewMode === 'Advanced' && (
            <details>
              <summary>More context</summary>
              <ul>
                <li>Engine confidence: {posterior.confidence}</li>
                <li>Worlds tested: {posterior.diagnostics.attempted}</li>
                <li>Worlds that matched constraints: {posterior.diagnostics.accepted}</li>
                <li>Acceptance ratio: {(posterior.diagnostics.acceptanceRatio * 100).toFixed(1)}%</li>
                <li>Top play right now: {evaluation.best?.action.card ?? 'No legal play'}</li>
              </ul>
            </details>
          )}
        </section>
      </div>

      <div>
        <label title="Timeline scrubber">Timeline
          <input type="range" min={0} max={Math.max(0, timelineCount - 1)} value={timelineCursor} onChange={(e) => setState((s) => jumpToTimeline(s, Number(e.target.value)))} />
        </label>
        <div style={{ marginTop: 4, fontSize: 13 }}><strong>State {timelineCursor + 1} of {timelineCount}</strong> ("1 of 5" means you are looking at the first saved step out of five).</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Move the slider left/right to look at earlier or later saved steps. This does not delete anything.</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>If you make a change after going back in time, the app creates a new branch (alternate line).</div>
        <div style={{ fontSize: 13, marginTop: 4 }}>Legend: <strong>•</strong> normal saved step, <strong>B</strong> alternate-branch saved step.</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
          {(state.ui?.timeline_meta ?? []).map((m) => <span key={m.index} title={m.branch ? 'branch checkpoint' : 'checkpoint'} style={{ padding: '2px 6px', border: '1px solid #ddd' }}>{m.branch ? 'B' : '•'}{m.index}</span>)}
        </div>
      </div>
    </div>
  )
}
