# Displace Desktop App Implementation Plan

Build the Displace desktop application as a Tauri 2 application with a React and TypeScript interface. It will consume the versioned API through `@displace/api-client`, retain native credentials only in OS-backed secure storage, and connect directly to LiveKit for voice media. The desktop app is an API client, not a second backend: authorization, durable state, search visibility, uploads, realtime permissions, and moderation decisions remain server-authoritative.

This plan follows the near-complete server and web implementations. The server's native-client refresh-token response is the authentication contract for desktop; the web app's cookie and CSRF mechanics must not be copied into the native transport. The empty `repos/desktop` directory is intentionally treated as a new application scaffold rather than assuming reusable web internals already exist.

## Delivery Principles

- Use Tauri 2 with a Rust host, a React/TypeScript renderer, and a Vite development/build pipeline. Keep native commands narrow and capability-scoped.
- Depend on the checked-in `@displace/api-client` package for generated REST types, RFC 9457 errors, cursor conventions, realtime event maps, rich-text contracts, and runtime values. Never import NestJS, Drizzle, or server source.
- Keep the long-lived native refresh token exclusively in an OS credential store through the Rust host. Keep access tokens short-lived and in renderer memory only; never write either token to local storage, Tauri store files, logs, analytics, crash reports, URLs, or IPC payloads unrelated to authentication.
- Isolate platform behavior behind adapters: API transport/authentication, keychain access, deep links, file selection, direct uploads, notifications, application lifecycle, auto-update, and diagnostics. Feature views receive view models and capability data rather than native or wire-level APIs.
- Reuse contracts, domain adapters, and explicitly portable UI primitives from web only after they are extracted into a tested package. Do not couple the desktop build to Next.js routes, server components, browser-cookie assumptions, or undocumented web internals.
- Treat the web app as the source of truth for the Displace visual family: use its warm paper surfaces, ink, teal, teal-soft, coral, mustard, typography, restrained borders, compact radii, icon conventions, and product language. Give desktop its own identity through denser workbench layouts, persistent dark teal application chrome, desktop-native hierarchy, keyboard-first interaction, and contextual side panels rather than a separate palette or a pixel-for-pixel web replica.
- Keep shared brand tokens named and valued consistently across web and desktop. Desktop-only tokens may describe native chrome, window states, density, or platform affordances, but must derive from the shared palette and maintain the same accessibility intent.
- Design for Windows, macOS, and Linux from the start, while treating Windows as the first supported release target. Every feature must have a clear unsupported-platform or permission-denied state.
- Keep public browsing, authenticated content, offline state, and stale permissions explicit. The local cache is an optional convenience cache, never an authority for content, capability, presence, or moderation state.

## Architecture Decisions

### Application Boundaries

- `repos/desktop/src/` owns the renderer: application shell, route state, view-model adapters, feature screens, accessibility, and renderer-side state.
- `repos/desktop/src-tauri/` owns the Rust host: window/tray lifecycle, OS credential access, deep-link delivery, file dialogs, updater verification, native notifications, and narrowly defined IPC commands.
- `repos/shared/` remains the contract package. Generate its OpenAPI schema only from the server artifact and verify its checksum before a desktop production build.
- Put desktop-only TypeScript adapters under `src/lib/platform` and API/realtime adapters under `src/lib/api`; no presentational component calls `invoke`, `fetch`, `socket.io-client`, or LiveKit directly.
- Start with a single primary window. Add a tray, native notifications, deep links, and optional compact voice controls only after their behavior is covered by lifecycle tests. Do not create a second window architecture for ordinary navigation.

### Native Security Model

- Use a Rust credential-store adapter backed by the operating system's credential service (Windows Credential Manager, macOS Keychain, and Secret Service/KWallet where available). If secure storage is unavailable, offer a non-persistent session rather than a plaintext fallback.
- Use an external browser plus a registered, allowlisted custom deep-link scheme for OIDC. Bind each redirect to a one-time state and PKCE transaction stored in the native host, verify the callback origin/path, and consume the state exactly once.
- Permit only the packaged renderer origin in the Tauri content security policy. Disallow arbitrary navigation, remote script/style execution, unrestricted shell/process access, and broad filesystem access. Grant dialog, notification, deep-link, and updater capabilities only to the commands that need them.
- Use direct S3-compatible uploads only with server-issued upload intents and URLs. The renderer may stream a selected file through an upload adapter, but it never constructs object paths or gains generic filesystem access.
- Treat every server capability change, token refresh failure, permission denial, and revoked membership event as authoritative. Clear affected local state and leave protected views instead of retaining stale controls or content.

