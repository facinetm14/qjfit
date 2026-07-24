import type { PoolStats } from "../types/job.js";

// Placeholder pool stats pending a real GET /api/jobs route (not yet built —
// see AGENTS.md's migration note). Match results themselves now come from
// the real POST /api/match + GET /api/match/:id API (useMatchFlow.ts).
export const POOL_STATS: PoolStats = {
  total: 214,
  refreshedHoursAgo: 3,
  bySource: [
    { source: "france-travail", count: 146 },
    { source: "wttj-rss", count: 68 },
  ],
};

export const TICKER_LINES: readonly string[] = [
  "Reading document…",
  "Extracting profile — stack, seniority, location…",
  `Cross-referencing ${POOL_STATS.total} open roles…`,
  "Scoring top candidates (bounded to 5 at a time)…",
  "Ranking by fit and recency…",
];
