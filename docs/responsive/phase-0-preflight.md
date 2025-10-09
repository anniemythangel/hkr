# Phase 0 – Responsive Preflight Report

## Internal Task Breakdown & Proposed Responsive Targets
- **Inventory & baselining (current task):** Document the existing layout, styling dependencies, baseline component metrics, and known constraints before touching CSS. (This document.)
- **Screenshot harness:** Stand up the client + server locally and capture canonical desktop views (lobby, table pre-deal, kitty, trick, end of hand, match banner) once package installs succeed in an environment with npm registry access.
- **Responsive layer planning:** Define additive override files, feature-flag wiring, and testing hooks ahead of implementation.
- **Execution sequencing:** Roll out responsive work in the order outlined in the brief (feature flag scaffolding → compact overrides → container queries → safe-area/touch polish → automated viewport matrix → documentation) so we can bail out cleanly at each milestone.

**Proposed breakpoint tiers (content-driven):**
- `≤480px` — ultra-compact phones; collapse non-critical panels, enforce single-column stage layout.
- `481–600px` — default portrait phones; shrink felt perimeter, reduce card gutters, move aux panels below the trick.
- `601–768px` — large portrait / small landscape; allow side panels to snap under felt, relax transforms that offset trick history.
- `769–1024px` — tablets & landscape phones; restore side-by-side rails with reduced padding.
- `1025–1280px` — small desktop & tablet landscape; match current desktop layout with minimal adjustments.
- `≥1281px` — wide desktop baseline (no changes; maintain today’s visuals).

**Container query targets:**
- Mark the `.table-ring` wrapper as a container; adapt seat panel arrangement, trick/card sizing, and kitty pocket based on the felt’s width.
- Use container queries for `.player-hand-rail` so card guttering responds to the actual rail width, not global viewport.
- Optionally scope console/chat panels to their parent column widths to avoid global breakpoint churn.

## Layout & Styling Inventory
- Styling is centralized in `apps/client/src/styles.css`; there are no CSS-in-JS or scoped module layers today, so any overrides must be additive to this file or imported after it.【F:apps/client/src/styles.css†L30-L158】【F:apps/client/src/styles.css†L577-L825】
- Desktop layout hinges on a three-column `.table-ring-grid` with fixed `minmax` values for the side panels (`minmax(200px, 280px)` left, `minmax(220px, 320px)` right) and a circular `.table-ring-surface` that consumes `82%` of its container width.【F:apps/client/src/styles.css†L586-L669】
- Seat panels enforce `min-width: 160px; max-width: 210px`, while the kitty pocket clamps between `110–160px`; both will constrain portrait flows unless relaxed under responsive conditions.【F:apps/client/src/styles.css†L830-L918】【F:apps/client/src/styles.css†L956-L999】
- Player hand cards clamp between `64×96` and `96×144` pixels and the rail keeps cards in a single row via `flex-wrap: nowrap`, relying on horizontal scrolling for overflow.【F:apps/client/src/styles.css†L940-L1052】
- Existing viewport breakpoints live at `1200px`, `960px`, and `720px`—primarily for the lobby grid and a stacked table layout. The `720px` rule swaps the felt grid to a vertical flow and forces the circular ring into a rounded rectangle.【F:apps/client/src/styles.css†L71-L82】【F:apps/client/src/styles.css†L720-L826】
- `TableLayout` renders scoreboard, console, chat, and trick history into the grid, then appends the hand rail and action row; the structural markup will stay intact while responsive layers adjust sizing/order.【F:apps/client/src/components/TableLayout.tsx†L149-L304】
- `TablePage` composes the full stage around `TableLayout`, scoreboard data, logs, and chat feeds; there is no SSR or alternate bundle, confirming a single UI path for all devices.【F:apps/client/src/pages/Table.tsx†L11-L185】

