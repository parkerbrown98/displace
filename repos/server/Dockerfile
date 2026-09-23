# syntax=docker/dockerfile:1.7

FROM node:22.22.1-alpine3.23 AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN apk upgrade --no-cache \
    && corepack enable \
    && corepack prepare pnpm@11.24.0 --activate

WORKDIR /app

FROM base AS production-dependencies

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --prod --frozen-lockfile

FROM base AS build

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY nest-cli.json tsconfig.build.json tsconfig.json ./
COPY src ./src
RUN pnpm build

FROM node:22.22.1-alpine3.23 AS runtime

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN apk upgrade --no-cache

WORKDIR /app

COPY --from=production-dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node package.json ./
COPY --chown=node:node drizzle ./drizzle

USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]