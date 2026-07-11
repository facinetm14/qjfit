# QJFit — Product Requirements Document

**Version**: 2.0
**Status**: Draft
**Last updated**: July 2026

---

## 1. Overview

### 1.1 Problem statement

Job seekers waste hours daily navigating 5–8 separate job boards (LinkedIn, Welcome to the Jungle, Indeed, France Travail, HelloWork), manually filtering and comparing offers, with no unified relevance ranking against their actual profile is time-consuming, repetitive and relevant offers get buried or missed. For example, a developer spending 3 hours/day searching and filtering job boards is 3 hours not spent coding, preparing for interviews, or building side projects.


### 1.2 Solution

QJFit is a hosted, multi-tenant web application that automatically aggregates job offers from multiple job boards into a shared pool, scores each offer against each signed-up user's own résumé using an LLM, and surfaces the top N most relevant offers per user in a clean dashboard sorted by relevance and recency. Access to the dashboard and to triggering fetches requires a registered, authenticated account.

### 1.3 Goals

- Reduce job search time to a single daily/weekly review session
- Surface only high-signal offers matched against the user's real profile
- Aggregate across FR/EU job boards with deduplication, shared across all users
- Provide AI-powered match scoring with transparent reasoning, private to each account
- Track application status in one place
- Be a secure, multi-tenant hosted service — each user's profile, scores, and application tracker are private to their account
- Protect shared, rate-limited resources (external job-board quotas, LLM spend) as the user base grows


## 2. Users & Context

**Primary user**: A tech professional (developer, data engineer, designer, etc.) based in France, actively or passively job searching. No longer assumed to be comfortable with self-hosted tooling or API keys — signup is self-service, the service is operated centrally, and account creation is all that's required to get started.

**Usage pattern**: Sign up, verify email, complete profile once, then review the dashboard every 1–7 days, triggering a fetch (up to 2/day) when they want fresh results. Occasional reconfiguration (new city, updated stack, different seniority target).

**Tenancy model**: One hosted deployment serves many independent user accounts. Job listings (`Job`, `FetchRun`, `FetchLog`) are fetched once and shared across all users — the underlying listings don't vary per user. `Profile` and `Score` are private and scoped to each user: one profile per user, and a job can carry a different score per user it's been matched against.

### 2.1 User stories

| ID | As a user I want to… | So that… | Priority |
|---|---|---|---|
| US-01 | Sign up with an email and password | I can create my own private account | P0 |
| US-02 | Verify my email before using the app | The service is protected from spam/throwaway accounts | P0 |
| US-03 | Log in and log out | I can securely access my own dashboard and no one else's | P0 |
| US-04 | Reset my password if I forget it | I don't get permanently locked out of my account | P1 |
| US-05 | Be guided through profile setup right after verifying my email | The app has what it needs to score offers for me before I try to use it | P0 |
| US-06 | See a ranked list of job offers matching my profile | I immediately know which offers to prioritize | P0 |
| US-07 | Configure my search profile (stack, city, XP, top N) | Results stay relevant as my search evolves | P0 |
| US-08 | Trigger a manual fetch on demand, up to 2 times a day | I can refresh results without waiting for the schedule, without exhausting shared quotas | P0 |
| US-09 | See how many fetches I have left today | I know when I can next refresh my results | P1 |
| US-10 | See an AI-generated match score and explanation per offer | I understand *why* an offer is relevant, not just that it is | P0 |
| US-11 | Filter and sort results by score, date, source, location | I can slice the results based on what I care about that day | P1 |
| US-12 | Mark an offer as "applied", "saved", or "hidden" | I track my pipeline without leaving the app | P1 |
| US-13 | See which skills I'm missing for a given offer | I can prioritize what to learn based on real market demand | P1 |
| US-14 | View the fetch history and last run status | I know the data is fresh and the scheduler is healthy | P1 |
| US-15 | See aggregate stats (top required skills, score distribution) | I get market signal, not just individual offers | P2 |
| US-16 | Export visible results to CSV | I can share or archive my search data | P2 |

---

## 3. Core Features

### 3.0 Accounts & Authentication

- **Signup**: open, self-service — email + password. Passwords are hashed (bcrypt/argon2), never stored or logged in plaintext.
- **Email verification**: required before first login. An unverified account cannot access the dashboard, profile setup, or fetch. This is the primary abuse/spam guard on open signup, and pulls transactional email (previously a v2 "Notifications" item) into v1 scope for verification and password-reset messages only — the full digest feature (§3.6) remains v2.
- **Login/session**: server-side sessions backed by Redis, referenced by an httpOnly session cookie. Logout invalidates the session immediately (no stale-token window, unlike a bare JWT scheme).
- **Password reset**: standard "forgot password" email flow, reusing the verification-email infrastructure.
- **Access gating**: authentication alone is not sufficient. A user must also have completed profile setup (§3.1) before the dashboard or fetch-trigger are unlocked — fetching against an incomplete profile would waste a fetch credit on a meaningless (or skipped) scoring pass.
- **Data isolation**: `Profile` and `Score` are scoped by `userId`. No API route may return or mutate another user's profile, scores, or tracker state.

