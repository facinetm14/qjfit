// Source/contract/remote unions mirror apps/back/src/domain/jobs/job.entity.ts
// and domain/shared/contract-type.ts — the two apps don't share a types
// package, so these are kept in sync by hand.
export type JobSource = "france-travail" | "wttj-rss";
export type ContractType =
  | "CDI"
  | "CDD"
  | "Freelance"
  | "Internship"
  | "Apprenticeship"
  | "Other";
export type RemotePolicy = "Full" | "Hybrid" | "OnSite" | "Unknown";
export type ScoreTier = "high" | "mid" | "low";

export interface MatchedJob {
  readonly id: string;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly contract: ContractType;
  readonly remote: RemotePolicy;
  readonly source: string;
  readonly score: number;
  readonly daysAgo: number;
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly gaps: readonly string[];
  readonly full: string;
  readonly url: string;
}

const SOURCE_LABELS: Record<JobSource, string> = {
  "france-travail": "France Travail",
  "wttj-rss": "Welcome to the Jungle",
};

export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source as JobSource] ?? source;
}

const REMOTE_POLICY_LABELS: Record<RemotePolicy, string> = {
  Full: "Full remote",
  Hybrid: "Hybrid",
  OnSite: "On-site",
  Unknown: "Remote policy unknown",
};

export function remotePolicyLabel(remote: RemotePolicy): string {
  return REMOTE_POLICY_LABELS[remote];
}

export interface PoolStats {
  readonly total: number;
  readonly refreshedHoursAgo: number;
  readonly bySource: ReadonlyArray<{
    readonly source: JobSource;
    readonly count: number;
  }>;
}

// PRD-mandated tiers (§3.5): green >=75, amber 50-74, red <50 — see docs/design/README.md
export function scoreTier(score: number): ScoreTier {
  if (score >= 75) return "high";
  if (score >= 50) return "mid";
  return "low";
}

export const ClientEvents = {
  CV_UPLOADED: "cv-uploaded",
  CV_SUBMITTED: "cv-submitted",
} as const;
