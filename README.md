# Hooker Euchre Engine Demo

Hooker is a real-time multiplayer implementation of the Sri Lankan trick-taking game popularly known as "Hooker." The monorepo contains a reusable game engine, a Socket.IO server that orchestrates rooms, and a React client that renders an accessible, data-rich table experience. Gameplay flows through the core engine state machine, while the server relays snapshots, logs, and chat updates to connected seats in each room.【F:packages/engine/src/match.ts†L24-L200】【F:apps/server/src/index.ts†L122-L292】【F:apps/client/src/pages/Table.tsx†L11-L185】

## Repository structure

| Path | Description |
| --- | --- |
| `packages/shared` | Shared enums and types for cards, seating, match rotation, and snapshot payloads consumed by every package.【F:packages/shared/src/index.ts†L1-L76】 |
| `packages/engine` | Deterministic game engine that models the kitty flow, trick play, scoring, and match rotation utilities.【F:packages/engine/src/match.ts†L185-L400】 |
| `apps/server` | Socket.IO host that maintains per-room state, applies engine reducers, and pushes snapshots, logs, and chat to clients.【F:apps/server/src/index.ts†L122-L520】 |
| `apps/client` | Vite + React application with lobby, table layout, scoreboard, console, chat, and trick history panels driven by live snapshots.【F:apps/client/src/pages/Lobby.tsx†L9-L73】【F:apps/client/src/pages/Table.tsx†L120-L185】 |

The workspace is managed by `pnpm`, and the root `package.json` exposes convenience scripts for building shared packages, running the development server, and executing tests.【F:package.json†L1-L16】

## Getting started

1. **Install dependencies**
   ```bash
   pnpm install
   ```
2. **Build shared libraries** (needed once before running the Node server)
   ```bash
   pnpm build:shared
   pnpm build:engine
   ```
3. **Start the Socket.IO server**
   ```bash
   pnpm dev:server
   ```
4. **Start the Vite client** (in a separate terminal)
   ```bash
   pnpm dev:client
   ```

The client defaults to `http://localhost:3001` for WebSocket traffic, matching the server’s default port. You can point the UI at a different backend by exporting `VITE_WS_URL` when starting Vite or by entering an alternate URL in the lobby form.【F:apps/server/src/index.ts†L17-L24】【F:apps/client/src/pages/Lobby.tsx†L6-L70】【F:apps/client/src/pages/Table.tsx†L14-L36】

## Gameplay flow

1. **Lobby & seating** – Players choose a server, room ID, seat (A–D), and display name. We persist the last successful seat in local storage for fast reconnects.【F:apps/client/src/pages/Lobby.tsx†L9-L29】【F:apps/client/src/hooks/useSocket.ts†L68-L131】
2. **Room sync** – The server creates a match on first join, auto-advances phases as needed, and streams personalized snapshots (hands, legal plays, trick state) plus shared logs and chat history.【F:apps/server/src/index.ts†L138-L223】【F:apps/server/src/index.ts†L311-L370】
3. **Acting & logging** – Client actions (`kittyDecision`, `discard`, `declareTrump`, `playCard`) are validated through the engine; success triggers log entries and another round of auto-advancement so every seat stays in sync.【F:apps/server/src/index.ts†L160-L274】【F:packages/engine/src/match.ts†L205-L400】
4. **Table presentation** – The table layout highlights the active seat, renders kitty/trump controls, animates the ace draw reveal, and shows a per-team scoreboard, trick history grid, action console, and chat feed.【F:apps/client/src/components/TableLayout.tsx†L72-L292】【F:apps/client/src/components/Scoreboard.tsx†L69-L199】【F:apps/client/src/components/ConsolePanel.tsx†L18-L73】【F:apps/client/src/components/ChatBox.tsx†L1-L64】

## Testing

Run the full test suite with:

```bash
pnpm test
```

The engine package includes deterministic and property-based tests for kitty logic, trick legality, scoring, and rotation summaries, while the client exercises key rendering paths like the scoreboard.【F:packages/engine/test/engine.test.ts†L1-L220】【F:apps/client/src/components/__tests__/Scoreboard.test.tsx†L1-L76】