## Phases

### Phase 1: Tauri Foundation and Contract Boundary

**Status:** Complete.

**Server alignment:** Use the completed API v1 and shared generated package from server phase 11. No desktop endpoint or server-only schema is required.

1. Scaffold `repos/desktop` as a pnpm workspace package with Tauri 2, Rust, Vite, React, TypeScript, ESLint, Vitest, and a small component testing setup. Record supported Rust, Node.js, pnpm, WebView2, and platform prerequisites in its README.
2. Add production/dev configuration validation for API origin, LiveKit origin, OIDC callback scheme, updater endpoint and public key, release channel, and telemetry endpoint. Keep configuration non-secret; reject insecure production origins and malformed deep-link schemes at startup/build time.
3. Link `@displace/api-client`, require `pnpm --dir ../shared verify` and `check` in desktop builds, and create platform API/realtime adapters that normalize request IDs, idempotency keys, cursors, connectivity errors, and RFC 9457 failures.
4. Establish an application shell with dense navigation, keyboard focus management, route-level loading/error/not-found states, accessibility announcements, reduced-motion behavior, and a platform-neutral toast/confirmation system consistent with the web product language.
5. Define the native command boundary and Tauri capability files before implementing platform integrations. Add commands only for secure storage, deep links, dialogs, notifications, updater lifecycle, application metadata, and explicitly scoped diagnostics.
6. Add deterministic contract fixtures and test factories for connected, offline, unauthenticated, expired, forbidden, pending, deleted, slow, and failed states. Fixtures are test-only and never production fallback data.

### Phase 2: Native Identity, Sessions, and Account Recovery

**Status:** Complete.

**Server alignment:** Integrate with the completed identity/session API and its native refresh-token behavior.

1. Implement sign-in, registration, verification, password reset, sign-out-current, sign-out-all, session expiry, and return-to navigation using the platform API adapter.
2. Store a successful native refresh token through the credential-store command; derive short-lived access tokens through the approved refresh flow and hold them only in renderer memory. Serialize refreshes, handle refresh-token-family reuse as a forced sign-out, and remove secure storage after local or remote session revocation.
3. Implement generic OIDC in the external system browser using PKCE, a one-use host-stored transaction, and the registered deep link. Reject duplicate, expired, malformed, or state-mismatched callbacks without revealing account details.
4. Add current-profile, email, password, device/session listing, and revocation screens. Communicate verification requirements, security actions, rate limits, and non-enumerating account recovery errors from the server response.
5. Test secure-storage behavior with a test adapter, refresh races, logout cleanup, invalid/expired callbacks, deep-link replay, revoked sessions, offline startup, and recovery after the application is reopened.

### Phase 3: Places, Forum Reads, and Desktop Navigation

**Status:** Planned.

**Server alignment:** Integrate with completed place, forum, asset, and search read contracts.

1. Implement public place discovery, place selection, forum navigation, topic feeds, profiles, topic views, search entry, and member-facing route state. Support opaque keyset cursors, URL/deep-link route restoration, and no-leak handling for private, archived, missing, or unavailable resources.
2. Build capability-aware place create/edit/archive, joining, invitations, membership, role, and settings views. UI visibility is advisory; forbidden responses refresh place context and remove stale actions.
3. Render API-sanitized rich text through a reviewed ProseMirror-compatible renderer. Render only API-provided asset URLs and references; never use arbitrary HTML, storage paths, or renderer-provided document URLs.
4. Add a bounded, invalidation-driven local read cache for recently visited public and authorized resources. Encrypting an offline database is not a substitute for authorization: clear private cache entries on sign-out, membership revocation, and user-directed data removal, and avoid background synchronization of private content in the first release.
5. Test deep links into places, forums, topics, profiles, and search; cursor restoration; private-place denial; rich-text safety; cache invalidation; offline and reconnect states; keyboard navigation; and Windows high-DPI/window-resize layouts.

### Phase 4: Authoring, Media, and Durable Forum Actions

**Status:** Planned.

**Server alignment:** Integrate with completed forum and asset lifecycle APIs.

