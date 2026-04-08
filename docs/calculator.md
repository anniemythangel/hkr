# Hooker Calculator (Local Ruleset v1)

## Scope and fixed rules
- Fixed ruleset id: `hooker_local_v1` (`RULESET_ID`).
- No bidding/calling workflows.
- No alternate rulesets.
- Only two calculator visibility modes: `hidden` and `visible`.

## Quick start: what each mode is for
- **Quick**: Fast recommendation view. Just the ranked plays.
- **Coach**: Adds short plain-language advice about *why* the top line is preferred.
- **Advanced**: Adds extra context (counts and confidence) for experienced players.

Example:
- If Quick says `S_A` is best, Coach might add context like “Play S_A to maximize win-now while preserving floor.”
- In Advanced, you can verify confidence and acceptance diagnostics behind that recommendation.

## Hidden vs Visible
- **Hidden mode**
  - Applies `maskStateForPerspective(state, seatPerspective)` before inference/evaluation.
  - Removes private opponent certainty from `known_locations` and private hand-zone visibility.
  - Mirrors real-play uncertainty.
- **Visible mode**
  - Uses full assignments and known locations directly.
  - Intended for explicit what-if and teaching analysis.

## Random Hand behavior
- Random Hand always creates a full legal world (deterministic by seed):
  - `hand_you`: 5 cards,
  - `hand_partner`: 5 cards,
  - `hand_left`: 5 cards,
  - `hand_right`: 5 cards,
  - `kitty_top`: 1 card,
  - `burned_pool`: 3 cards.
- Hidden/Visible semantics are preserved at inference time (masking), not by generating partial worlds.

## Recommendation outputs and fallback behavior
Every ranked action includes:
- win-now probability,
- expected downstream tricks (EV),
- guaranteed minimum (floor),
- probability of at least X tricks,
- confidence/backend metadata and diagnostics (`attempted`, `accepted`, acceptance ratio).

Ranking order is stable:
1. Expected value / utility,
2. Guaranteed floor,
3. Risk tie-break,
4. Card-id lexical tie for deterministic output.

If no legal play exists for your currently assigned hand, recommendation safely falls back to:
- **“No legal recommendation available for current known hand assignment.”**

What to do next:
- assign at least one legal card to your hand, or
- scrub timeline to an earlier playable state.

## Timeline and branching (player-language)
- The timeline slider lets you move through saved steps without deleting history.
- If you make edits from an earlier point, you create a what-if branch from that checkpoint.
- Marker legend:
  - `•` = normal saved step,
  - `B` = saved step on an alternate branch.
- The UI also shows current position as “State X of Y” (example: `State 1 of 5`).

## Assignment UX and errors
- Assign controls are disabled until a card is selected.
- Click-assign and drop-assign both use the same guarded assignment transition.
- After successful assignment, selected card is cleared to keep deterministic flow.
- Invalid actions show inline non-blocking error banners (no blocking alerts).

## Glossary
- **Win-now**: chance candidate card wins current trick.
- **Future tricks**: how many tricks this play usually helps you win later.
- **Safe minimum**: low-end result you can usually count on.
- **Chance to get 2+**: how often this line reaches two or more tricks.
- **Confidence high/medium/low**:
  - high: strongly constrained by known assignments,
  - medium: moderate hidden-card uncertainty,
  - low: highly sensitive to unknown-card worlds.
