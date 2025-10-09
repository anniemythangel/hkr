# Hooker code & architecture review

## 1. High-level architecture

The project is organized as a `pnpm` workspace with shared domain models, a TypeScript game engine, a Socket.IO server, and a React client. Shared enums and snapshot contracts reside in `packages/shared`, ensuring every layer agrees on seats, suits, match rotation, and payload shapes.【F:packages/shared/src/index.ts†L1-L76】 The engine in `packages/engine` exposes pure reducers that step the match through kitty, discard, trick play, hand scoring, and rotation, producing immutable state and per-seat snapshots.【F:packages/engine/src/match.ts†L185-L400】【F:packages/engine/src/match.ts†L600-L692】 The Node server wraps those reducers, storing per-room state, broadcasting personalized snapshots, and emitting structured log/chat events for each action.【F:apps/server/src/index.ts†L122-L520】 The Vite client consumes these snapshots to drive lobby flows, a table layout, scoreboard, action console, and chat, all wired through a reconnect-aware Socket.IO hook.【F:apps/client/src/pages/Lobby.tsx†L9-L73】【F:apps/client/src/pages/Table.tsx†L11-L185】【F:apps/client/src/hooks/useSocket.ts†L68-L305】

## 2. Engine package

* **Deterministic state machine** – `createMatch` seeds an initial state with precomputed dealer decks and empty hands, while `advanceState` rotates through match setup, kitty decisions, trick play, hand scoring, and match completion without side effects.【F:packages/engine/src/match.ts†L88-L218】【F:packages/engine/src/match.ts†L360-L447】
* **Kitty and discard enforcement** – `handleKittyDecision` tracks passes, forced acceptance, and acceptor transitions; `handleDiscard` prevents throwing away the picked kitty card and ensures card ownership before mutating hands.【F:packages/engine/src/match.ts†L231-L320】
* **Trick legality and scoring** – `handlePlayCard` enforces turn order and follow-suit via `effectiveSuit` / `canFollowSuit`, determines the trick winner, and either advances to the next trick or scores the hand when all five tricks resolve.【F:packages/engine/src/match.ts†L321-L400】 The scoring helper tallies tricks per team, awards euchres, and returns normalized summaries.【F:packages/engine/src/scoring.ts†L1-L32】
* **Snapshots for clients** – `getSnapshot` redacts hidden information, exposes legal moves for the viewer, and surfaces ace-draw history for celebratory UI treatments.【F:packages/engine/src/match.ts†L600-L692】

### Engine risks & opportunities

1. **Deck provider `handNumber` placeholder** – When the optional `deckProvider` is used, `getNextDeck` always passes `handNumber: 0`, preventing callers from varying decks by hand within a game as suggested in the comment.【F:packages/engine/src/match.ts†L24-L47】 Track and increment an actual per-game hand counter before calling the provider.
2. **Verbose dealer logs** – `determineDealer` still emits `console.log` for every draw, which is noisy in production deployments and may leak game flow to server logs.【F:packages/engine/src/match.ts†L49-L59】 Replace with a debug logger or behind a feature flag.

## 3. Server package

* **Room lifecycle** – Each connection validates join payloads with Zod, instantiates a match on first join, caches roster metadata, and replays existing logs/chats to late joiners.【F:apps/server/src/index.ts†L80-L158】
* **Action handling** – `act` wraps engine reducers, emits per-player error messages, advances state until it stabilizes, and broadcasts fresh snapshots. Action-specific hooks log kitty decisions, discard privacy, trump declarations, and trick plays with actor context.【F:apps/server/src/index.ts†L160-L274】【F:apps/server/src/index.ts†L311-L359】
* **Logging improvements** – `collectLogs` now derives trick winners, hand summaries, rotation banners, match honors, and ace-draw narration directly from engine state, so the action console stays chronological and relevant.【F:apps/server/src/index.ts†L373-L470】
* **Resource limits** – Chat and log queues are trimmed to the last 200 entries to prevent unbounded growth, while roster updates are pushed whenever sockets join or disconnect.【F:apps/server/src/index.ts†L482-L513】【F:apps/server/src/index.ts†L294-L308】

### Server risks & opportunities