1. Add a deliberately limited ProseMirror-compatible editor matching the server allowlist. Support topic creation, chronological replies, edits, revisions, tombstones, reactions, follows, saves, read state, topic locks, and pins based on API capabilities.
2. Use idempotency keys for creates and client-generated command IDs where the API contract supports them. Use optimistic state only for reversible actions such as reactions, follows, saves, and read state; reconcile all actions against REST responses and realtime events.
3. Implement file and image selection through a scoped native dialog, direct upload-intent lifecycle, bounded progress, cancellation, intent expiration, validation/quarantine state, retry, removal, and authorization-aware asset presentation.
4. Keep attachment data limited to asset IDs and server-returned metadata. Enforce client-side size/type guidance for usability while relying on the server for quotas, content sniffing, malware policy, and authorization.
5. Test editor serialization, duplicate/retried creates, conflict and validation states, rejected uploads, expired intents, processing delays, unauthorized assets, filesystem permission denial, and restored draft behavior. Drafts must not contain refresh/access tokens or arbitrary local file paths.

### Phase 5: Realtime Chat, Presence, Notifications, and Search Convergence

**Status:** Complete.

**Server alignment:** Integrate with completed Socket.IO, durable chat, notification, and search APIs.

1. Create a single connection lifecycle manager for access-token handshakes, reconnect/backoff, room subscriptions, token refresh, membership revocation, and application suspend/resume. Keep Socket.IO events outside screens and reconcile any uncertain state against REST history.
2. Implement chat channels, history, send/edit/delete, mentions, typing, unread state, channel configuration, and notification inbox flows. Acknowledge client commands with their idempotency identifiers and reconcile duplicate/late acknowledgements safely.
3. Add native desktop notifications for newly received, authorized notifications and messages, respecting app focus, user settings, per-channel notification choices, operating-system notification permission, and privacy-safe preview preferences. Notification actions must route to authorized content and gracefully handle deleted/private targets.
4. Implement API-backed search with filters, highlights, cursor pagination, keyboard access, and a command/search entry point. Explain eventual consistency only through product state, never queue implementation details.
5. Test disconnect/reconnect, suspend/resume, token refresh during an open socket, duplicate events, notification permission denial, disabled previews, stale membership, message reconciliation, rate limits, private-search filtering, and operating-system notification routing.

### Phase 6: Voice and Native Device Experience

**Status:** Planned.

**Server alignment:** Integrate with completed voice-room policy, LiveKit token, and participant contracts.

1. Implement the place live workspace with chat and voice-room navigation, participant summaries, join/leave, microphone and output selection where supported, mute/deafen, push-to-talk, speaking indicators, and stable permission/error states.
2. Request a short-lived API join token only after an explicit join. Connect the WebView directly to LiveKit; neither Rust nor the API proxies media or retains the voice token after expiry.
3. Coordinate renderer media state with native window/tray lifecycle: clearly indicate an active voice session, prevent accidental silent background capture, and make leaving/muting reliable on window close, app quit, device loss, membership revocation, and network change.
4. Request microphone permission only when joining voice, explain denied permission without looping prompts, and provide device recovery/selection flows. Keep audio device labels and participant data out of diagnostics unless a user explicitly provides them.
5. Test controlled LiveKit connection transitions, denied/full rooms, revoked speaking/listening, microphone permission denial, device disappearance, system sleep/resume, network loss, app shutdown while connected, and voice state after reconnect.

### Phase 7: Moderation, Administration, and Desktop Workflow Polish

**Status:** Planned.

**Server alignment:** Integrate with completed moderation, instance administration, developer-token, and rate-limit contracts.

1. Implement reporting from every supported resource plus permission-gated moderation queues, evidence, assignment, reason codes, member sanctions, content moderation, topic actions, and bulk-action limits. Show only server-returned evidence and audit summaries; never reveal moderator-private notes to reporters or ordinary members.
2. Add place and instance administration screens for the non-secret settings exposed by the API. Capability changes and forbidden action responses must immediately refresh navigation and active views.
3. Add developer-token management with one-time token reveal, scopes, expiration, rotation, revocation, and last-used details. Do not persist, log, paste into diagnostics, or re-display a token after its initial server response.
4. Provide desktop-focused productivity behavior: platform-standard keyboard shortcuts, accessible context menus, copy/deep-link actions, unsaved-change prompts, predictable multi-window prevention, and a concise diagnostics/export flow that excludes sensitive content by construction.
5. Test moderator/reporting privacy, token one-time display, capability revocation during an open workflow, rate-limit handling, shortcut conflicts, diagnostics redaction, and screen-reader keyboard operation.