## Baseline Component Metrics
- `.table-ring` enforces `min-height: clamp(440px, 58vh, 640px)`, guaranteeing a large felt even on short viewports.【F:apps/client/src/styles.css†L577-L584】
- `.table-stage-panel-bottom-left` applies `transform: translateY(-8rem)`, pulling trick history upward to avoid overlap with the bottom seat—this will need to relax for stacked/scrollable flows.【F:apps/client/src/styles.css†L628-L648】
- `.table-ring-surface` keeps a 1:1 aspect ratio with an 11% inset decorative ring, while `.trick-ring` inside `TrickArea` assumes a 1.45:1 oval—both ratios must adapt under container queries to avoid squishing cards.【F:apps/client/src/styles.css†L659-L677】【F:apps/client/src/styles.css†L1111-L1131】
- `.player-hand-rail` currently centers content with a glassmorphism backdrop and horizontal scroll; safe-area padding and sticky positioning will layer on top of this base.【F:apps/client/src/styles.css†L919-L953】

## Baseline Screenshots
 A baseline capture set could not be produced in this container because `pnpm install` fails with `ERR_PNPM_FETCH_403` (403 Forbidden) when requesting `@types/react-dom`, leaving the client without dependencies.【a54e0f†L1-L9】 Once registry access is available, follow these steps to collect the reference set:
1. `pnpm install && pnpm build:shared && pnpm build:engine` (one-time setup).
2. `pnpm dev:server` (terminal A) and `pnpm dev:client` (terminal B).
3. Connect to the lobby at `http://localhost:5173`, seat four browser tabs/bots, and capture the required desktop states (lobby, pre-deal, kitty, trick, end of hand, match banner) at 1440×900 using the browser_container screenshot tool.
4. Store captures under `docs/responsive/baseline/` for future diffs.

## Risk Register
| Risk | Impact | Notes / Mitigation |
| --- | --- | --- |
| Hard `min-width` on seat panels (160px) and kitty pocket clamp (≥110px) | Forces horizontal overflow on sub-600px portrait viewports | Gate reduced min-widths behind responsive queries and allow cards/counts to stack vertically.【F:apps/client/src/styles.css†L830-L999】 |
| `.table-ring` min-height (≥440px) | Short landscape phones/tablets may have action rows pushed off-screen | Introduce orientation-aware height reductions and sticky hand rail to keep actionable controls visible.【F:apps/client/src/styles.css†L577-L584】 |
| `.table-stage-panel-bottom-left` translateY offset | On narrow stacks the trick history may overlap other panels or get clipped | Disable or reduce the transform when the grid collapses; rely on natural flow + scroll containers.【F:apps/client/src/styles.css†L628-L648】 |
| Circular felt + trick oval aspect ratios | Without adaptation, cards may shrink excessively when container narrows | Switch to container queries that adjust aspect ratio, padding, and slot spacing based on available width.【F:apps/client/src/styles.css†L659-L677】【F:apps/client/src/styles.css†L1111-L1131】 |
| Hand rail single-row constraint | Long hands on small screens require precise horizontal scroll; touch targets risk falling below 44px | Allow wrapping / multi-row options under coarse pointers and enlarge card tap targets within touch breakpoints.【F:apps/client/src/styles.css†L940-L1052】 |
| Heavy drop shadows / blur filters | Could hurt performance on low-end phones | Offer reduced effects under prefers-reduced-motion or narrow breakpoints while keeping desktop visuals untouched.【F:apps/client/src/styles.css†L84-L91】【F:apps/client/src/styles.css†L928-L930】 |
| Match result banner absolute positioning | May overlap safe areas/notches on phones | Add safe-area-aware offsets and allow dismissal/resizing when responsive flag is on.【F:apps/client/src/styles.css†L608-L699】 |

## Revert Plan
Responsive work will be wrapped in a dedicated feature flag (e.g., `REACT_APP_ENABLE_RESPONSIVE` exposed via Vite and server config). The plan:
1. Introduce a top-level flag utility in the client that reads `import.meta.env.VITE_ENABLE_RESPONSIVE`.
2. Scope all new responsive stylesheets/imports and component toggles behind the flag so that disabling it reverts to the existing desktop-only behavior instantly.
3. Document the toggle path for ops: set `VITE_ENABLE_RESPONSIVE=false` (and the matching server flag, if needed) and redeploy to disable mobile support without touching code.

The flag wiring will be implemented before responsive CSS lands so rollback is always a single env flip.
