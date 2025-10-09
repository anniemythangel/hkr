/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_WS_URL?: string
  readonly VITE_ENABLE_RESPONSIVE?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
