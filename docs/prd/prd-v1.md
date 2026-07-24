# QJFit — Product Requirements Document

**Version**: 1.0
**Status**: Draft
**Last updated**: July 2026

---

## 1. Overview

### 1.1 Problem statement

Job seekers waste hours daily navigating 5–8 separate job boards (LinkedIn, Welcome to the Jungle, Indeed, France Travail, HelloWork), manually filtering and comparing offers, with no unified relevance ranking against their actual profile — relevant offers get buried or missed. For example, a developer spending 3 hours/day searching and filtering job boards is 3 hours not spent coding, preparing for interviews, or building side projects. On top of that, most tools that promise to solve this ask for a signup, a password, and a profile form before showing any value at all.

### 1.2 Solution

QJFit is a single-purpose, no-signup tool: **upload your CV, and immediately see which currently open offers match it.** Offers are aggregated from multiple job boards into a shared pool, refreshed on a schedule. Each uploaded CV is matched against that pool using an LLM, and the visitor sees a ranked list with a plain-language explanation of why each offer matches — no account, no password, nothing to remember. Every visit is a fresh, independent check.

### 1.3 Goals

- Get a visitor from "landing on the page" to "seeing relevant offers" in one action, with zero signup friction
- Surface only high-signal offers matched against the CV actually uploaded, not a generic keyword search
- Aggregate across FR/EU job boards with deduplication, shared across all visitors
- Provide AI-powered match scoring with transparent reasoning
- Protect shared resources (external job-board quotas, LLM spend) from anonymous-traffic abuse via IP-based rate limiting, since there's no account to gate access with
- Never retain a visitor's CV or computed scores beyond the request that produced them

## 2. Users & Context

**Primary user**: A tech professional (developer, data engineer, designer, etc.) based in France, actively or passively job searching, who wants a quick relevance check without creating an account.

**Usage pattern**: Visit the page, upload a CV (PDF or DOCX), watch a loader while it's matched against the current job pool, review the ranked results. Up to **2 uploads per IP per calendar day**. No login, no return-visit continuity — each upload is a fresh, independent check against whatever is currently in the pool.

**Tenancy model**: Anonymous and stateless. There is no user account and no persisted per-visitor state. `Job`, `FetchRun`, and `FetchLog` are global and shared — refreshed on a cron schedule, independent of any visitor action. A visitor's uploaded CV and the scores computed against it exist only for the lifetime of that single match request; nothing is written to durable storage.

### 2.1 User stories

| ID | As a visitor I want to… | So that… | Priority |
|---|---|---|---|
| US-01 | Upload my CV (PDF or DOCX) without creating an account | I can get value immediately, with zero signup friction | P0 |
| US-02 | See a loader while my CV is being matched | I know the app is working, not stuck | P0 |
| US-03 | See a ranked list of job offers matching my CV | I immediately know which offers to prioritize | P0 |
| US-04 | See an AI-generated match score and explanation per offer | I understand *why* an offer is relevant, not just that it is | P0 |
| US-05 | See which skills I'm missing for a given offer | I can prioritize what to learn based on real market demand | P1 |
| US-06 | Filter and sort results by score, date, source, location | I can slice the results based on what I care about that day | P1 |
| US-07 | Know clearly if I've hit today's upload limit, and when I can try again | I'm not left guessing why nothing happened | P1 |
| US-08 | Export the visible results to CSV | I can save or share my results before closing the tab, since nothing is stored for me | P2 |
| US-09 | See aggregate stats on the current pool (top required skills, score distribution) | I get market signal, not just individual offers | P2 |

---

## 3. Core Features

### 3.1 CV Upload & Matching

There is no profile form, no account, and no persisted profile — **CV upload is the only entry point.**

