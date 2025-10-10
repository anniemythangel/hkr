# Phase 1 – Responsive Guardrails & Strategy Contract

## Feature flag scaffold
- **Flag name:** `VITE_ENABLE_RESPONSIVE`, surfaced through the `ENABLE_RESPONSIVE_UI` helper in `apps/client/src/utils/featureFlags.ts`. When the flag resolves `true`, we add the `.is-responsive-enabled` class to the document root so the upcoming responsive layer can be fully gated.【F:apps/client/src/utils/featureFlags.ts†L1-L28】【F:apps/client/src/main.tsx†L1-L18】
- **Default state:** `true` for local development and automated tests (`import.meta.env.DEV` / `MODE === 'test'`); `false` for production builds.
- **How to toggle:**
  - **Local development:** no action required — run `pnpm dev:client` and the responsive layer is on by default. To force-disable, export `VITE_ENABLE_RESPONSIVE=false pnpm dev:client`.
  - **Preview/QA deployments:** set `VITE_ENABLE_RESPONSIVE=true` in the deployment environment or `.env` file before `pnpm build`. This keeps the layer active while mimicking production mode.
  - **Production:** leave the variable unset (defaults to `false`) until responsive QA is complete. Flip on by redeploying with `VITE_ENABLE_RESPONSIVE=true`. Roll back instantly by redeploying with `VITE_ENABLE_RESPONSIVE=false`.

## Layout constraint inventory (phone risk map)
- **Seat panels:** Fixed `min-width: 160px; max-width: 210px` with rigid padding risk overflow on sub-600px widths.【F:apps/client/src/styles.css†L830-L902】
- **Kitty pocket:** Clamped between `110–160px` and anchored beside the hand rail; shrinks poorly without overrides.【F:apps/client/src/styles.css†L965-L999】
- **Table ring grid:** Side panels reserve `minmax(200px, 280px)` / `minmax(220px, 320px)` columns, forcing horizontal scroll below ~720px if not relaxed.【F:apps/client/src/styles.css†L586-L669】
- **Trick history well:** Uses `transform: translateY(-8rem)` which collides with stacked layouts and overlaps adjacent panels.【F:apps/client/src/styles.css†L628-L648】
- **Hand rail:** Single-row `flex-wrap: nowrap` with card clamps `min-width: 64px` and `gap: 1.25rem`; cards overflow small screens without intervention.【F:apps/client/src/styles.css†L919-L1052】
- **Felt minimums:** `.table-ring` enforces `min-height: clamp(440px, 58vh, 640px)`; tall requirement can push the hand rail off-screen on landscape phones.【F:apps/client/src/styles.css†L577-L584】

## Strategy contract
- **Breakpoint tiers:** Tuned after container-query instrumentation to stage-driven thresholds: table stage `≤1200px` and `≤720px`; table ring `≤960px`, `≤800px`, `≤640px`, `≤520px`; hand rail `≤820px`, `≤640px`, `≤520px`. Wider sizes inherit existing desktop rules.
- **Container-query targets:** Promote the felt/table wrapper (`.table-layout-stage` → `table-stage`) and the table ring (`.table-ring`) plus the hand rail (`.player-hand-rail`) to named query containers so seat sizing, kitty pocket behavior, and card gutters respond to available width instead of the viewport.【F:docs/responsive/phase-0-preflight.md†L18-L36】
- **Touch ergonomics:** Maintain ≥44×44px hit areas for actionable buttons/cards; prefer stacked or scrollable layouts over shrinking tap targets. Preserve primary controls within comfortable reach in portrait and landscape.
- **Safe-area support:** When the responsive layer is active, pad sticky footers/rails (`env(safe-area-inset-*)`) and ensure banners or action rows respect notches and home indicators.
- **Desktop parity guardrail:** All responsive overrides will live under `.is-responsive-enabled` (and future feature hooks) so disabling the flag reverts to today’s desktop layout with no regressions.
