# syntax=docker/dockerfile:1.7

FROM node:22.22.1-alpine3.23 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk upgrade --no-cache \
    && corepack enable \
    && corepack prepare pnpm@11.24.0 --activate

WORKDIR /app

FROM base AS dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=web-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build

ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SINGLE_PLACE_SLUG
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SINGLE_PLACE_SLUG=$NEXT_PUBLIC_SINGLE_PLACE_SLUG

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22.22.1-alpine3.23 AS runtime

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]