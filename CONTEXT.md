# QJFit

A stateless, no-signup CV-to-job-offer matching tool. Visitors upload a CV and get it scored
against a shared, continuously-refreshed pool of job offers — no accounts, no persisted
profile, no persisted score.

## Language

**Job Pool**:
The single, shared set of job offers stored in Postgres (`jobs` table) that every visitor is
scored against. It is cumulative and global — populated over time by every distinct visitor
query's fetch, never isolated per visitor or per query.
_Avoid_: pool, job list (ambiguous with a single fetch's raw result set)

**Query Signature**:
A coarse, non-identifying key derived from a visitor's parsed CV — job title (required) +
mobility + experience band + contract type (all optional) — used to decide whether the Job
Pool needs a fresh upstream fetch for that shape of search, and to look up/record that
fetch's recency. It is not CV content: it doesn't identify a visitor and is small enough to
persist without conflicting with the no-persisted-CV rule.
_Avoid_: query, search params, cache key (too generic — this key specifically drives the
freshness decision, not just a lookup)

**Freshness Window**:
The 2-hour period after a completed fetch for a given Query Signature during which a new
match request reuses the existing Job Pool contents instead of triggering another upstream
fetch for that signature. Tracked per signature, never globally — two different signatures
have independent freshness windows.
_Avoid_: cache TTL (this is a domain policy, not just an implementation detail — it's stated
in ADR 0021's decision, not just chosen as a technical default)

**Fetch Run**:
One attempt to refresh the Job Pool from the connectors, tied to a Query Signature that
triggered it. Tracked in Postgres (`FetchRun`/`FetchLog`) for audit/observability regardless
of what triggered it. Prior to ADR 0021, every Fetch Run was untargeted (no query scoping)
and triggered on a fixed timer; now it's scoped to one signature and triggered from a match
request.
_Avoid_: fetch job, refresh (too generic)
