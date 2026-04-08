# Hooker Calculator (Local Ruleset v1)

## Scope and fixed rules
- Fixed ruleset id: `hooker_local_v1` (`RULESET_ID`).
- No bidding/calling workflows.
- No alternate rulesets.
- Only two calculator visibility modes: `hidden` and `visible`.

## Mode semantics
- **Hidden mode**
  - Applies `maskStateForPerspective(state, seatPerspective)` before inference/evaluation.
  - Removes private opponent certainty from `known_locations` and private hand-zone visibility.
  - Uses only publicly legal information, observed cards, and derived constraints.
- **Visible mode**
  - Uses full assignments and known locations directly.
  - Intended for explicit what-if analysis.

## Trump selection behavior
- `trump_suit` is an explicit required field in calculator state.
- All recommendation scoring and indicators are recomputed whenever trump changes.
- Trump selector supports `S/H/D/C` and updates immediately.

## Recommendation outputs
Every ranked action includes:
- win-now probability,
- expected downstream tricks,
- guaranteed minimum,
- probability of at least X tricks,
- confidence/backend metadata and diagnostics (`attempted`, `accepted`, acceptance ratio).

Ranking order is stable:
1. Expected value / utility,
2. Guaranteed floor,
3. Risk tie-break,
4. Card-id lexical tie for deterministic output.

## Strategic indicator cards
Headline indicators are recomputed on each assignment/play/timeline jump:
- rival pair holding 3/4 remaining trump,
- partner high-trump likelihood,
- next-trick win chance,
- chance to hit target tricks.

Each indicator includes confidence and trend versus previous timeline node.

## Controls and glossary
Top controls:
- Reset,
- Random Hand (deterministic by seed),
- Trump selector,
- Hidden/Visible toggle,
- Undo / Redo,
- Jump to First State,
- New What-If Branch.

Glossary:
- **Win-now**: chance current candidate card wins the current trick.
- **EV**: projected expected downstream tricks.
- **Floor**: guaranteed minimum projection.
- **Confidence**: certainty derived from exact or MC acceptance characteristics.

## Troubleshooting
- Inline error banner appears for invalid assignment/capacity violations.
- Assign buttons remain disabled until a card is selected.
- Reset clears selection/history/branch context back to canonical initial state.
- If MC acceptance ratio is low, inference confidence drops and should be interpreted cautiously.

## Example interpretation (non-technical)
If top recommendation shows:
- Win now `72%`, EV `1.8`, Floor `1`, P(≥2) `48%`, Confidence `medium`,
then practical meaning is:
- “This card is likely to take the current trick,
- usually yields around two future tricks,
- but safely guarantees one in most worlds,
- with moderate uncertainty due to hidden information.”
