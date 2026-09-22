# Displace Web App Implementation Plan

Build the Displace web application as a server-rendered Next.js client that makes public forum content discoverable while providing a fast, accessible application experience for members. The web app will consume the versioned API through a dedicated, generated client boundary; it will not import NestJS classes, Drizzle schemas, or server-internal types.

This plan is intentionally coordinated with the [server API implementation plan](server-api-implementation-plan.md). Runtime features integrate with the versioned API from the start; deterministic fixtures are limited to tests that need controlled API payloads.

## Delivery Principles

- Render public place, forum, topic, and search pages on the server for crawlability, canonical URLs, metadata, and social previews. Use static generation or incremental revalidation only for public data that can safely be cached.
- Keep authenticated and permission-sensitive data dynamic. Do not place session, membership, notification, moderation, or private-content responses in shared server caches.
- Isolate all HTTP, authentication headers, cursor handling, RFC 9457 problem details, and Socket.IO/LiveKit integration in data-access and transport modules. Screens and UI components receive domain view models rather than raw API DTOs.
- Treat API OpenAPI output as the client contract. Until generated artifacts are available, use small hand-authored contract types and test-only payloads that mirror the documented endpoint shapes.
- Preserve optimistic interactions only where an idempotency key or client-generated command identifier makes retry safe. Reconcile every optimistic mutation with the authoritative API response or realtime event.
- Keep public and private rendering paths explicit. Public reads may use server-side API requests; browser-side authenticated mutations use credentialed API calls with CSRF protection and request IDs as required by the API contract.
- Design desktop-first dense community workflows, then validate all routes at narrow mobile widths with accessible navigation, keyboard operation, focus management, meaningful empty/error states, and reduced-motion support.

## Phases

### Phase 1: Application Foundation and Contract Boundary

**Status:** Complete as of 2026-09-20.

**Server alignment:** Can begin immediately alongside API phases 1-2. It depends only on the documented `/api/v1` conventions and OpenAPI availability, not on domain endpoints.

1. Establish the App Router structure for public routes, authenticated routes, place-scoped routes, and modal/intercepting-route conventions. Define stable URL shapes for discovery, places, forums, topics, account settings, moderation, and administration before feature implementation begins.
2. Extract the initial scaffold into reusable layout, navigation, avatar, list, status, empty-state, error-state, and loading components. Preserve its existing visual language while replacing anchor placeholders with route-aware navigation.
3. Add a data-access layer with separate public server-read, authenticated browser-read/mutation, and realtime transport adapters. Centralize API base URL resolution, `credentials: "include"`, `X-Request-Id`, `X-CSRF-Token`, idempotency keys, cursor serialization, and RFC 9457 error normalization.
4. Create fixture factories and request-interception-based contract mocks for every route under active development. Fixtures must include anonymous, unauthenticated, pending, forbidden, empty, deleted, slow, and failed states rather than only ideal content.
5. Establish application-wide typography, tokens, responsive layout rules, icon-button conventions, forms, dialogs, toast/error presentation, and accessible focus/announcement behavior. Use the current Tailwind CSS and Lucide setup rather than introducing a second UI system.
6. Add unit tests for view-model adapters and interaction primitives, route-level rendering tests, lint/type/build checks, and browser smoke coverage against the development API.

### Phase 2: Public Discovery and SEO-Ready Reads

**Status:** Complete as of 2026-09-21.

**Server alignment:** Build in parallel with API phases 2-4; connect incrementally as place discovery and public read operations stabilize.

1. Implement a public landing/discovery route, place profile route, forum navigation route, topic route, and profile summary route. Ensure every public page has canonical metadata, Open Graph metadata, a meaningful document title, and a no-index response for private or unavailable resources.
2. Build server-rendered topic listings with opaque keyset cursor navigation, filter state encoded in URLs, loading skeletons, empty results, and graceful handling for removed/tombstoned content.
3. Render rich-text API output only through a narrowly scoped, reviewed renderer. Never inject arbitrary HTML or allow client-provided storage URLs; render server-sanitized content and asset references supplied by the API.
4. Add a public error/not-found strategy that distinguishes unknown, private, archived, and unavailable resources without leaking private place existence.
5. Add route tests for metadata, crawlable HTML, cursor forwarding, and cache/revalidation behavior. Verify public pages work with fixture adapters before switching their reads to API responses.

