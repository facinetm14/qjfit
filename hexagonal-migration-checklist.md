# Hexagonal Architecture Migration Checklist

## 1. Prepare New Structure

- [x] Create `domain/`, `application/`, and `infrastructure/` folders under `src/`
  Note: runtime currently uses `src/infra/` (not `src/infrastructure/`). `src/infrastructure/` exists as an empty skeleton.
- [x] Create subfolders for each domain (jobs, profile, scoring, fetch-runs, sources)
- [x] Create `usecases/` and `ports/` under `application/`
- [ ] Create `adapters/` (input/output) and `db/` under `infrastructure/`
  Note: current implementations live under `src/infra/` (`connectors/`, `db/`, `repositories/`).

## 2. Move Domain Files

- [x] Move all `*.entity.ts`, `*.schema.ts`, and pure business logic to `domain/`
  Note: legacy duplicates still exist under `src/core/`.
- [x] Move domain tests (e.g., normalization.spec.ts) alongside their domain files

## 3. Move Application Files

- [x] Move all service classes to `application/usecases/` (rename to `*.usecase.ts`)
- [x] Move service tests to match new usecase locations
- [x] Move all port interfaces to `application/ports/output/`
- [ ] If needed, define input ports for use cases in `application/ports/input/`

## 4. Move Infrastructure Files

- [ ] Move all repository and provider implementations to `infrastructure/adapters/output/`
- [ ] Move all connectors to `infrastructure/adapters/output/connectors/`
- [ ] Move API route handlers to `infrastructure/adapters/input/rest/` (rename to `*.controller.ts`)
- [ ] Move API route tests to match new controller locations
- [ ] Move DB client to `infrastructure/db/`

## 5. Update Imports

- [x] Update all import paths to reflect new locations
- [x] Ensure no domain/application code imports from infrastructure

## 6. Refactor for Compliance

- [x] Ensure all dependencies point inward (infra → app → domain)
- [x] Ensure all use cases depend only on ports, not concrete adapters
- [x] Ensure all adapters implement the correct port interfaces

## 7. Test

- [ ] Run all tests and fix any broken imports or logic
- [ ] Validate that the application runs as expected

## 8. Documentation

- [ ] Update README and architecture docs to reflect new structure

---

**Tip:** Migrate incrementally, validating at each step. Use version control to checkpoint progress.
