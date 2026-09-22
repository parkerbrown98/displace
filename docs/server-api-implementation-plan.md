# Complete Displace Server API Plan

Build the documented Displace backend as a phased, production-ready NestJS/Fastify system. The implementation will preserve the existing strict ESM scaffold, use PostgreSQL 18 through Drizzle for authoritative state, Redis/BullMQ for ephemeral state and jobs, MinIO for uploads, Meilisearch for discovery, and LiveKit for voice. Each phase is independently deployable and testable; shared client types are generated from OpenAPI rather than coupling clients to server source.

## Steps

### Phase 1: Runtime and API Contract Foundation

**Status:** Complete as of 2026-09-20.

1. Replace the scaffold root response with a versioned API foundation while retaining Swagger at `/api/docs`.
   - Enable URI versioning under `/api/v1` and expose `/api/v1/health/live` plus dependency-aware `/api/v1/health/ready`.
   - Add validated configuration for PostgreSQL, Redis, S3, Meilisearch, LiveKit, SMTP/OIDC, session secrets, public URL, single-place mode, body/upload limits, CORS origins, and trusted proxies. Fail startup on invalid or production-insecure values.
   - Configure global DTO validation, serialization, RFC 9457 problem details, request IDs, structured Pino logging with secret redaction, Helmet, compression, CORS, cookie parsing, shutdown hooks, and conservative request body limits.
   - Establish reusable `CurrentUser`, `CurrentPlace`, authorization guard, pagination, idempotency-key, audit-context, and clock/token abstractions. Keep controllers transport-only; services own use cases; repositories own Drizzle queries.
   - Define OpenAPI conventions: bearer/cookie authentication, opaque keyset cursors, consistent error schemas, `Idempotency-Key` for retryable creates, and `X-Request-Id` propagation.

### Phase 2: Database, Migrations, and Test Harness

**Status:** Complete as of 2026-09-21.

2. Add Drizzle with `pg` pooling, migration tooling, and PostgreSQL conventions. *Depends on step 1.*
   - Require PostgreSQL 18 and use built-in UUIDv7 defaults for externally visible identifiers, `timestamptz` timestamps, lowercase identifiers, explicit foreign keys/check constraints, indexes on every foreign key, and composite indexes matching feed/query order.
   - Use keyset pagination throughout; never expose unbounded list endpoints or offset pagination.
   - Separate migration-owner and runtime roles, revoke public schema privileges, configure a bounded runtime pool, and keep all transactions short. Enforce place scope in repository APIs and authorization services; PostgreSQL RLS is deliberately deferred until policies can be proven without breaking public cross-place discovery.
   - Create core tables: `instance_settings`, `users`, `user_emails`, `external_identities`, `sessions`, `auth_tokens`, `places`, `place_members`, `roles`, `role_permissions`, `member_roles`, `invites`, `bans`, `outbox_events`, `idempotency_keys`, and `audit_log`.
   - Add migration, seed, reset, and initial-admin CLI scripts. Seed only deterministic development fixtures; never seed production automatically.
   - Build test application/database factories, transaction-safe fixture builders, and integration suites using disposable PostgreSQL/Redis containers. Add `test:integration`, `test:e2e`, `db:generate`, `db:migrate`, `db:seed`, and `worker:*` scripts.

### Phase 3: Identity and Sessions

**Status:** Complete as of 2026-09-20.

3. Implement first-party authentication and account lifecycle. *Depends on step 2.*
   - Add registration, email verification, login, logout-current/logout-all, refresh rotation, forgot/reset password, current profile, email change, password change, and session/device listing/revocation.
   - Hash passwords with Argon2id. Use 15-minute signed access JWTs and 30-day opaque rotating refresh tokens stored only as hashes; detect token-family reuse and revoke the family. Web receives an HttpOnly Secure SameSite cookie plus CSRF protection; native clients may receive the refresh token in the response for secure OS storage.
   - Add generic OIDC authorization-code + PKCE integration with state/nonce validation and account-linking rules. Secrets stay in environment/secret storage; provider metadata and enabled state are configuration.
   - Deliver verification/reset mail through an SMTP adapter with development capture support and BullMQ jobs. Rate-limit all credential and token endpoints by IP and account identifier without leaking account existence.

### Phase 4: Places, Membership, and Permissions

**Status:** Complete as of 2026-09-20.

