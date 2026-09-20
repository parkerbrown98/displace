# Displace Web API

The Displace Web API is a strict TypeScript, ESM-based NestJS service running on Fastify. OpenAPI documentation is generated with `@nestjs/swagger`.

## Prerequisites

- Node.js 22 or later
- pnpm 11 or later
- Docker with Compose v2 for PostgreSQL, Redis, and integration tests

## Setup

```bash
pnpm install
```

## Run

```bash
# Development with file watching
pnpm start:dev

# Production build and start
pnpm build
pnpm start:prod
```

The server listens on port `3000` by default. Set `PORT` to use another port.

- Liveness: `http://localhost:3000/api/v1/health/live`
- Readiness: `http://localhost:3000/api/v1/health/ready`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI document: `http://localhost:3000/api/docs-json`

REST endpoints are versioned under `/api/v1`. Errors use RFC 9457 problem details and every response includes `X-Request-Id`. Readiness authenticates to PostgreSQL, Redis, MinIO, Meilisearch, and LiveKit and verifies the configured database and object-storage bucket.

## Configuration

Configuration is validated at startup. The repository root [`.env.example`](../../.env.example) documents development values for HTTP limits, CORS, trusted proxies, service connections, signing secrets, SMTP, OIDC, and single-place mode. Production startup rejects development credentials, non-HTTPS public URLs and CORS origins, incomplete OIDC/SMTP credentials, and an unrestricted trusted-proxy setting.

The API uses the bounded runtime pool configured by `DATABASE_URL` and never receives migration-owner credentials in Compose. Database commands use `DATABASE_MIGRATION_URL`, bootstrap a distinct least-privilege runtime role, require PostgreSQL 18, revoke public schema privileges, and grant runtime DML access without schema creation or audit-log mutation.

## Database

Generate and apply migrations from `repos/server`:

```bash
pnpm db:generate
pnpm db:setup
pnpm db:seed
```

`db:setup` bootstraps the runtime role and applies pending migrations. The deterministic seed is blocked in production. Resetting is also blocked in production and requires an explicit confirmation:

```powershell
$env:CONFIRM_DATABASE_RESET = 'localhost:5432/displace'
pnpm db:reset
```

The confirmation value must exactly match the host, effective port, and database name in `DATABASE_MIGRATION_URL`.

Create or promote the initial instance administrator with values supplied through the process environment:

```powershell
$env:INITIAL_ADMIN_EMAIL = 'admin@example.test'
$env:INITIAL_ADMIN_HANDLE = 'admin'
$env:INITIAL_ADMIN_DISPLAY_NAME = 'Administrator'
$env:INITIAL_ADMIN_PASSWORD = '<at-least-12-characters>'
pnpm db:initial-admin
```

The command normalizes the email, marks it verified, and stores only an Argon2id password hash.

## Quality Checks

```bash
pnpm lint
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm test:cov
```

Format source and test files with `pnpm format`.

The integration suite starts disposable PostgreSQL 18 and Redis 8 containers. The worker process entrypoints are `pnpm worker:start`, `pnpm worker:dev`, and `pnpm worker:prod`; queue processors are added in Phase 7.

## Docker Development

From the repository root, copy `.env.example` to `.env` if you need to override ports or development credentials, then run:

```bash
docker compose -f compose.dev.yaml up --build
```

Compose runs the database role bootstrap, migrations, and deterministic development seed before starting the API. The API liveness endpoint is available at `http://localhost:3001/api/v1/health/live`. PostgreSQL, Redis, MinIO, Meilisearch, LiveKit, and coturn are reachable through the ports documented in `.env.example`.

Stop the stack without deleting development data:

```bash
docker compose -f compose.dev.yaml down
```

Add `--volumes` to the `down` command when you intentionally want to reset all local service data.