# QJFit

QJFit is a web app that aggregates daily job offers from multiple sources and hand back a scored ranked shortlist.

## Tech Stack

- Backend: Node.js 20, TypeScript, Express, Prisma, Pino
- Frontend: Vue 3 + Vite + TypeScript
- Data: PostgreSQL 16
- Reverse proxy: Caddy (local), Traefik (production)
- Infra: Docker Compose

## Repository Structure

```txt
apps/
  back/      # Backend API
  front/     # Frontend app
ops/
  Caddyfile  # Reverse proxy config
```

## Prerequisites

- Node.js >= 20
- Yarn (run `corepack enable` once; Corepack then provisions the pinned Yarn version from `package.json`)
- Docker + Docker Compose

## Environment Setup

1. Create your local env file from the example:

```bash
cp .env.example .env
```

2. Ensure your `.env` contains at least:

```bash
DATABASE_URL='your db url'
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://qjfit
VITE_API_URL=
```

## Local Domain (`https://qjfit:8443`)

Map the domain to localhost once:

```bash
echo "127.0.0.1 qjfit" | sudo tee -a /etc/hosts
```

Caddy listens on host ports 8080/8443 (not 80/443) so it doesn't collide
with anything else already bound to the standard ports on your machine.

## Run with Docker

```bash
docker compose up --build
```

Services:

- App via Caddy: `https://qjfit:8443` (self-signed cert, `tls internal`)
- API (direct): `http://localhost:3000`
- Web (direct): `http://localhost:5173`
- Postgres: `localhost:5432`

## Run in Workspace Mode

Install dependencies:

```bash
corepack enable
yarn install
```

Run backend and frontend in separate terminals:

```bash
yarn dev:back
yarn dev:front
```
