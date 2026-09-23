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

Playwright starts the web development server automatically for browser tests. The API and its supporting services must already be available at their configured origins. Because the journeys mutate accounts, invitations, memberships, and places, run them against an isolated database that is reset before each browser project. Install Chromium with `pnpm exec playwright install chromium` if no compatible browser is available.

The browser journeys provision unique users and community data through the real API and read verification and password-reset links from Mailpit; they do not depend on runtime fixtures or seeded application records. Start the API, mail worker, PostgreSQL, Redis, and Mailpit before running them. Run each viewport serially against freshly reset test services so production-style authentication rate limits remain meaningful:

```bash
pnpm exec playwright test --project=desktop-chromium --workers=1
pnpm exec playwright test --project=mobile-chromium --workers=1
```

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

## Moderation And Administration

Authenticated users can report places, members, topics, posts, and chat messages from their resource views. Members with the server-provided `moderation.manage` capability can work the place queue at `/places/[placeSlug]/moderation`; the global `/moderation` route directs moderators to their place-scoped work. Instance administrators can manage non-secret settings and account status at `/admin`. All actions remain subject to API authorization even when a control is already capability-gated in the interface.

Run the real API-backed moderation journey in either supported viewport:

```bash
pnpm exec playwright test e2e/moderation.spec.ts --project=desktop-chromium --workers=1
pnpm exec playwright test e2e/moderation.spec.ts --project=mobile-chromium --workers=1
```

## Uploads and Media

Image uploads request a short-lived intent from the API, send the file directly from the browser to the configured S3-compatible endpoint, complete the intent, and wait for server-side validation and processing. Profile, place, and forum content store asset IDs only. Display URLs are short-lived, authorization-aware URLs returned by the API; the web app never constructs object-storage paths.

The browser origin must be allowed by both the API `CORS_ORIGINS` configuration and MinIO `MINIO_API_CORS_ALLOW_ORIGIN`. The Compose defaults expect `http://localhost:3000`. Run the real object-store lifecycle check while the API, worker, PostgreSQL, Redis, and MinIO services are running:

```bash
pnpm exec playwright test e2e/places.spec.ts --project=desktop-chromium --workers=1 --grep "uploads and assigns a place image"
```

## Live chat and voice

The place Live workspace combines chat channels and API-authorized voice rooms at `/places/:placeSlug/live`. Channel changes happen inside the workspace so an active voice connection remains uninterrupted. Voice connects directly to LiveKit only after the member chooses to join and supports participant summaries, device selection, mute, deafen, audio-playback recovery, reconnect state, and active speaking-permission revocation. Channel and room access remain independently managed from place settings.

Run the controlled real-stack voice journey while API, PostgreSQL, Redis, LiveKit, and coturn are running:

```bash
pnpm exec playwright test e2e/voice.spec.ts --project=desktop-chromium --workers=1
```

Provisional contracts stay behind view-model adapters and are replaced by generated `repos/shared` types when the corresponding OpenAPI operations are published. Fixtures are test-only and are never a runtime fallback.

## Production

```bash
pnpm build
pnpm start
```

The default API URL expects the development server on port 3001 and the web app on port 3000.

The repository Compose files also run the web app. Development uses bind-mounted source with hot reload:

```bash
docker compose -f compose.dev.yaml up --build
```

Production builds the standalone Next.js image and routes server-component API requests over the internal Docker network. Set `NEXT_PUBLIC_API_URL` to the browser-visible versioned API URL in `.env.production`, then start the stack from the repository root:

```bash
docker compose --env-file .env.production -f compose.prod.yaml up --build -d
```
