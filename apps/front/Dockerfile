# syntax=docker/dockerfile:1
FROM node:20.18.1-alpine AS base
WORKDIR /app
RUN corepack enable

# ---------------------------------------------------------------------------
# deps: full install (incl. devDependencies). The cache mount persists
# Yarn's package cache across builds so a flaky registry connection doesn't
# force a full re-fetch on every retry.
# ---------------------------------------------------------------------------
FROM base AS deps
COPY package.json yarn.lock ./
COPY apps/front/package.json apps/front/package.json
RUN --mount=type=cache,target=/usr/local/share/.cache/yarn \
    yarn install --frozen-lockfile --ignore-scripts

# ---------------------------------------------------------------------------
# dev: Vite dev server with HMR. Used by docker-compose.yml (target: dev).
# ---------------------------------------------------------------------------
FROM deps AS dev
COPY tsconfig.base.json ./
COPY apps/front apps/front
EXPOSE 5173
CMD ["yarn", "workspace", "@qjfit/front", "dev", "--host", "0.0.0.0", "--port", "5173"]

# ---------------------------------------------------------------------------
# build: production static bundle.
# ---------------------------------------------------------------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY apps ./apps
RUN yarn workspace @qjfit/front build

# ---------------------------------------------------------------------------
# prod: static assets served by nginx. `vite preview` is explicitly
# documented by Vite as not designed for production use, so the runtime
# stage has no Node.js at all — just the built assets behind nginx. Uses
# the unprivileged image variant (listens on 8080) to satisfy the
# non-root-container requirement without extra config.
# ---------------------------------------------------------------------------
FROM nginxinc/nginx-unprivileged:1.27-alpine AS prod
COPY --from=build /app/apps/front/dist /usr/share/nginx/html
EXPOSE 8080