### 3.1 Profile Setup

Immediately after email verification, the user is guided through profile setup — this is a hard gate before the dashboard or fetch trigger unlock (§3.0). The user uploads their CV (PDF or DOCX) or fills a structured form. The system extracts and stores a normalized profile, one per user account:

| Field                              | Type                | Example                                       |
|------------------------------------|---------------------|-----------------------------------------------|
| `target_role`                      | string              | "Senior Backend Engineer"                     |
| `target_company_industry`          | string[] (optional) |  Insurance, Medical, Tech, Real Estate        |
| `tech_stack`                       | string[]            | ["Python", "FastAPI", "PostgreSQL", "Docker"] |
| `seniority_min` / `seniority_max`  | int (years)         | 0 – 8                                         |
| `location`                         | string              | "Paris" or "France" or "Remote"               |
| `excluded_keywords`                | string[] (optional) | ["PHP", "WordPress"]                          |
| `contract_types`                   | enum[]              | ["CDI", "CDD", "Freelance"]                   |
| `salary_min`                       | int (optional)      | 55000                                         |
| `bio`                              | string(optional)    |                                               |
| `availability`                     | Date(optional)      |                                               |

Profile is stored in Postgres, scoped to the owning user. CV text is embedded and stored for scoring context, private to that user.

### 3.2 Job Source Connectors

Each connector is an independent module implementing a standard `JobSource` interface:

