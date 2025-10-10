# Phase 2 — Compact Responsive Layer Tasks

These are the scoped tasks before touching CSS. Responsive overrides remain gated by `ENABLE_RESPONSIVE_UI` / `.is-responsive-enabled` and will be additive.

## Task List
1. Relax hard width constraints that force overflow (seat panels, kitty pocket, side panels) and ensure flex/grid children can shrink with `min-width: 0`.
2. Neutralize desktop-only transforms/offsets on stacked layouts while the flag is enabled.
3. Allow the felt/trick surface to reshape on narrow viewports and keep the trick ring readable.
4. Reduce the minimum card footprint and condense hand rail spacing so a full hand fits without horizontal scroll at ~360px.
5. Make auxiliary panels scroll within capped heights so the table surface stays visible.
6. Add mobile ergonomics hooks (safe-area insets, sticky hand rail, lowered shadow costs) under the flag.

## Desktop Parity Risks
* All overrides are wrapped in `.is-responsive-enabled` + narrow-width queries so desktop remains untouched when the flag is off.
* Will verify that desktop selectors are unchanged and that the flag off-path does not load the responsive stylesheet.

## Status After Implementation
* Flag remains default-on for local/test via `ENABLE_RESPONSIVE_UI`; production stays opt-in until rollout.
* Tests: `pnpm -r test` still blocked in the container because dependencies are not installed; no code-path regressions observed locally.
* No updates required to the broader strategy note—the agreed breakpoints and container-query plan remain valid for upcoming phases.
