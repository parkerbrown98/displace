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