### Phase 3: Identity, Session, and Account Settings

**Status:** Complete as of 2026-09-21.

**Server alignment:** Build in parallel with API phase 3 and integrate once its auth endpoints, cookie policy, and CSRF flow are available.

1. Implement registration, sign-in, email verification, password reset, OIDC callback, sign-out, and session-expired screens with deliberate return-to navigation and account-enumeration-safe user messaging.
2. Add a session bootstrap provider that loads the current user without treating client state as authorization. Recover from expired access credentials through the server-approved refresh flow, and redirect to sign-in only after an authoritative unauthenticated response.
3. Implement profile, email, password, device/session list, and session revocation routes. Surface verification, pending security action, and API rate-limit states clearly.
4. Integrate browser CSRF token acquisition and inclusion through the transport adapter, never individual form components. Keep refresh cookies HttpOnly and out of React state, local storage, URLs, logs, and analytics.
5. Add end-to-end coverage for core auth journeys against an API test environment, including expired sessions, invalid CSRF tokens, password reset, logout-all, and forbidden redirects.

### Phase 4: Places, Membership, Roles, and Settings

**Status:** Complete as of 2026-09-20.

**Server alignment:** Build in parallel with API phase 4; use stable place/membership operations as each screen is completed.

1. Implement authenticated place switching, create/edit/archive forms, discovery filters, join/leave/request flows, invitation acceptance, member directory, and member profiles.
2. Build permission-aware navigation and controls from server-provided capabilities. The UI may hide unavailable actions for clarity, but API authorization remains authoritative and forbidden responses must update stale UI state.
3. Implement place settings for identity, visibility, join policy, and roles. Create role/member permission editors that prevent accidental owner removal and explain blocked actions returned by the API.
4. Support configured single-place deployments by omitting unsupported discovery/create paths based on public instance configuration, without adding a separate client application or URL scheme.
5. Validate anonymous public browsing, private-place denial, approval membership, invitation-only membership, ownership transfer, and permission-change refreshes in integration/e2e tests.

### Phase 5: Forum Authoring and Durable Discussion

**Status:** Complete as of 2026-09-21.

**Server alignment:** Build in parallel with API phase 5. The content editor can be implemented and tested with local document fixtures before write endpoints are enabled.

1. Implement forum group/forum navigation, latest/popular/following feeds, tag filters, saved items, topic follows, unread indicators, and topic read-state updates.
2. Adopt a ProseMirror-compatible editor with a deliberately limited extension set matching the server allowlist. Serialize versioned JSON documents only; preview through the same safe rendering boundary used for public reads.
3. Implement topic creation, chronological replies, edit/revision views, soft-delete tombstones, reactions, follows, saves, locks, and pins, with capability-driven controls and idempotent create/reply retries.
4. Support mention suggestions through an authorized, debounced member lookup rather than scraping member data from rendered pages. Display server-resolved mentions as links or safe plain text based on response data.
5. Use optimistic UI only for reversible actions such as reactions, follows, saves, and read state. Create/edit/delete flows must display pending, conflict, validation, retry, and server-reconciled states.
6. Add editor serialization tests, rendered rich-text safety tests, feed cursor tests, and browser journeys for writing, revising, restoring navigation state, and handling deleted content.

### Phase 6: Uploads and Media Presentation

**Status:** Complete as of 2026-09-21.

**Server alignment:** Build in parallel with API phase 6, independent of the forum write work except for final attachment controls.

1. Implement a reusable upload controller that requests an upload intent, uploads directly to the provided S3-compatible URL, reports progress, finalizes completion, and polls or subscribes to validation status where necessary.
2. Enforce client-side size/type guidance for usability while relying on the server for all quota, MIME, content-sniffing, and authorization enforcement. Do not construct object-storage URLs in the client.
3. Add attachment, profile image, and place image selectors with crop/preview where supported, quarantine/processing status, removal, retry, and accessible error messages.
4. Render media only from authorization-aware asset URLs returned by the API, with bounded dimensions, lazy loading, descriptive alt text, and non-media fallbacks.
5. Test failed uploads, expired intents, quota denial, processing delays, unauthorized assets, and a successful direct-upload lifecycle against the development object store.