* None blocking noted—the server is cohesive and enforces engine rules reliably. Consider instrumenting metrics and swapping the in-memory stores for a durable backend when scaling, but that is outside the current scope.

## 4. Client application

* **Lobby UX** – Players pick a server, room, seat, and display name; the hook persists credentials in local storage and auto-reconnects when possible.【F:apps/client/src/pages/Lobby.tsx†L9-L29】【F:apps/client/src/hooks/useSocket.ts†L68-L190】
* **Real-time socket hook** – `useSocket` centralizes connection management, optimistic logs, roster updates, chat handling, and exposes helpers for emitting game actions and chat messages, trimming log buffers to 200 entries like the server.【F:apps/client/src/hooks/useSocket.ts†L86-L260】
* **Table presentation** – `TableLayout` computes the active seat, orchestrates ace-draw animation, and renders Seat panels with dealer/turn badges, legal-hand filtering, kitty/trump controls, scoreboard, trick history, console, and chat panels for a single responsive surface.【F:apps/client/src/components/TableLayout.tsx†L72-L292】
* **Scoreboard & analytics** – The scoreboard announces match progress, team membership, honors (Talson/Usha), and hand-level trick counts, mirroring what the server logs broadcast when a match ends.【F:apps/client/src/components/Scoreboard.tsx†L69-L199】

### Client risks & opportunities

1. **Forced-accept UI mismatch** – When everyone passes the kitty, the server sets `hand.forcedAccept` and reroutes `kittyOfferee` back to the initial seat, rejecting further passes.【F:packages/engine/src/match.ts†L243-L264】 The UI only disables the “Pass” button when `snapshot.kittyOfferee === snapshot.acceptor`, but `acceptor` is still `undefined` until acceptance, so the button stays enabled and invites a server error toast.【F:apps/client/src/components/TableLayout.tsx†L128-L289】 Include the forced-accept condition in the disable logic (or expose `initialOfferee` in the snapshot) so the UI reflects the rule.
2. **Unused trump badge import** – `TableLayout` imports `TrumpBadge` but never renders it, suggesting either a missing badge in the layout or dead code that should be removed to avoid confusion.【F:apps/client/src/components/TableLayout.tsx†L4-L209】 If the badge is intended, place it next to the active trick; otherwise drop the import.
3. **Accessibility polish** – Most panels expose ARIA roles, live regions, and keyboard affordances; continue QA with screen readers to ensure the ace-draw animation and celebration banner announcements do not overlap or repeat excessively, especially because audio autoplay is triggered on match completion.【F:apps/client/src/components/TableLayout.tsx†L95-L165】【F:apps/client/src/components/AceDrawAnimation.tsx†L1-L100】

## 5. Testing & quality

The engine ships a broad Vitest suite including deterministic flows, end-to-end scripted hands, rotation summaries, and property-based random hand simulations that validate legality enforcement and phase completion.【F:packages/engine/test/engine.test.ts†L1-L220】【F:packages/engine/test/engine.test.ts†L220-L400】 The client currently tests the scoreboard’s HTML output across match phases to prevent regressions in match summaries and honors display.【F:apps/client/src/components/__tests__/Scoreboard.test.tsx†L1-L76】 Consider extending UI tests to cover the action console ordering and forced-accept button states once the UI fix lands.

## 6. Summary of recommendations

1. Track and pass a real `handNumber` into `deckProvider` so deterministic deck suppliers can differentiate successive hands within the same game.【F:packages/engine/src/match.ts†L24-L47】
2. Remove or gate the verbose `console.log` output in `determineDealer` to keep production logs clean.【F:packages/engine/src/match.ts†L49-L59】
3. Disable the kitty “Pass” button during forced acceptance to mirror server-side enforcement and avoid user-facing error spam.【F:packages/engine/src/match.ts†L243-L264】【F:apps/client/src/components/TableLayout.tsx†L128-L289】
4. Either render the imported `TrumpBadge` or drop the unused import to reduce bundle noise and clarify the intended trump presentation.【F:apps/client/src/components/TableLayout.tsx†L4-L209】

Overall the codebase is thoughtfully modular, leans on deterministic reducers, and presents a polished client experience; the above adjustments will tighten UX alignment and maintainability before broader release.
