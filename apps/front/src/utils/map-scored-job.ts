import type { MatchedJob } from '../types/job.js';
import type { ApiScoredJob } from '../types/match-api.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function daysSince(date: Date, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / MS_PER_DAY));
}

export function toMatchedJob(scoredJob: ApiScoredJob, now: Date): MatchedJob {
  return {
    id: scoredJob.job.id,
    title: scoredJob.job.title,
    company: scoredJob.job.company,
    location: scoredJob.job.location,
    contract: scoredJob.job.contractType,
    remote: scoredJob.job.remotePolicy,
    source: scoredJob.job.source,
    score: scoredJob.score,
    daysAgo: daysSince(new Date(scoredJob.job.fetchedAt), now),
    summary: scoredJob.summary,
    reasons: scoredJob.matchReasons,
    gaps: scoredJob.missingSkills,
    full: scoredJob.job.description,
    url: scoredJob.job.url
  };
}