### Phase 8: Release Hardening, Updates, and Distribution

**Status:** Planned.

**Server alignment:** Complete alongside server and web production-readiness work.

1. Configure a restrictive CSP, Tauri permissions/capabilities, navigation allowlists, external-link handling, trusted updater endpoints, signed update manifests, signed installers, crash/error boundaries, and client-safe structured diagnostics.
2. Define release channels, semantic versioning, rollback/disable-update policy, code-signing/notarization ownership, installer formats, and support lifecycle for Windows first, then macOS and Linux. Updates must be verified before installation and never execute arbitrary release metadata.
3. Add bounded telemetry only after explicit configuration/consent decisions. Correlate with server request IDs where available while excluding tokens, email addresses, message bodies, rich-text documents, upload metadata, precise presence, and voice/device data.
4. Document local setup, API/LiveKit test topology, developer certificates, platform packaging, release signing, incident rollback, secure-storage migration, support diagnostics, and known platform constraints in `repos/desktop/README.md` and operational runbooks.
5. Run the full acceptance journey: authenticate; join/create a place; configure permitted settings; create/search/read/follow/save/reply/upload/react; chat and receive notifications; join voice; report and moderate content; manage a scoped API token; restart/reconnect; and update the application without losing authorized state.

## Project Structure

```text
repos/desktop/
  README.md
  package.json
  pnpm-workspace.yaml
  vite.config.ts
  tsconfig.json
  src/
    app/
    components/
    features/
    lib/
      api/
      platform/
      realtime/
    test/
  src-tauri/
    Cargo.toml
    tauri.conf.json
    capabilities/
    src/
      commands/
      credentials/
      deep_links/
      notifications/
      updater/
```

The structure intentionally mirrors the web separation between presentation, feature adapters, and transport while preserving a hard Rust/native boundary. Shared UI extraction is a follow-up only when a component has a stable API, no Next.js/server-rendering dependency, and matching renderer accessibility tests.

## Quality Gates

1. From `repos/desktop`, run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm --dir ../shared verify && pnpm --dir ../shared check` before merging a feature slice.
2. Run Rust formatting, linting, unit tests, and `cargo tauri build --debug` for the host. Add Windows WebView2 smoke coverage before declaring Windows support.
3. Exercise renderer routes with deterministic API/Socket.IO/LiveKit mocks, then run contract-critical journeys against the Compose API, worker, PostgreSQL, Redis, MinIO, Meilisearch, Mailpit, LiveKit, and coturn topology.
4. Test fresh install, upgrade, downgrade/rollback policy, secure-storage migration, sign-out cleanup, offline launch, connectivity recovery, external-link handling, malformed deep links, updater-signature failure, and a no-remote-content CSP audit.
5. Validate keyboard-only use, screen-reader semantics, high contrast, scaling at 100%, 150%, and 200%, reduced motion, narrow window widths, and permission-denied paths on every supported platform before release.

## Relevant Files

- [`README.md`](../README.md) - product intent and the intended Tauri/Rust desktop architecture.
- [`docs/server-api-implementation-plan.md`](server-api-implementation-plan.md) - API, authentication, upload, realtime, voice, moderation, and developer-token contracts.
- [`docs/web-app-implementation-plan.md`](web-app-implementation-plan.md) - completed web workflows and transport boundary patterns to mirror without coupling to Next.js.
- [`repos/shared/README.md`](../repos/shared/README.md) - generated API contract and platform-adapter responsibilities.
- [`repos/desktop/`](../repos/desktop/) - implemented Tauri application root.

## Explicit Non-Goals for the First Desktop Release

- A desktop-owned backend, direct database/search access, or bypass of API authorization.
- A plaintext token/cache fallback when OS-backed credential storage is unavailable.
- Direct messages, end-to-end encryption, video/screen sharing, billing, federation, or native push-provider infrastructure beyond operating-system local notifications.
- Background capture, activity surveillance, or persistent local voice/presence history.
- A wholesale shared UI rewrite before the web and desktop implementations identify stable portable primitives.