4. Implement the multi-place tenancy model and single-place deployment policy. *Depends on step 3.*
   - Add place create/read/update/archive, slug lookup, public discovery, membership list/profile, join/leave/request/approve flows, invites, ownership transfer, and place settings.
   - Support visibility (`public`, `unlisted`, `private`) and join policy (`open`, `approval`, `invite_only`). Anonymous users may read public places and public forum content; all writes require a verified account and membership as policy dictates.
   - Implement customizable roles with immutable permission identifiers and explicit grants for place management, roles, members, forums, topics, posts, chat, voice, uploads, and moderation. Seed Owner/Admin/Moderator/Member roles and prevent privilege escalation, last-owner removal, and cross-place resource access.
   - In single-place mode, lock creation/discovery to the configured place without changing the schema or endpoint implementation.

### Phase 5: Forum Domain and Durable Content

**Status:** Complete as of 2026-09-20.

5. Implement the forum-first content model. *Depends on step 4.*
   - Add ordered forum groups, forums, forum-level visibility/write permissions, tags, topics, posts, post revisions, reactions, topic follows, saved topics/posts, and per-member topic read state.
   - Topics contain flat chronological posts. Store a versioned ProseMirror-compatible JSON document as the source, derive sanitized HTML and plain text server-side, validate node/mark allowlists, normalize links, resolve mentions, and retain immutable edit revisions.
   - Add REST families for forum navigation; topic feeds (`latest`, `popular`, `following`); topic creation/read/update; reply/edit/delete; lock/unlock; pin/unpin; reactions; follow/unfollow; save/unsave; and mark-read/unread state.
   - Use `(created_at, id)` or rank/time compound cursors. Maintain reply/latest-post counters transactionally; buffer high-volume view counts in Redis and flush/reconcile through jobs.
   - Soft-delete user content to preserve thread integrity and audit evidence. Return tombstones to readers while allowing authorized moderators to inspect revisions.

### Phase 6: Uploads and Media

**Status:** Complete as of 2026-09-21.

6. Implement S3-compatible upload lifecycle. *Parallel with step 5 after step 4.*
   - Add `assets` and `upload_intents`, per-place/user quotas, MIME/size allowlists, short-lived presigned upload URLs, completion verification against object metadata, orphan cleanup, and authorization-aware download URLs.
   - Process images in a worker using content sniffing rather than extensions, strip unsafe metadata, generate bounded variants, and keep objects private unless attached to public content.
   - Provide an optional malware-scanner adapter for production; assets remain quarantined until required validation completes. Rich-text and profile/place images reference asset IDs, never arbitrary storage keys.

### Phase 7: Jobs, Outbox, and Search

7. Add a separately runnable BullMQ worker and reliable integration events. *Depends on steps 2 and 5; media queues also depend on step 6.*
   - Persist domain events in `outbox_events` in the same transaction as writes; dispatch idempotently to `search`, `mail`, `media`, `notifications`, `counters`, and `maintenance` queues.
   - Add retry/backoff/dead-letter policy, deterministic job IDs, graceful worker shutdown, queue health, and admin-only failed-job inspection/retry commands.
   - Create Meilisearch indexes for public places/topics/posts and member-visible content with filterable place/visibility fields. Index only sanitized text; query through the API so Meilisearch credentials and authorization filters are never client-visible.
   - Implement `/api/v1/search` with query length/rate limits, type/place filters, cursor pagination, highlights, typo tolerance, and eventual-consistency tests. Add full reindex and reconciliation CLI jobs.

### Phase 8: Realtime, Chat, Presence, and Notifications

8. Add authenticated Socket.IO gateways backed by the Redis adapter. *Depends on steps 3-5 and step 7.*
   - Authenticate WebSocket handshakes with the same short-lived access token; re-check membership/permissions on room joins and mutations. Use rooms such as `user:{id}`, `place:{id}`, `chat:{channelId}`, and `voice:{roomId}`.
   - Add durable `chat_channels`, `chat_messages`, `chat_message_revisions`, `chat_read_state`, and `notifications` tables. Implement channel CRUD/order/permissions, message history, idempotent send/edit/delete, mentions, unread counts, and notification read/dismiss flows.
   - Expose REST for history and durable CRUD; WebSocket commands call the same application services and acknowledge client-generated IDs. Publish `chat.message.*`, `notification.created`, and permission/channel changes after transaction commit.
   - Keep presence, typing, and connection leases ephemeral in Redis with TTLs and heartbeat cleanup. Publish coarse place/voice presence only to authorized members; do not persist activity surveillance data.