- **Input**: a single file, PDF or DOCX only, max **5MB**. Anything else (wrong type, oversized) is rejected with a clear error before any processing starts.
- **Processing**: the file is parsed entirely **in memory** into the same normalized shape used for scoring context (target role, tech stack, seniority range, location, excluded keywords, contract types, salary floor). Neither the raw file, the extracted text, nor the parsed profile is ever written to disk or database. Everything is discarded once the match request resolves.
- **Disclosure**: the upload page must clearly state that the CV is not stored — only processed in memory to compute matches, and that its content (as scoring context) is sent to the LLM provider for matching, same as any other scoring context.
- **No re-upload/edit flow**: there's nothing to edit, because nothing is saved. Getting new results means uploading again (subject to the daily limit, §3.2.2).

### 3.2 Job Source Connectors

Each connector is an independent module implementing a standard `JobSource` interface:

```
interface JobSource {
  name: string
  fetch(since: Date): Promise<RawJob[]>
}
```

**v1 connectors (planned)**:

| Source | Method | Notes |
|---|---|---|
| France Travail (Pôle Emploi) | Official REST API | Free, requires client_id/secret |
| Welcome to the Jungle | RSS feed | Public RSS, no auth |
| Adzuna | Official REST API | Free tier: 250 req/day, EU coverage |
| JSearch (RapidAPI) | REST API | Aggregates Indeed, LinkedIn, Glassdoor — ~10€/mo |
| HelloWork | RSS / HTML parser | RSS available for some categories |

**v2 connectors (roadmap)**:
- LinkedIn Jobs API (partner program)
- RemoteOK API (remote-friendly)
- Leboncoin Emploi (scraping with Playwright, opt-in)

> Note the `fetch` signature above dropped the `profile` argument from v2.0 — connectors fetch
> generically for the shared pool now; there's no per-visitor profile at fetch time to pass in
> (see §3.2.1).

#### 3.2.1 Job Pool Refresh (cron-driven)

