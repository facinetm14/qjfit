# QJFit

QJFit is a self-hosted web app that aggregates job offers from multiple sources, scores each offer against a developer profile, and surfaces ranked results in a dashboard.

## What It Does
- Aggregates offers from multiple job sources (connectors)
- Normalizes and stores offers in PostgreSQL
- Scores offers against a user profile (LLM pipeline)
- Exposes REST APIs for profile, jobs, runs, and tracking
- Provides a Vue dashboard for filtering and reviewing results

## Tech Stack
- Monorepo: npm workspaces
- Backend: Node.js 20, TypeScript, Express, Prisma, Pino
- Frontend: Vue 3 + Vite + TypeScript
- Data: PostgreSQL 16, Redis
- Reverse proxy: Caddy
- Infra: Docker Compose

## Repository Structure
```txt
apps/
  api/       # Backend API
  web/       # Frontend app
  shared/    # Shared TypeScript utilities
ops/
  Caddyfile  # Reverse proxy config
resources/   # PRD and design references
```

## Prerequisites
- Node.js >= 20
- npm
- Docker + Docker Compose

## Environment Setup
1. Create your local env file from the example:
```bash
cp .env.example .env
```

2. Ensure your `.env` contains at least:
```bash
DATABASE_URL=postgresql://QJFit:password@db:5432/QJFit
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://qjfit.tech
VITE_API_URL=
```

## Local Domain (`http://qjfit.tech`)
Map the domain to localhost once:
```bash
echo "127.0.0.1 qjfit.tech" | sudo tee -a /etc/hosts
```

## Run with Docker (Recommended)
```bash
docker compose up --build
```

Services:
- App via Caddy: `http://qjfit.tech`
- API (direct): `http://localhost:3000`
- Web (direct): `http://localhost:5173`
- Postgres: `localhost:5432`
- Redis: `localhost:6379`

## Run in Workspace Mode (Without Docker)
Install dependencies:
```bash
npm install
```

Run backend and frontend in separate terminals:
```bash
npm run dev:api
npm run dev:web
```
