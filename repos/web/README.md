# Displace Web

The server-rendered web client for Displace, built with Next.js, React, TypeScript, Tailwind CSS, and the React Compiler.

## Prerequisites

- Node.js 22 or later
- pnpm 11 or later

## Setup

```bash
pnpm install
```

Copy `.env.example` to `.env.local` when the API is not available at `http://localhost:3001/api/v1`.

Public discovery uses deterministic fixtures by default. Set `WEB_DATA_SOURCE=api` to use the server's cacheable public place, forum, topic, and post operations. Public member profiles remain unavailable in API mode until the server publishes an anonymous profile operation.

## Run

```bash
pnpm dev
```

Open `http://localhost:3000`. The development server reloads changes automatically.

## Quality Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

Playwright starts the development server automatically for browser tests. Install its Chromium build with `pnpm exec playwright install chromium` if no compatible browser is available.

## Application Structure

- `src/app/(public)` contains anonymous discovery, search, and public profile routes.
- `src/app/(auth)` contains standalone authentication routes.
- `src/app/(app)` contains authenticated and place-scoped application routes.
- `src/app/@modal` contains intercepted routes displayed over the current page.
- `src/components` contains reusable shell and interaction primitives.
- `src/features` contains domain fixtures, provisional contracts, view-model adapters, and feature views.
- `src/lib/api` owns public server reads, credentialed browser requests, request IDs, CSRF and idempotency headers, cursors, and problem details.
- `src/test/mocks` contains MSW handlers for fixture-backed contract tests.

The interface remains fixture-first while server operations stabilize. Provisional contracts must stay behind view-model adapters and are replaced by generated `repos/shared` types when the corresponding OpenAPI operations are published.

## Production

```bash
pnpm build
pnpm start
```

The default API URL expects the development server on port 3001 and the web app on port 3000.
