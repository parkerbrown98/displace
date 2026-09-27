# Displace Desktop

The desktop client is a Tauri 2 application with a React and TypeScript renderer. It consumes the server-owned API through `@displace/api-client`; it does not contain backend or authorization logic.

## Prerequisites

- Node.js 22 or later
- pnpm 10 or later
- Rust 1.77.2 or later with the stable MSVC toolchain on Windows
- Microsoft Edge WebView2 Runtime
- Windows 10 version 1803 or later for Windows Credential Manager support

macOS builds require Xcode command-line tools. Linux builds require the Tauri 2 system libraries, WebKitGTK, and a working Secret Service or KWallet provider for persistent sessions. When OS credential storage is unavailable, authentication must remain non-persistent.

## Setup

From this directory:

```powershell
Copy-Item .env.example .env.local
pnpm install
pnpm tauri dev
```

The default development API is `http://localhost:3001` and LiveKit is `ws://localhost:7880`. Start the repository development stack from the repository root when live services are needed:

```powershell
docker compose --env-file .env.example -f compose.dev.yaml up --build
```

## Configuration

All renderer configuration is non-secret and uses Vite environment variables:

| Variable | Purpose |
| --- | --- |
| `VITE_API_ORIGIN` | Server origin; HTTPS is required in production. |
| `VITE_LIVEKIT_ORIGIN` | LiveKit origin; WSS or HTTPS is required in production. |
| `VITE_OIDC_CALLBACK_SCHEME` | Lowercase custom callback scheme; HTTP(S) is rejected. |
| `VITE_UPDATER_ENDPOINT` | Optional HTTPS update manifest endpoint. |
| `VITE_UPDATER_PUBLIC_KEY` | Public verification key, required with the update endpoint. |
| `VITE_RELEASE_CHANNEL` | `development`, `nightly`, `beta`, or `stable`. |
| `VITE_TELEMETRY_ENDPOINT` | Optional HTTPS telemetry endpoint. |

Production builds reject absent or insecure required values. The checked-in deep-link scheme is development-only; release configuration must override both the Tauri bundle scheme and `VITE_OIDC_CALLBACK_SCHEME` with the registered production scheme.

## Commands

```powershell
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm contract:check
pnpm tauri dev
pnpm tauri build --debug
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

`pnpm build` verifies the checked-in OpenAPI contract before building. Access tokens remain in renderer memory. The Rust host can write, check, and clear a refresh token, but intentionally provides no command that reads its value back into JavaScript.

## Boundaries

- Presentational components do not call Tauri, REST, realtime, or LiveKit APIs.
- Renderer platform calls live under `src/lib/platform`; API and connectivity behavior live under `src/lib/api` and `src/lib/realtime`.
- Native capabilities are restricted to the primary window and the declared deep-link, file-dialog, notification, and updater plugins.
- Diagnostics contain only application version, platform, architecture, and secure-storage availability. They contain no tokens, account data, message content, paths, or device names.

## Design Direction

The web app defines the shared Displace visual family: warm paper surfaces, ink, teal, teal-soft, coral, mustard, Trebuchet body copy, Georgia display type, restrained borders, compact radii, Lucide icons, and direct product language. Keep these core tokens aligned when either client evolves.

Desktop should remain recognizably its own application. Its identity comes from persistent dark teal application chrome, a denser three-pane workbench, desktop-native hierarchy, keyboard-first flows, contextual rails, and explicit connectivity or lifecycle state. Do not introduce a separate brand palette, and do not reproduce responsive web page compositions pixel for pixel.