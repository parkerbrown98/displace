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

All application data comes from the versioned API. Access tokens remain in module memory; the signed refresh cookie is HttpOnly, and the readable CSRF cookie is sent only by the centralized auth transport. Set `NEXT_PUBLIC_SINGLE_PLACE_SLUG` to the configured server place slug to omit discovery and place creation for a single-place deployment.

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

Playwright starts the web development server automatically for browser tests. The API must already be available at the configured origin with the test data expected by the specs. Because the journeys mutate accounts, invitations, memberships, and places, run them against an isolated database that is reset before each browser project. Install Chromium with `pnpm exec playwright install chromium` if no compatible browser is available.

Set `WEB_PORT` when port 3000 is occupied, for example `WEB_PORT=3010 pnpm test:e2e`. Playwright uses the same `localhost` origin as Next.js so client hydration resources are not blocked by the development origin policy.

## Application Structure

- `src/app/(public)` contains anonymous discovery, search, and public profile routes.
- `src/app/(auth)` contains standalone authentication routes.
- `src/app/(app)` contains authenticated and place-scoped application routes.
- `src/app/@modal` contains intercepted routes displayed over the current page.
- `src/components` contains reusable shell and interaction primitives.
- `src/features` contains provisional contracts, view-model adapters, and feature views.
- `src/lib/api` owns public server reads, credentialed browser requests, request IDs, CSRF and idempotency headers, cursors, and problem details.
- `src/test/mocks` contains MSW handlers and deterministic API payloads for contract tests.

Place management routes include `/places/new`, `/places/[placeSlug]/settings`, `/places/[placeSlug]/members`, `/places/[placeSlug]/members/[memberId]`, and `/places/[placeSlug]/invites/accept`. Navigation and mutation controls use capabilities returned by the place context API; forbidden mutations refresh that context rather than inferring access from role names.

Provisional contracts stay behind view-model adapters and are replaced by generated `repos/shared` types when the corresponding OpenAPI operations are published. Fixtures are test-only and are never a runtime fallback.

## Production

```bash
pnpm build
pnpm start
```

The default API URL expects the development server on port 3001 and the web app on port 3000.
