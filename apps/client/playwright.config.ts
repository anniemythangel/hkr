import { defineConfig } from '@playwright/test'

const PORT = 4173

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: 'on-first-retry',
    viewport: { width: 1280, height: 720 },
  },
  webServer: {
    command: `pnpm --filter @hooker/client dev -- --host 0.0.0.0 --port ${PORT}`,
    url: `http://127.0.0.1:${PORT}`,
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_ENABLE_RESPONSIVE: '1',
      VITE_WS_URL: 'http://localhost:0',
    },
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