### Phase 9: Voice Integration

**Status:** Complete as of 2026-09-22.

9. Implement voice-room policy and LiveKit token issuance. *Depends on steps 4 and 8.*
   - Add durable voice-room configuration/order/permissions, while participant state remains LiveKit/Redis-derived.
   - Add room CRUD and a join-token endpoint that verifies membership, bans/timeouts, room capacity, and speak/listen permissions, then issues a short-lived least-privilege LiveKit JWT containing stable identity and room grants.
   - Validate signed LiveKit webhooks idempotently, reconcile join/leave state, emit `voice.room.updated`, and expose current authorized participant summaries for the web fixture.
   - Keep media traffic client-to-LiveKit; the API never proxies RTP. coturn credentials/configuration remain deployment concerns rather than API responses unless LiveKit requires them.

### Phase 10: Moderation, Safety, and Administration

**Status:** Complete as of 2026-09-22.

10. Implement comprehensive place moderation and instance administration. *Depends on steps 4, 5, and 8.*
    - Add reports, report evidence snapshots, moderator notes, warnings, member timeouts, place bans, content hide/restore, topic lock/pin/move, chat deletion, and instance-level account suspension.
    - Centralize every action in a policy engine, require reason codes where appropriate, record actor/target/scope/before-after metadata in an append-only audit log, and notify affected users without exposing private moderator notes.
    - Add moderation queues with status/assignee/filter cursors, bulk actions with limits, ban evasion signals limited to privacy-preserving hashes, and retention/anonymization jobs.
    - Add instance settings and bootstrap-admin APIs/CLI for registration mode, single-place mode, public policy URLs, upload/rate limits, and feature switches. Secrets remain environment-managed.

### Phase 11: Developer API, Rate Limits, and Generated Clients

11. Finish the public developer surface and shared client contract. *Depends on stable endpoint contracts from steps 3-10.*
    - Add personal access tokens/API keys stored as hashes, named scopes, expiry/rotation/revocation, last-used metadata, and the same authorization policies as user sessions.
    - Implement Redis token-bucket limits by IP, user, API token, place, and expensive operation; return standard `RateLimit-*` and `Retry-After` headers. Make defaults configurable but bounded so self-hosters can tune fair-use policy.
    - Split OpenAPI into tagged public/admin operations, add examples and security/error schemas, validate the document in CI, and fail on undocumented endpoints.
    - Generate TypeScript DTO/client artifacts from OpenAPI into `repos/shared` as a versioned pnpm package for web/desktop/mobile. Do not import Nest classes or Drizzle schema into clients.

### Phase 12: Production Hardening and Release Gate

12. Complete observability, deployment behavior, and full-system validation. *Depends on all prior phases.*
    - Add Prometheus-compatible metrics, optional OpenTelemetry export, request/job correlation IDs, dependency latency/error metrics, and protected operational endpoints. Never include tokens, email addresses, rich-text bodies, or chat content in logs.
    - Add a multi-stage non-root production Dockerfile with separate API and worker commands; update Compose development topology to include the worker and mail capture, while leaving production secrets/TLS/reverse proxy to a distinct future production Compose definition.
    - Add database backup/restore and migration runbooks, forward-compatible expand/migrate/contract migration rules, graceful drain behavior, and readiness failure during unavailable critical dependencies.
    - Run unit policy/service tests, repository integration tests, HTTP/WebSocket e2e flows, OpenAPI checks, migration-up/down/upgrade tests, queue retry/idempotency tests, search reconciliation tests, upload authorization tests, LiveKit webhook/token tests, tenant-isolation tests, rate-limit tests, and Docker smoke tests.
    - Final acceptance journey: bootstrap instance admin; register/verify; create or enter a place; configure roles/forums/chat/voice; create/search/read/follow/save a topic; reply/upload/react; exchange chat messages and unread notifications; obtain a voice token; report and moderate content; use a scoped API token; restart all services without losing authoritative data.

## Relevant Files

