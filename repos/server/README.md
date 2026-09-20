# Displace Web API

The Displace Web API is a strict TypeScript, ESM-based NestJS service running on Fastify. OpenAPI documentation is generated with `@nestjs/swagger`.

## Prerequisites

- Node.js 22 or later
- pnpm 11 or later

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

- API: `http://localhost:3000/api`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI document: `http://localhost:3000/api/docs-json`

## Quality Checks

```bash
pnpm lint
pnpm test
pnpm test:e2e
pnpm test:cov
```

Format source and test files with `pnpm format`.

## Docker Development

From the repository root, copy `.env.example` to `.env` if you need to override ports or development credentials, then run:

```bash
docker compose -f compose.dev.yaml up --build
```

The API is available at `http://localhost:3001/api`. PostgreSQL, Redis, MinIO, Meilisearch, LiveKit, and coturn are reachable through the ports documented in `.env.example`.

Stop the stack without deleting development data:

```bash
docker compose -f compose.dev.yaml down
```

Add `--volumes` to the `down` command when you intentionally want to reset all local service data.