### Phase 7: Search and Background-Convergent Data

**Server alignment:** Begin after the API phase 7 search contract, authorization filtering, and development index are available.

1. Implement a dedicated search route with URL-encoded query/filter state, type/place filters, keyset cursor results, result highlights, empty states, and a keyboard-accessible command/search entry point.
2. Clearly communicate eventual consistency after writes without exposing queue internals. A just-created topic can be navigated directly even before it appears in search.
3. Merge API search responses into stable result view models for places, topics, and posts. Respect all server visibility decisions; never query Meilisearch from the browser.
4. Render notification and counter values as advisory snapshots that refresh from authoritative endpoints and realtime events, avoiding local arithmetic that can drift across sessions.
5. Add e2e tests for public/private filtering, pagination, highlights, rate limits, and indexing delay/reconciliation scenarios.

### Phase 8: Realtime Chat, Presence, and Notifications

**Server alignment:** Build in parallel with API phase 8. Implement gateway and state adapters against a mocked Socket.IO server before the production gateway is connected.

1. Create a connection lifecycle manager for access-token handshakes, reconnects, backoff, server-initiated permission changes, and subscription cleanup. Keep socket events outside presentational components.
2. Implement chat channel navigation, channel configuration, durable message history, send/edit/delete, mention rendering, read state, unread counts, reconnect reconciliation, and client-command idempotency.
3. Implement a notification inbox with unread counts, mark-read/dismiss actions, realtime inserts, pagination, and safe navigation to potentially unavailable targets.
4. Add coarse presence and typing indicators with explicit transient state. Do not persist or infer activity history in the UI.
5. Test duplicate acknowledgements, late events, disconnect/reconnect behavior, revoked membership, permission changes, and reconciliation with REST history.

### Phase 9: Voice Experience

**Status:** Complete as of 2026-09-22.

**Server alignment:** Build in parallel with API phase 9 after the realtime connection layer is established.

1. Implement place voice-room navigation, room ordering, participant summaries, join/leave controls, microphone selection, output selection where browser support allows, mute/deafen controls, and clear connection/error states.
2. Request a short-lived join token only after the user elects to join, then connect the browser directly to LiveKit. Do not proxy media through Next.js or retain voice tokens after they expire.
3. Update the interface from authorized room and participant events while treating LiveKit/API data as the source of truth for room membership and moderation restrictions.
4. Handle denied joins, full rooms, revoked speaking privileges, device permission denial, network loss, and reconnection without leaving misleading local participant state.
5. Run browser tests with a controlled LiveKit environment for token issuance, connection transitions, mute state, room capacity, and permission changes.

### Phase 10: Moderation and Instance Administration

**Server alignment:** Build in parallel with API phase 10 once role/capability UI primitives are available.

1. Implement report creation from topics, posts, chat messages, members, and places. Capture user-visible evidence only through server-returned resource data and clearly separate reporter notes from moderator-private notes.
2. Build permission-gated moderation queues with filters, assignment, reason codes, evidence, action confirmation, bulk-action limits, and case status updates.
3. Implement member warnings, timeouts, bans, content hide/restore, topic actions, and chat removal with server-provided before/after summaries and authoritative audit results.
4. Add instance administration for configuration exposed by the API, registration mode, public policy links, feature availability, and bootstrap-admin guidance. Never display environment secrets or raw operational credentials.
5. Test reporter privacy, moderator capability changes, forbidden action recovery, audited actions, bulk limits, and live updates to moderated content.

### Phase 11: Generated Client, Developer Surface, and Release Quality

**Server alignment:** Integrate with API phase 11 and prepare jointly for phase 12.