- The shared job pool is refreshed by a **scheduled job (cron)** on a fixed interval, fully decoupled from visitor traffic. No visitor action triggers a connector call.
- This is a deliberate change from v2.0, where fetching was triggered by an authenticated user's action. With no accounts, there's no other mechanism left to keep the pool fresh — and tying connector calls to anonymous upload traffic would make external quota usage (e.g., Adzuna's 250 req/day) scale with uncontrolled visitor volume instead of a predictable schedule.
- Source failures during a scheduled run are logged to `fetch_logs` per source; the run continues with the remaining sources (unchanged from v2.0).

#### 3.2.2 Match Request Rate Limiting

- Each CV upload ("match request") is limited to **2 per IP per calendar day** (resets at midnight server time).
- Only the upload action itself counts against the limit — polling for match-ticket status does not.
- The client IP is read from the trusted reverse-proxy header (`X-Forwarded-For`/`X-Real-IP`), taken only from the immediate proxy hop (Caddy locally, Traefik in production) — never trusted directly from a client-supplied header, which would make the limit trivially spoofable.
- The counter is Redis-backed, keyed by IP + calendar date, with a TTL until midnight.
- Exceeding the limit returns `429 Too Many Requests` with an explicit reset time (not a vague "try later"), so the visitor knows exactly when they can check again.

### 3.3 Normalization & Deduplication

All fetched offers are normalized to a common schema before storage (unchanged from v2.0):

```
title           string
company         string
location        string
contract_type   enum: CDI | CDD | Freelance | Internship | Apprenticeship | Other
remote_policy   enum: Full | Hybrid | On-site | Unknown
description     text (truncated to 2000 chars for scoring)
url             string (original application URL)
source          string
fetched_at      timestamp
salary_min      int | null
salary_max      int | null
experience_min  int | null  (years)
experience_max  int | null
```

Offers from multiple sources are deduplicated using a composite fingerprint:

```
hash(normalize(title) + normalize(company) + normalize(location))
```

First-seen record wins. Source list is preserved on the deduplicated record. This still happens once against the shared pool, at refresh time — not per match request.

### 3.4 AI Matching Pipeline

Because there's no persisted profile, matching is computed **fresh, end-to-end, on every upload** — there is no "already scored" backlog to lean on the way v2.0 assumed.

**Step 1 — Relevance pre-filter (no LLM)**: cheap keyword/attribute overlap between the parsed CV (stack, role, location, contract type) and each job in the pool. This exists to bound cost and latency: LLM-scoring the entire pool on every single upload doesn't scale, and a source flooding the pool with irrelevant-but-recent postings shouldn't be able to burn the whole scoring budget. Location matching is region-aware: a CV stating a French region (e.g. "Île-de-France") matches any job whose department falls in that region, resolved via a static department→region lookup against the France Travail connector's "XX - City" location format — not just a job whose location string repeats the region name verbatim. A CV stating a specific city keeps the original literal-substring behavior, which is already a subset of region-level resolution (same department → same region). Role matching combines an exact target-role substring check with an embedding-similarity fallback against the job title (an `EmbeddingProviderPort`, stubbed today — ADR 0018) — so a wording variant like "Full-Stack Developer" clearing the gate for "Software Engineer" doesn't require hand-maintaining a synonym list.

**Step 2 — Recency tiebreak**: among the jobs that pass the relevance filter, sort by `fetched_at`/posting date descending (most recent first) and take the top N (default: 50) as scoring candidates. Recency orders *within* the relevant set — it does not override relevance.

**Step 3 — LLM scoring**: for each candidate, a scoring prompt is sent to the LLM:

**Input**: the parsed CV's profile summary + raw job description
**Output**: structured JSON with:

```json
{
  "score": 82,
  "summary": "Senior Python role at a fintech scale-up. Stack matches 90%.",
  "match_reasons": ["FastAPI", "PostgreSQL", "remote-friendly"],
  "missing_skills": ["Kubernetes"],
  "seniority_fit": "good",
  "red_flags": []
}
```

Score is 0–100. Final ranking uses:

```
ranking_score = score * recency_weight
recency_weight = exp(-days_since_posted / decay_days)
decay_days = 14  (configurable)
```

**Ephemeral only**: scores are returned directly in the match response and never persisted. The same job can — and will — carry a different score on every future request, because it's matched against whatever CV was uploaded that time. There is no `rescore` endpoint and no "already scored" state to check, because nothing is cached. (This directly changes the v2.0 assumption that a job's score could be safely computed once and reused — see [ADR 0015](../adr/0015-anonymous-stateless-mvp.md).)

**Failure handling**: if the LLM response fails schema validation for a given job, log the error (Pino) and drop that job from the result set for this request — do not crash the request over one bad response.

**Bounded concurrency**: max 5 concurrent LLM calls per match request (unchanged from v2.0).

### 3.5 Match Flow & Results View

- **Upload**: visitor submits their CV. The request returns immediately with an opaque, short-lived match ticket.
- **Loader**: the frontend polls the ticket until scoring completes, showing a loading state — no accounts means no dashboard to "come back to," so this is a single continuous flow from upload to results, in one visit.
- **Results**: once ready, the ranked list renders:
  - Score badge (color-coded: green ≥75, amber 50–74, red <50)
  - Role title, company name, location, contract type, short description
  - Days since posted
  - Match reasons tags
  - Missing skills
  - "View full offer" expandable panel
  - Direct link to original listing
  - Sort by score/date
  - Remaining match requests left today (per IP, §3.2.2)
  - Export visible results to CSV

- **Filters** (client-side, over the result set already returned — nothing persisted):
  - Score threshold
  - Source (multi-select), all sources selected by default
  - Contract type
  - Remote policy (multi-select): onsite, hybrid, full-remote

There is no settings panel — there's no account, password, or saved profile to manage.

### 3.6 Removed from scope (not deferred)

The following v2.0 features required a persistent identity across visits and are removed entirely, not pushed to a later version:

