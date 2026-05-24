# ADR 0001: Monorepo Foundation and Guardrails

## Status
Accepted

## Date
2026-05-23

## Context
QJFit starts from an empty repository and must enforce strong engineering guardrails from day one: strict TypeScript, structured logging, environment validation, non-root containers, and deterministic image tags.

## Decision
- Use an npm workspaces monorepo with `apps/api`, `apps/web`, and `apps/shared`.
- Enforce strict TypeScript via a shared `tsconfig.base.json`.
- Use Pino as the default logger in API.
- Validate required environment variables at startup and exit with code 1 when invalid.
- Use Docker images pinned by explicit version and production image references tagged by `${GITHUB_SHA}`.
- Run application containers as a non-root `qjfit` user.

## Consequences
- Foundation is aligned with security and reliability constraints.
- Future steps can add domain logic without revisiting infrastructure baselines.