1. Replace interim API DTOs and mocks with the versioned generated TypeScript package from `repos/shared`. Keep adapters so generated transport types do not become the UI component contract.
2. Generate a checked-in API compatibility report in CI and fail the web build when a consumed OpenAPI operation or schema changes incompatibly. Regenerate the package and update adapters intentionally.
3. Surface standard `RateLimit-*`, `Retry-After`, validation, and RFC 9457 errors consistently across forms, background loads, chat, search, and uploads.
4. Implement personal access token management screens with one-time secret reveal, scopes, expiry, rotation, revocation, and last-used information. Never render a token again after its initial display.
5. Add visual regression coverage for primary viewport classes, accessibility audits for shared primitives and critical workflows, and integration coverage against the generated client package.

### Phase 12: Production Readiness and Acceptance

**Server alignment:** Complete with API phase 12.

1. Define environment configuration for the public API origin, public web origin, and observability endpoint settings. Validate configuration at build/startup and keep secrets server-only.
2. Configure security headers, Content Security Policy, image/media origins, route-specific robots behavior, error boundaries, offline/retry affordances, and graceful dependency-outage messaging.
3. Add client-safe telemetry with request/job correlation IDs supplied by the API where available. Exclude credentials, email addresses, message bodies, rich-text documents, uploads, and other sensitive content from browser logs and analytics.
4. Verify production builds, static/dynamic rendering boundaries, API/asset cross-origin policies, authentication cookies, CSRF, websocket connectivity, LiveKit connectivity, and no private response leakage through caches.
5. Run the end-to-end acceptance journey: discover a public place; register and verify; join or create a place; configure roles/forums/chat/voice; create/search/read/follow/save a topic; reply/upload/react; chat and receive notifications; join voice; report and moderate content; manage a scoped API token; then reconnect after service restarts.

## Shared Contract Workflow

1. The API team publishes versioned OpenAPI output from `/api/docs` or its CI artifact whenever an endpoint moves from provisional to consumable.
2. The web team updates generated artifacts in `repos/shared`, then changes only the relevant data-access adapter and its contract fixtures.
3. Both teams run the endpoint's API integration test plus the corresponding web route/component/e2e test before calling that slice integrated.
4. API schema changes remain backward-compatible within a web release train. Breaking changes require a new API version or coordinated feature flag, generated-client update, and migration test.
5. Deterministic API mocks remain available for visual and failure-state tests, but the application has no runtime fixture adapter or production fallback.

## Relevant Files

- [`repos/web/src/app/page.tsx`](../repos/web/src/app/page.tsx) - root route that resolves into API-backed discovery or the configured single place.
- [`repos/web/src/app/layout.tsx`](../repos/web/src/app/layout.tsx) - root metadata, global providers, and document shell.
- [`repos/web/src/app/globals.css`](../repos/web/src/app/globals.css) - existing visual tokens and responsive styling baseline.
- [`repos/web/package.json`](../repos/web/package.json) - web scripts and dependencies.
- [`repos/web/README.md`](../repos/web/README.md) - local web setup and quality commands.
- [`repos/server/src/configure-app.ts`](../repos/server/src/configure-app.ts) - API versioning, CORS, cookie, CSRF-header, request-ID, and OpenAPI conventions consumed by the web transport.
- [`docs/server-api-implementation-plan.md`](server-api-implementation-plan.md) - coordinating API phase and contract dependency plan.
- `repos/shared/` - generated, versioned TypeScript API client and DTO package once API phase 11 is available.

## Verification

1. For every web phase, run `pnpm lint` and `pnpm build` from `repos/web`, plus focused unit, route, and browser tests for the completed slice.
2. For every API-connected slice, run its corresponding server unit/integration/e2e coverage and verify generated client compatibility before merging.
3. Test public pages with JavaScript disabled or delayed, authenticated pages with expired/revoked sessions, and responsive layouts at mobile, tablet, and desktop widths.
4. Verify anonymous/private boundaries, stale permissions, cross-place URLs, invalid cursors, RFC 9457 responses, rate-limit exhaustion, duplicate mutations, network interruption, and reconnect behavior.
5. Before release, run the full acceptance journey against the Compose development topology and inspect page source, metadata, cache headers, browser console, accessibility results, and production build output.