- **Accounts & Authentication** (signup, login, email verification, password reset, sessions)
- **Application Tracker** (Kanban board, notes, reminders) — has no meaning without something to remember "your" pipeline across visits
- **Notifications / email digest** — requires an email address and a recurring identity to send to
- **Fetch history page** — pool refresh is now cron-driven and operational, not a visitor-facing concept

If accounts are ever reintroduced, that's a new product decision made from scratch — this PRD makes no attempt to reserve a seam for it.

## 4. Security Considerations

- No accounts, no sessions, no cookies required. The match endpoint is publicly reachable; there is nothing to authenticate.
- The uploaded CV (file, extracted text, and parsed profile) is processed **entirely in memory** and never written to disk or database. This is disclosed to the visitor before upload.
- CV content (as scoring context) is sent to the LLM provider to compute matches — same exposure as v2.0's per-user scoring, just without an account/consent screen to disclose it on, so the disclosure now lives on the upload page itself.
- API keys for job-board/LLM providers remain operator-level secrets in `.env` / Docker secrets, never in the DB or frontend.
- The job pool itself (titles, companies, descriptions, URLs) is public data with no visitor PII attached — safe to serve to any visitor without gating.
- **IP-based rate limiting** (2 match requests/day/IP) exists for shared-resource protection (external job-board quotas, LLM spend) against anonymous-traffic volume, not primarily for abuse prevention. It only works if the trusted-proxy IP header is read correctly (§3.2.2) — a client-supplied header must never be trusted directly, or the limit is trivially bypassed.
- The ephemeral match-ticket cache (holding in-flight/just-completed results for polling) must use a short TTL (minutes, not hours) — there's no account for a visitor to "come back later" to, so nothing should outlive the visit by much.

### 4.1 Observability

- All scheduled fetch runs are logged to `fetch_logs` with per-source results
- Application logs use Pino (structured JSON)
- A `/api/metrics` endpoint exposes Prometheus metrics: `offers_fetched_total`, `scoring_errors_total`, `fetch_duration_seconds`, `match_requests_total`, `match_requests_rate_limited_total`

## 5. Milestones & Phasing

### Phase 1 — Core MVP

- [x] Project scaffolding (monorepo, Docker Compose, CI skeleton, CD)
- [ ] Cron-driven job pool refresh (connectors + dedup, decoupled from visitor traffic)
- [ ] France Travail connector
- [ ] WTTJ RSS connector
- [ ] CV upload endpoint (PDF/DOCX, 5MB max) + in-memory parsing
- [ ] Relevance pre-filter + recency tiebreak
- [ ] Ephemeral AI scoring pipeline (bounded concurrency, no persistence)
- [ ] Async match ticket + polling endpoint
- [ ] IP-based rate limiting (2/day, Redis-backed, trusted-proxy IP resolution)
- [ ] Results UI (loader → ranked list, filters/sort, export CSV)
- [ ] VPS deploy playbook

### Phase 2 — More Sources

- [ ] JSearch connector
- [ ] Adzuna connector
- [ ] HelloWork RSS connector
- [ ] Deduplication engine

### Phase 3 — Production Hardening

- [ ] Full GitHub Actions pipeline
- [ ] Caddy config + TLS (local), Traefik + TLS (production)
- [ ] Backup script (pg_dump to S3 or local) — job pool only, no visitor data to back up
- [ ] Monitoring (UptimeRobot or Healthcheck.io ping)

---

## 6. Success Metrics

| Metric                                                  | Target                       |
|---------------------------------------------------------|-------------------------------|
| Time from CV upload to ranked results                  | < 2 minutes                  |
| Deduplication accuracy                                  | > 95%                        |
| Results view load time (after match completes)          | < 300ms                      |
| False positive rate (irrelevant offers scored ≥75)      | < 10%                        |
| Match requests rejected by rate limit / total requests  | monitored, no fixed target — a leading indicator of either abuse or a limit set too low |
