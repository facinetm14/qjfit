// Wire contract for POST /api/match + GET /api/match/:id — mirrors
// apps/back/src/domain/{jobs,scoring,match}/*.entity.ts. Kept separate from
// the UI-shaped MatchedJob (types/job.ts) so a backend field rename only
// touches this file plus its one mapping function (utils/map-scored-job.ts).

export type ApiContractType =
  | 'CDI'
  | 'CDD'
  | 'Freelance'
  | 'Internship'
  | 'Apprenticeship'
  | 'Other';

export type ApiRemotePolicy = 'Full' | 'Hybrid' | 'OnSite' | 'Unknown';

export interface ApiJob {
  readonly id: string;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly contractType: ApiContractType;
  readonly remotePolicy: ApiRemotePolicy;
  readonly description: string;
  readonly url: string;
  readonly source: string;
  readonly sourceJobId: string | null;
  readonly dedupKey: string;
  readonly fetchedAt: string;
}

export interface ApiScoredJob {
  readonly job: ApiJob;
  readonly score: number;
  readonly summary: string;
  readonly matchReasons: readonly string[];
  readonly missingSkills: readonly string[];
  readonly seniorityFit: string;
  readonly redFlags: readonly string[];
  readonly rankingScore: number;
}

export type ApiMatchTicket =
  | { readonly id: string; readonly status: 'pending'; readonly createdAt: string }
  | {
      readonly id: string;
      readonly status: 'completed';
      readonly createdAt: string;
      readonly results: readonly ApiScoredJob[];
    }
  | {
      readonly id: string;
      readonly status: 'failed';
      readonly createdAt: string;
      readonly error: string;
    };

export interface ApiCreateMatchResponse {
  readonly ticketId: string;
  readonly remaining: number;
}

export interface ApiRateLimitExceededResponse {
  readonly error: string;
  readonly resetAt: string;
}
