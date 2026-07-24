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

/**
 * Cheap keyword/attribute overlap between the parsed CV and a job (PRD
 * §3.4 step 1) — no LLM call. Bounds cost/latency before any scoring.
 */
export function computeRelevanceScore(cvContext: CvContext, job: Job): number {
  let score = countTechStackOverlap(cvContext, job);
  if (hasRoleOverlap(cvContext, job)) score += 1;
  if (hasLocationOverlap(cvContext, job)) score += 1;
  if (hasContractTypeOverlap(cvContext, job)) score += 1;
  return score;
}

export function filterRelevantJobs(
  cvContext: CvContext,
  jobs: readonly Job[],
): readonly Job[] {
  return jobs.filter((job) => computeRelevanceScore(cvContext, job) > 0);
}
