import type { MatchedJob, PoolStats } from '../types/job.js';

// Placeholder content ported from docs/design/prototype.html pending the real
// POST /api/match and GET /api/jobs routes (ADR 0016). Replace the data source,
// not the shape — see docs/design/README.md "Handoff notes for implementation".
export const POOL_STATS: PoolStats = {
  total: 214,
  refreshedHoursAgo: 3,
  bySource: [
    { source: 'France Travail', count: 146 },
    { source: 'WTTJ', count: 68 }
  ]
};

export const MOCK_MATCHED_JOBS: readonly MatchedJob[] = [
  {
    id: 1,
    title: 'Ingénieur Backend Senior — Python / FastAPI',
    company: 'Alma',
    location: 'Paris 9e',
    contract: 'CDI',
    remote: 'Full',
    source: 'France Travail',
    score: 92,
    daysAgo: 2,
    summary:
      'Scale-up fintech building payment infrastructure — stack matches closely, seniority range aligns well.',
    reasons: ['FastAPI', 'PostgreSQL', 'Async architecture'],
    gaps: ['Kubernetes'],
    full: "Alma is hiring a senior backend engineer to own core payment-orchestration services. You'll work across FastAPI, PostgreSQL and an event-driven architecture handling several million transactions a month. 5–8 years experience expected; on-call is shared across a 6-person team.",
    url: '#'
  },
  {
    id: 2,
    title: 'Lead Data Platform Engineer',
    company: 'Dataiku',
    location: 'Paris 2e',
    contract: 'CDI',
    remote: 'Hybrid',
    source: 'WTTJ',
    score: 84,
    daysAgo: 1,
    summary: 'Data-platform role with heavy Python/Airflow overlap; two days a week on-site in the 2nd arrondissement.',
    reasons: ['Python', 'Airflow', 'dbt'],
    gaps: ['Snowflake'],
    full: "Leading a team of 4 building the internal data platform that powers Dataiku's ML tooling. Heavy use of Airflow, dbt and Python; Snowflake experience is a plus but not required — ramp-up support is provided.",
    url: '#'
  },
  {
    id: 3,
    title: 'Développeur Full-Stack Python / Vue',
    company: 'Payfit',
    location: 'Paris 8e',
    contract: 'CDI',
    remote: 'Full',
    source: 'WTTJ',
    score: 88,
    daysAgo: 0,
    summary: 'Full-stack role pairing your Vue and Python experience almost one-for-one; fully remote-friendly.',
    reasons: ['Vue.js', 'Python', 'TypeScript'],
    gaps: [],
    full: 'Cross-functional squad shipping payroll features end to end: Vue 3 + TypeScript on the front, Python (FastAPI) on the back. Fully remote within France, quarterly on-site gatherings.',
    url: '#'
  },
  {
    id: 4,
    title: 'Backend Engineer (Python) — B2B SaaS',
    company: 'Pennylane',
    location: 'Paris 3e',
    contract: 'CDI',
    remote: 'On-site',
    source: 'France Travail',
    score: 78,
    daysAgo: 3,
    summary: 'Solid Django/PostgreSQL overlap; on-site only, which narrows the fit slightly.',
    reasons: ['Django', 'PostgreSQL'],
    gaps: ['GraphQL'],
    full: 'Django monolith serving accounting workflows for 30k+ businesses. Small team, high ownership, on-site four days a week in the 3rd arrondissement. GraphQL is being introduced this year.',
    url: '#'
  },
  {
    id: 5,
    title: 'Ingénieur Data / MLOps',
    company: 'Doctolib',
    location: 'Levallois-Perret',
    contract: 'CDD',
    remote: 'Hybrid',
    source: 'France Travail',
    score: 52,
    daysAgo: 4,
    summary: 'Adjacent MLOps role — your Python background transfers, but the ML tooling stack is mostly new ground.',
    reasons: ['Python', 'MLflow'],
    gaps: ['Kubeflow', 'Scala'],
    full: "Fixed-term (12 months) MLOps role supporting Doctolib's recommendation models. MLflow and Kubeflow for orchestration; a working knowledge of Scala data pipelines is a plus.",
    url: '#'
  },
  {
    id: 6,
    title: 'Software Engineer — Platform & Infra',
    company: 'Qonto',
    location: 'Paris 9e',
    contract: 'CDI',
    remote: 'Hybrid',
    source: 'WTTJ',
    score: 61,
    daysAgo: 5,
    summary: 'Infra-leaning role — your containerisation basics carry over, but Go and Terraform depth is expected.',
    reasons: ['Docker basics'],
    gaps: ['Go', 'Terraform', 'Kubernetes'],
    full: 'Platform team maintaining the internal PaaS on top of Kubernetes and Terraform. Go is the primary language for tooling; prior production Kubernetes experience is expected within the first quarter.',
    url: '#'
  },
  {
    id: 7,
    title: 'Ingénieur DevOps',
    company: 'Capgemini',
    location: 'Nantes',
    contract: 'Freelance',
    remote: 'On-site',
    source: 'France Travail',
    score: 45,
    daysAgo: 6,
    summary: 'Mostly Ansible-driven ops work with on-call rotation — limited overlap with your recent projects.',
    reasons: ['Docker'],
    gaps: ['Ansible', 'On-call rotation'],
    full: 'Client-facing DevOps mission for a public-sector account in Nantes. Primary toolchain is Ansible + on-prem VMware; on-call rotation is mandatory from month two.',
    url: '#'
  }
];

export const TICKER_LINES: readonly string[] = [
  'Reading document…',
  'Extracting profile — stack, seniority, location…',
  `Cross-referencing ${POOL_STATS.total} open roles…`,
  'Scoring top candidates (bounded to 5 at a time)…',
  'Ranking by fit and recency…'
];
