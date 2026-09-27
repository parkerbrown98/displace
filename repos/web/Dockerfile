# syntax=docker/dockerfile:1.7

FROM node:22.22.1-alpine3.23 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk upgrade --no-cache \
    && corepack enable \
    && corepack prepare pnpm@11.24.0 --activate

WORKDIR /workspace

FROM base AS dependencies

COPY repos/shared/package.json repos/shared/pnpm-lock.yaml ./repos/shared/
RUN --mount=type=cache,id=shared-pnpm,target=/pnpm/store \
    pnpm --dir repos/shared install --prod --frozen-lockfile

COPY repos/web/package.json repos/web/pnpm-lock.yaml repos/web/pnpm-workspace.yaml ./repos/web/
RUN --mount=type=cache,id=web-pnpm,target=/pnpm/store \
    pnpm --dir repos/web install --frozen-lockfile

FROM base AS build

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SINGLE_PLACE_SLUG
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SINGLE_PLACE_SLUG=$NEXT_PUBLIC_SINGLE_PLACE_SLUG

COPY --from=dependencies /workspace/repos/shared/node_modules ./repos/shared/node_modules
COPY --from=dependencies /workspace/repos/web/node_modules ./repos/web/node_modules
COPY repos/shared ./repos/shared
COPY repos/web ./repos/web
WORKDIR /workspace/repos/web
RUN pnpm build

FROM node:22.22.1-alpine3.23 AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=build --chown=node:node /workspace/repos/web/.next/standalone ./
COPY --from=build --chown=node:node /workspace/repos/web/.next/static ./web/.next/static

USER node

EXPOSE 3000

WORKDIR /app/web
CMD ["node", "server.js"]