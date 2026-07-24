import type { CvContext } from "../cv/cv-context.entity.js";
import type { Job } from "../jobs/job.entity.js";
import { extractDepartmentCode, resolveRegion } from "../shared/french-region.js";

// Weights only rank jobs that already cleared the hard gates below — they
// never decide whether a job is relevant at all, only how relevant.
const TECH_STACK_WEIGHT = 1;
const STRONG_ROLE_MATCH_WEIGHT = 4;
const ROLE_FAMILY_MATCH_WEIGHT = 2;
const LOCATION_MATCH_WEIGHT = 2;
const CONTRACT_TYPE_MATCH_WEIGHT = 1;

// Broad, deterministic role-family indicators (English + French) covering
// every role extract-cv-context.ts can produce as a targetRole. A literal
// targetRole match (hasStrongRoleMatch) is the strong signal; these looser
// indicators exist only so the role gate below doesn't reject every French
// job title outright just because it isn't phrased in the CV's exact
// wording. Catching genuine synonyms/wording beyond this list is the real
// LLM scoring step's job (PRD §3.4 step 3), not this deterministic filter.
// Deliberately excludes bare "engineer"/"ingénieur" — in French job titles
// that word spans every engineering discipline (pharmacology, mechanical,
// civil, ...), not just software, and including it let a title like
// "Ingénieur d'Étude en Pharmacologie" pass the gate. "développeur" doesn't
// have that problem — it's near-exclusively used for software roles in the
// French job market — so it stays as a bare indicator.
const ROLE_FAMILY_TITLE_INDICATORS = [
  "developer", "développeur", "developpeur", "développeuse", "developpeuse",
  "programmer", "programmeur",
  "devops", "dev ops", "dev-ops",
  "data scientist", "data engineer", "data analyst",
  "software", "logiciel",
  "full stack", "fullstack", "full-stack",
  "backend", "back-end", "back end",
  "frontend", "front-end", "front end",
  "qa engineer", "testeur", "quality assurance", "assurance qualité",
  "product manager", "product owner", "chef de produit",
  "mobile developer", "développeur mobile", "developpeur mobile",
] as const;

// A CV's location can be a real place ("Paris") or a remote-work preference
// ("Remote"/"Télétravail") — the latter can never literally appear in a
// job's `location` field (a physical address), so gating on it would reject
// the entire pool.
const REMOTE_LOCATION_VALUES = new Set(["remote", "télétravail", "teletravail"]);

function countTechStackOverlap(cvContext: CvContext, job: Job): number {
  const description = job.description.toLowerCase();
  return cvContext.techStack.filter((tech) =>
    description.includes(tech.toLowerCase()),
  ).length;
}

function hasStrongRoleMatch(cvContext: CvContext, job: Job): boolean {
  if (!cvContext.targetRole) {
    return false;
  }
  return job.title.toLowerCase().includes(cvContext.targetRole.toLowerCase());
}

function hasRoleFamilyMatch(job: Job): boolean {
  const title = job.title.toLowerCase();
  return ROLE_FAMILY_TITLE_INDICATORS.some((indicator) => title.includes(indicator));
}

// Hard gate: when the CV states a target role, a job whose title doesn't
// indicate the same broad role family is not relevant, full stop — no
// amount of overlap on other attributes (a shared city, a single incidental
// tech keyword) should surface e.g. "Hospitality Officer" or "Conseiller
// Patrimonial" for a Fullstack Developer CV.
function passesRoleGate(cvContext: CvContext, job: Job): boolean {
  if (!cvContext.targetRole) {
    return true;
  }
  return hasStrongRoleMatch(cvContext, job) || hasRoleFamilyMatch(job);
}

// Region-aware containment: a literal substring match still covers today's
// city-level case (a job's "XX - City" location already contains the city
// name), and additionally resolves the job's department code to its region
// so a CV stating regional mobility (e.g. "Île-de-France") matches any job
// in that region, not just one whose location string repeats it verbatim
// (which France Travail's connector format never does). If the CV's stated
// location doesn't resolve against either table, this degrades to the
// plain substring check — the same behavior as before this resolution
// existed — rather than rejecting the job outright.
function hasLocationOverlap(cvContext: CvContext, job: Job): boolean {
  if (!cvContext.location) {
    return false;
  }
  const cvLocation = cvContext.location.toLowerCase();
  if (job.location.toLowerCase().includes(cvLocation)) {
    return true;
  }

  const departmentCode = extractDepartmentCode(job.location);
  const jobRegion = departmentCode ? resolveRegion(departmentCode) : null;
  return jobRegion !== null && jobRegion.toLowerCase() === cvLocation;
}

function statesPhysicalLocation(cvContext: CvContext): boolean {
  return !!cvContext.location && !REMOTE_LOCATION_VALUES.has(cvContext.location.toLowerCase());
}

// Hard gate mirroring the role gate above, but only for an actual city/
// region preference — see REMOTE_LOCATION_VALUES for why a remote
// preference is exempted instead of gated on.
function passesLocationGate(cvContext: CvContext, job: Job): boolean {
  if (!statesPhysicalLocation(cvContext)) {
    return true;
  }
  return hasLocationOverlap(cvContext, job);
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
 *
 * Role and (physical) location are hard gates: a stated preference that
 * doesn't match zeroes the score outright, regardless of any other
 * overlap. Contract type is intentionally NOT a gate — every job currently
 * has contractType "Other" (the France Travail connector doesn't map a
 * real contract type yet), so gating on it would zero out the entire pool
 * for any CV that states one. It stays a bonus-only signal until that's
 * fixed, and until then never actually fires.
 */
export function computeRelevanceScore(cvContext: CvContext, job: Job): number {
  if (!passesRoleGate(cvContext, job)) {
    return 0;
  }
  if (!passesLocationGate(cvContext, job)) {
    return 0;
  }

  let score = countTechStackOverlap(cvContext, job) * TECH_STACK_WEIGHT;

  if (hasStrongRoleMatch(cvContext, job)) {
    score += STRONG_ROLE_MATCH_WEIGHT;
  } else if (cvContext.targetRole && hasRoleFamilyMatch(job)) {
    score += ROLE_FAMILY_MATCH_WEIGHT;
  }

  if (hasLocationOverlap(cvContext, job)) {
    score += LOCATION_MATCH_WEIGHT;
  }

  if (hasContractTypeOverlap(cvContext, job)) {
    score += CONTRACT_TYPE_MATCH_WEIGHT;
  }

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