```
interface JobSource {
  name: string
  fetch(profile: Profile, since: Date): Promise<RawJob[]>
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

#### 3.2.1 Fetch triggering and rate limits

- Any authenticated user with a completed profile can trigger a fetch, up to **2 times per day per user** (calendar day).
- A triggered fetch always re-hits the connectors — there is no shared "freshness window" deduplication in v1. This means the per-user 2/day limit is the *only* throttle on connector call volume; at scale (enough concurrent users) this could approach shared quota ceilings (e.g. Adzuna's 250 req/day). Explicitly deferred to v2: a freshness-window check that skips re-hitting connectors if the shared pool was refreshed within the last N minutes.
- Fetching populates the **shared** job pool (§3.3) — all users benefit from any user's fetch, not just the one who triggered it.
- Fetching and scoring are chained: triggering a fetch (1) refreshes the shared pool via the connectors, then (2) scores the triggering user against every job in the pool not yet scored for them — including jobs that arrived from *other* users' earlier fetches. See §3.4 for the per-fetch scoring cap.

### 3.3.1 Normalization

All fetched offers are normalized to a common schema before storage:

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

### 3.3.2 Job Deduplication

Offers from multiple sources are deduplicated using a composite fingerprint:

```
hash(normalize(title) + normalize(company) + normalize(location))
```

First-seen record wins. Source list is preserved on the deduplicated record. Deduplication happens once against the shared pool — not per user.

### 3.4 AI Scoring Engine

For each job offer not yet scored for a given user, a scoring prompt is sent to the LLM (via API):

**Input**: That user's profile summary + raw job description
**Output**: Structured JSON with:

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

A score is private to the (user, job) pair — the same job can carry different scores for different users, since it's matched against different profiles.

Score is 0–100. Final ranking uses:

```
ranking_score = score * recency_weight
recency_weight = exp(-days_since_posted / decay_days)
decay_days = 14  (configurable)
```

**Per-fetch scoring cap**: each fetch scores at most 50 jobs unscored for that user (existing default, hard-capped at 200). Any remaining backlog rolls over and is picked up on the user's next fetch — bounded by their 2/day limit. This protects LLM spend from an unbounded burst (e.g. a new user's first fetch facing a large backlog accumulated from other users' activity).

Re-scoring is triggered only when the profile changes. A scored offer shall not be re-scored for a user unless that user explicitly requests it.

### 3.5 Dashboard

Only accessible to authenticated users with a completed profile (§3.0). The main view is a ranked list of job offers — scored against *that user's* profile — with:

- Score badge (color-coded: green ≥75, amber 50–74, red <50)
- Role title, company name, location, contract type, short description
- Days since posted
- Match reasons tags
- "View full offer" expandable panel
- Direct link to original listing
- Sort by score badge/date
- Save / Archive / Dismiss actions
- Remaining fetch credits for today (US-09)

**Filters** (sidebar):
- Date range (last 24h / 7d / 30d)
- Score threshold
- Source (multi-select), all sources are selected by default
- Contract type
- Location override
- Remote (multi-select), onsite, hybrid, full-remote

**Settings panel**:
- Edit profile / re-upload CV
- Set top N (default: 20)
- Set recency decay factor
- Change password / manage account

### 3.6 Notifications (v2)

- Email digest (via Resend or SMTP) triggered after each scrape run
- Digest contains top N offers with scores and direct links
- Configurable: daily / weekly / on-threshold-only (score ≥ X)

### 3.7 Application Tracker (v2)

- Kanban board: Saved → Applied → Interview → Offer → Rejected
- Notes per offer
- Reminder dates


## 4. Security Considerations

- The app is a hosted, multi-tenant service — authentication is required for all dashboard, profile, and fetch endpoints. Only the signup, login, email-verification, and password-reset endpoints, plus the health check, are reachable without a session.
- Passwords are hashed (bcrypt/argon2); never stored, logged, or transmitted in plaintext beyond the initial TLS-protected request.
- Sessions are server-side (Redis-backed), referenced by an httpOnly, secure cookie — not accessible to client-side JavaScript, and immediately revocable on logout.
- `Profile`, CV text, and `Score` rows are scoped to the owning user; no API route may return or mutate another user's data. This must be enforced at the query layer, not just the route layer.
- API keys for job-board/LLM providers stored in `.env` / Docker secrets, never in the DB or frontend, and never scoped to or exposed per-user (they're operator-level credentials shared across the whole service).
- CV text stored in the DB but not exposed via API beyond the owning user's profile endpoint.
- Job descriptions are sent to the LLM API — user should be aware; user profile fields sent as scoring context should be minimized to what's needed for matching.
- Rate limits (2 fetches/day/user, 50 scores/fetch) exist as much for cost/quota protection as for abuse prevention — see §3.2.1 and §3.4.
- Signup being open (not invite-gated) means email verification (§3.0) is the primary defense against spam/throwaway accounts; monitor signup volume as a leading indicator if abuse becomes a problem.

### 4.1 Observability

- All fetch runs are logged to the `fetch_logs` table with per-source results
- Application logs use Pino (structured JSON) — consistent with the roadmap's observability track
- A `/api/metrics` endpoint exposes Prometheus metrics: offers_fetched_total, scoring_errors_total, fetch_duration_seconds, signups_total, verified_signups_total

## 5. Milestones & Phasing

### Phase 0 — Accounts Foundation

- [ ] `User` model, password hashing, signup/login/logout endpoints
- [ ] Email verification flow (requires transactional email provider decision)
- [ ] Password reset flow
- [ ] Redis-backed session store
- [ ] `Profile`/`Score` scoped by `userId`; migrate existing singleton profile data
- [ ] Auth + profile-completion gate on dashboard/fetch routes
- [ ] Per-user fetch rate limiting (2/day)

### Phase 1 — Core MVP

- [ ] Project scaffolding (monorepo, Docker Compose, CI skeleton, CD)
- [ ] Profile setup (form + CV upload + LLM parsing)
- [ ] France Travail connector
- [ ] WTTJ RSS connector
- [ ] AI scoring pipeline (per-user, capped per fetch)
- [ ] Dashboard (list view, filters, score badges)
- [ ] Manual scrape trigger (rate-limited, chained with per-user scoring)
- [ ] VPS deploy playbook

### Phase 2 — More Sources + Digest

- [ ] JSearch connector
- [ ] Adzuna connector
- [ ] HelloWork RSS connector
- [ ] Deduplication engine
- [ ] Scheduled scraping (Celery Beat)
- [ ] Email digest (Resend)
- [ ] Fetch freshness-window dedup (skip redundant connector calls across users)

### Phase 3 — Tracker + Notification

- [ ] Application tracker (Kanban)
- [ ] Run history page
- [ ] Notifications config UI

### Phase 4 — Production Hardening

- [ ] Full GitHub Actions pipeline
- [ ] Caddy config + TLS (local), Traefik + TLS (production)
- [ ] Backup script (pg_dump to S3 or local)
- [ ] Monitoring (UptimeRobot or Healthcheck.io ping)

---

## 6. Success Metrics

| Metric                                                  | Target                       |
|---------------------------------------------------------|------------------------------|
| Signup-to-verified-account time                         | < 5 minutes                  |
| Time to first ranked results after email verification   | < 10 minutes                 |
| Scrape-to-scored latency (50 offers)                    | < 2 minutes                  |
| Deduplication accuracy                                  | > 95%                        |
| Dashboard load time                                     | < 300ms                      |
| False positive rate (irrelevant offers scored ≥75)      | < 10%                        |
