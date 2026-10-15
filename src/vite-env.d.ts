/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vite-plugin-pwa/react" />

interface ImportMetaEnv {
  /** 'true' のときだけ生成AIの機能を表示する(既定は非表示) */
  readonly VITE_ENABLE_AI?: string
  readonly VITE_AI_PROXY_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
