# Responsive Guide

## Feature flag
- The responsive overrides are gated by the `VITE_ENABLE_RESPONSIVE` flag exposed through `ENABLE_RESPONSIVE_UI` and the `.is-responsive-enabled` class so the entire layer can be disabled instantly.【F:apps/client/src/utils/featureFlags.ts†L1-L23】【F:apps/client/src/main.tsx†L1-L27】

## Breakpoints and container queries
- Media queries are concentrated in `responsive.css` at 1280px, 960px, 720px, 600px, 480px, and the compact 900×520 viewport guardrail for short landscape scenarios.【F:apps/client/src/responsive.css†L22-L205】
- Panel containers opt into `container-type: inline-size` so their children can react to the available column width. The fallback typography/padding adjustments are defined in the container query near the end of the sheet.【F:apps/client/src/responsive.css†L16-L20】【F:apps/client/src/responsive.css†L214-L223】

## Card sizing floors and gutters
- Card image sizing uses `clamp()` so the minimum and maximum footprint can be tuned without changing markup. Adjust widths/heights in the `.card-img` / `.trick-card-img` rules inside the 960px and 600px queries for portrait, and the 720px bucket for stacked rails.【F:apps/client/src/responsive.css†L64-L116】【F:apps/client/src/responsive.css†L178-L216】
- Hand spacing and trick gutters are likewise controlled with `gap`/`padding` clamp expressions in the 720px media query; tweak those values to rebalance gutters while keeping the responsive scaling curve intact.【F:apps/client/src/responsive.css†L95-L154】

## Viewport regression tests
- Install dependencies (`pnpm install`) and run `pnpm --filter @hooker/client test:viewport` to execute the Playwright viewport matrix that exercises the responsive harness under the flag.【F:apps/client/package.json†L7-L17】【F:apps/client/tests/responsive/responsive.spec.ts†L1-L68】
- The harness lives at `/responsive-test` (dev/test only) and simulates kitty acceptance, discards, full trick play, and reconnect to keep the DOM assertions stable across devices.【F:apps/client/src/pages/ResponsiveTest.tsx†L1-L214】【F:apps/client/src/main.tsx†L5-L25】
