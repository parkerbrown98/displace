# syntax=docker/dockerfile:1.7

FROM node:22.22.1-alpine3.23 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apk upgrade --no-cache \
    && corepack enable \
    && corepack prepare pnpm@11.24.0 --activate

WORKDIR /workspace

FROM base AS production-dependencies

COPY repos/shared/package.json ./repos/shared/
COPY repos/server/package.json repos/server/pnpm-lock.yaml repos/server/pnpm-workspace.yaml ./repos/server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --dir repos/server install --prod --frozen-lockfile

FROM base AS build

COPY repos/shared/package.json repos/shared/pnpm-lock.yaml ./repos/shared/
RUN --mount=type=cache,id=shared-pnpm,target=/pnpm/store \
    pnpm --dir repos/shared install --prod --frozen-lockfile

COPY repos/server/package.json repos/server/pnpm-lock.yaml repos/server/pnpm-workspace.yaml ./repos/server/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm --dir repos/server install --frozen-lockfile

COPY repos/shared/src ./repos/shared/src
COPY repos/server/nest-cli.json repos/server/tsconfig.build.json repos/server/tsconfig.json ./repos/server/
COPY repos/server/src ./repos/server/src
WORKDIR /workspace/repos/server
RUN pnpm build

FROM node:22.22.1-alpine3.23 AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /workspace/repos/server/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/repos/server/dist ./dist
COPY --chown=node:node repos/server/package.json ./
COPY --chown=node:node repos/server/drizzle ./drizzle

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]