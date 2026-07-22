export type JobSource = "France Travail" | "WTTJ";
export type ContractType = "CDI" | "CDD" | "Freelance";
export type RemotePolicy = "Full" | "Hybrid" | "On-site";
export type ScoreTier = "high" | "mid" | "low";

export interface MatchedJob {
  readonly id: number;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly contract: ContractType;
  readonly remote: RemotePolicy;
  readonly source: JobSource;
  readonly score: number;
  readonly daysAgo: number;
  readonly summary: string;
  readonly reasons: readonly string[];
  readonly gaps: readonly string[];
  readonly full: string;
  readonly url: string;
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
