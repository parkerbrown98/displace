/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_ORIGIN?: string;
  readonly VITE_LIVEKIT_ORIGIN?: string;
  readonly VITE_OIDC_CALLBACK_SCHEME?: string;
  readonly VITE_UPDATER_ENDPOINT?: string;
  readonly VITE_UPDATER_PUBLIC_KEY?: string;
  readonly VITE_RELEASE_CHANNEL?: string;
  readonly VITE_TELEMETRY_ENDPOINT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}