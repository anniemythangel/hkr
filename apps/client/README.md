# Client App

This package contains the Vite + React client for the Hooker demo table. It connects to the Socket.IO server and renders the action console, chat, and table UI.

## Getting started

```bash
pnpm install
pnpm --filter client dev
```

By default the client attempts to connect to `http://localhost:3001`. You can override this by creating a `.env.local` file in `apps/client` with a `VITE_WS_URL` entry:

```
VITE_WS_URL=http://localhost:3001
```

Restart the dev server after changing environment variables.
