# Phase 3 — Container Queries & Breakpoint Tuning

## Task List
1. Promote the felt/table stage (`.table-layout-stage`) and table ring (`.table-ring`) to named container queries so the trick area, seats, and side panels respond to available width.
2. Expose the player hand rail (`.player-hand-rail`) as an inline-size container and move hand sizing, kitty pocket, and gutter rules behind container thresholds.
3. Retune the responsive tiers around content-based breakpoints (stage: ≤1200px/≤720px; ring: ≤960px/≤800px/≤640px/≤520px; hand rail: ≤820px/≤640px/≤520px) and drop redundant viewport queries.

## Desktop Parity Risks
* Container queries are only applied when `.is-responsive-enabled` is present. Flag-off paths continue using the legacy desktop rules, so turning the flag off is a full rollback.
* Container sizing properties (`container-type`) do not affect layout measurements in desktop modes; verified selectors remain additive to the responsive sheet only.

## Status After Implementation
* Flag defaults unchanged: enabled locally/preview, disabled in production until rollout approval.
* Tests remain blocked in-container (`pnpm -r test`) due to missing workspace dependencies; no new automated assertions were added in this phase.
* Strategy contract updated to list the tuned container breakpoints for future phases.