- [`repos/server/src/main.ts`](../repos/server/src/main.ts) - API process bootstrap and lifecycle.
- `repos/server/src/worker.ts` - new independent BullMQ worker bootstrap.
- [`repos/server/src/configure-app.ts`](../repos/server/src/configure-app.ts) - global versioning, security, validation, errors, logging, and OpenAPI.
- [`repos/server/src/app.module.ts`](../repos/server/src/app.module.ts) - composition root for infrastructure and domain modules.
- `repos/server/src/config/` - validated environment and instance configuration.
- `repos/server/src/database/schema/` - Drizzle table definitions grouped by domain.
- `repos/server/drizzle/` - generated and reviewed SQL migrations and metadata.
- `repos/server/src/auth/` - identities, credentials, OIDC, sessions, guards, and decorators.
- `repos/server/src/places/` - places, membership, roles, permissions, invites, and settings.
- `repos/server/src/forums/` - forums, topics, posts, revisions, reactions, follows, saves, and reads.
- `repos/server/src/assets/` - upload intent, object storage, validation, and media jobs.
- `repos/server/src/search/` - Meilisearch query, indexing, and reconciliation logic.
- `repos/server/src/realtime/` - Redis adapter, socket authentication, presence, and event publication.
- `repos/server/src/chat/` - channels, messages, history, unread state, and gateway commands.
- `repos/server/src/notifications/` - durable inbox and realtime notification delivery.
- `repos/server/src/voice/` - room policy, LiveKit JWTs/webhooks, and participant summaries.
- `repos/server/src/moderation/` - reports, actions, queues, sanctions, and audits.
- `repos/server/src/jobs/` - outbox dispatcher and BullMQ processors.
- `repos/server/src/developer-api/` - scoped personal access tokens and quotas.
- [`repos/server/test/app.e2e-spec.ts`](../repos/server/test/app.e2e-spec.ts) - starting point for HTTP/WebSocket e2e and infrastructure integration suites.
- [`repos/server/package.json`](../repos/server/package.json) - runtime dependencies and scripts.
- [`repos/server/README.md`](../repos/server/README.md) - local setup, migration, worker, test, and operational commands.
- [`compose.dev.yaml`](../compose.dev.yaml) - worker/mail-capture additions and service health dependencies.
- [`.env.example`](../.env.example) - documented non-secret configuration surface.
- `repos/shared/` - generated OpenAPI TypeScript client/types package.

## Verification

1. For every phase, run `pnpm lint`, `pnpm test`, `pnpm test:integration`, `pnpm test:e2e`, and `pnpm build` from `repos/server`; require focused tests before proceeding to dependent phases.
2. Validate every migration against an empty PostgreSQL 18 database and an upgrade fixture from the previous phase; run constraint/index inspection and tenant-scope tests.
3. Run `docker compose --env-file .env.example -f compose.dev.yaml config --quiet`, build API/worker images, start the stack, wait for readiness, and probe health, REST, WebSocket, MinIO, Meilisearch, Redis/BullMQ, and LiveKit paths.
4. Generate and validate OpenAPI, compare it for unintended breaking changes, regenerate `repos/shared`, then typecheck the shared package and a minimal client consumer.
5. Exercise the final acceptance journey plus failure cases: expired/reused tokens, cross-place IDs, forbidden role escalation, private search leakage, duplicate commands/jobs/webhooks, oversized/invalid uploads, reconnecting sockets, rate-limit exhaustion, and dependency outages.

## Decisions

- Delivery is a phased production-ready v1, not a single large release.
- Authentication is email/password with verified addresses and optional generic OIDC; no external auth SaaS is required.
- Drizzle is the data layer; PostgreSQL 18 is the minimum supported database to use built-in UUIDv7.
- Discussions use flat chronological replies and versioned ProseMirror-compatible rich text.
- Realtime includes place chat, presence, notifications, and voice state. Direct messages are excluded from v1.
- Hosted and self-hosted modes share one place-scoped schema; single-community mode is configuration, not a fork.
- Anonymous users can read public discoverable content; verified authenticated users are required for writes.
- The API owns durable state and authorization. Redis is disposable/ephemeral except BullMQ durability; Meilisearch is rebuildable; MinIO stores private objects addressed through database asset records; LiveKit owns media sessions.
- Application authorization and mandatory repository place scoping are the v1 tenant boundary. PostgreSQL RLS is excluded initially to avoid unverified policy interactions with public discovery and custom roles.
- No v1 federation, direct messages, end-to-end encryption, billing, video/screen sharing, native push provider, or client UI implementation. SMTP delivery, voice audio, and generated shared client contracts are included.