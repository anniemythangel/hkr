# Hooker Calculator (Local Ruleset v1)

## Scope
- Fixed ruleset only: `hooker_local_v1`.
- No bidding/calling.
- Single profile (no alternate rules).
- Two modes only: `hidden` and `visible`.

## Mode behavior
- **Hidden mode**: the engine masks opponent hand-zone certainty and only uses legal player-visible information plus explicit constraints.
- **Visible mode**: full assignment/testing mode for analysis and what-if setup.

## Interpretation guidance
- Recommendations rank by **utility (EV)**, then guaranteed floor, then risk tiebreak.
- Confidence is derived from backend/sample support:
  - `high`: exact or high MC budget.
  - `medium`: moderate MC budget.
  - `low`: low MC budget.
- Probability matrix always reports these locations: `you`, `partner`, `left`, `right`, `kitty_top`, `burned_pool`.

## UI interactions
- Default input mode: click-to-assign.
- Drag-and-drop is supported as fallback mode.
- Keyboard shortcuts:
  - `h` hidden mode
  - `v` visible mode
  - `z` undo
  - `y` redo
