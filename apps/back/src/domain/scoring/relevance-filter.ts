import type { CvContext } from "../cv/cv-context.entity.js";
import type { Job } from "../jobs/job.entity.js";

function countTechStackOverlap(cvContext: CvContext, job: Job): number {
  const description = job.description.toLowerCase();
  return cvContext.techStack.filter((tech) =>
    description.includes(tech.toLowerCase()),
  ).length;
}

function hasRoleOverlap(cvContext: CvContext, job: Job): boolean {
  if (!cvContext.targetRole) {
    return false;
  }
  return job.title.toLowerCase().includes(cvContext.targetRole.toLowerCase());
}

function hasLocationOverlap(cvContext: CvContext, job: Job): boolean {
  if (!cvContext.location) {
    return false;
  }
  return job.location.toLowerCase().includes(cvContext.location.toLowerCase());
}

function hasContractTypeOverlap(cvContext: CvContext, job: Job): boolean {
  if (cvContext.contractTypes.length === 0) {
    return false;
  }
  return cvContext.contractTypes.includes(job.contractType);
}

export function computeRelevanceScore(cvContext: CvContext, job: Job): number {
  let score = countTechStackOverlap(cvContext, job);
  if (hasRoleOverlap(cvContext, job)) score += 1;
  if (hasLocationOverlap(cvContext, job)) score += 1;
  if (hasContractTypeOverlap(cvContext, job)) score += 1;
  return score;
}

export interface RelevantJob {
  readonly job: Job;
  readonly relevanceScore: number;
}

// Carries each job's relevanceScore forward instead of collapsing it to a
// pass/fail — the recency tiebreak (step 2) needs it to rank a job matching
// on several signals above one matching on a single generic one (e.g. just
// "Paris"), which a flat >0 filter can't distinguish between.
export function filterRelevantJobs(
  cvContext: CvContext,
  jobs: readonly Job[],
): readonly RelevantJob[] {
  return jobs
    .map((job) => ({ job, relevanceScore: computeRelevanceScore(cvContext, job) }))
    .filter((entry) => entry.relevanceScore > 0);
}
