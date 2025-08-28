/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TURNKEY_API_BASE_URL: string
  readonly VITE_TURNKEY_API_PRIVATE_KEY: string
  readonly VITE_TURNKEY_API_PUBLIC_KEY: string
  readonly VITE_TURNKEY_ORGANIZATION_ID: string
  readonly VITE_TURNKEY_SIGNING_KEY_ID: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}