# Displace Web

The server-rendered web client for Displace, built with Next.js, React, TypeScript, Tailwind CSS, and the React Compiler.

## Prerequisites

- Node.js 22 or later
- pnpm 11 or later

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Open `http://localhost:3000`. The development server reloads changes automatically.

## Quality Checks

```bash
pnpm lint
pnpm build
```

## Production

```bash
pnpm build
pnpm start
```

The interface currently uses static fixture data. API integration belongs in a dedicated data-access layer once the server contracts are defined.
