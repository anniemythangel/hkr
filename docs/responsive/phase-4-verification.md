# Phase 4 — Verification, Automation & Release

## Automated guardrails
- Playwright viewport matrix covers the required phone, tablet, and desktop breakpoints against the `/responsive-test` harness with responsive flag enabled. The suite asserts scroll containment, control visibility, hand completion, scoring updates, and reconnect stability.【F:apps/client/tests/responsive/responsive.spec.ts†L1-L94】
- Harness logic mirrors the responsive table experience without a live socket so CI can run deterministically while still exercising kitty accept, discard, trick play, scoreboard, and reconnect flows.【F:apps/client/src/pages/ResponsiveTest.tsx†L1-L214】

## Manual spot-checks
### iOS (Safari or Chrome)
1. Launch `/responsive-test` with the flag on.
2. Portrait: play through kitty accept → discard → one trick; confirm no horizontal scroll and action row sticks to bottom.
3. Rotate to landscape mid-trick; ensure trick area and hand rail remain visible, then finish the trick.
4. Trigger the chat keyboard, send a message, and dismiss keyboard verifying hand rail resumes position.
5. Complete the hand, confirm scoreboard updates and reconnect simulation restores the table.

### Android (Chrome)
1. Launch `/responsive-test` with flag on.
2. Portrait: verify Pass is disabled during forced accept, accept kitty, discard, and play two tricks.
3. Rotate to landscape, ensure sticky hand rail and trick area stay in frame; rotate back to portrait.
4. Open keyboard in chat, send a message, and ensure sticky action row remains accessible.
5. Run Simulate reconnect, confirm placeholder appears briefly and layout returns intact.

## Rollout playbook
1. Deploy with `VITE_ENABLE_RESPONSIVE=0` in production so desktop parity stays untouched.【F:apps/client/src/utils/featureFlags.ts†L1-L21】
2. Enable the flag in preview/staging and run `pnpm --filter @hooker/client test:viewport` plus the above spot checks.【F:apps/client/package.json†L7-L17】
3. After verification, flip `VITE_ENABLE_RESPONSIVE=1` in production. If any regression appears, set the flag back to `0` for an instant rollback and file a follow-up task; no hotfix deploy is required.【F:apps/client/src/utils/featureFlags.ts†L13-L23】
