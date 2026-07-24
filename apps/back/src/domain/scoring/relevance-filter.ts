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

// A CV's location can be a real place ("Paris") or a remote-work preference
// ("Remote"/"Télétravail") — the latter can never literally appear in a
// job's `location` field (a physical address), so gating on it would reject
// the entire pool.
const REMOTE_LOCATION_VALUES = new Set(["remote", "télétravail", "teletravail"]);

/**
 * What the role gate needs from an embedding provider — a narrow,
 * domain-owned shape rather than an import of
 * application/ports/output/embedding-provider.port.ts, so this file stays
 * free of dependencies on outer layers (see AGENTS.md rule 13). The real
 * `EmbeddingProviderPort` satisfies this structurally; the application layer
 * is what wires a concrete adapter through at the call site.
 */
export interface RoleSimilarityProvider {
  embed(text: string): Promise<readonly number[]>;
}

function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  let dot = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return dot;
}

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

type RoleMatchTier = "strong" | "family" | "none";

// Strong match is a fast, literal check — no embedding call needed. Family
// match falls back to embedding similarity between the CV's stated target
// role and the job title (PRD §3.4, issue #14), replacing the previous
// hand-maintained ROLE_FAMILY_TITLE_INDICATORS keyword list, whose brittle
// English/French synonym coverage required a code change for every new
// wording variant.
async function classifyRoleMatch(
  cvContext: CvContext,
  job: Job,
  embeddingProvider: RoleSimilarityProvider,
  similarityThreshold: number,
): Promise<RoleMatchTier> {
  if (hasStrongRoleMatch(cvContext, job)) {
    return "strong";
  }
  if (!cvContext.targetRole) {
    return "none";
  }

  const [targetRoleEmbedding, titleEmbedding] = await Promise.all([
    embeddingProvider.embed(cvContext.targetRole),
    embeddingProvider.embed(job.title),
  ]);
  const similarity = cosineSimilarity(targetRoleEmbedding, titleEmbedding);

  return similarity >= similarityThreshold ? "family" : "none";
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
 * §3.4 step 1) — no LLM call (the role gate's embedding lookup is the one
 * exception, and only fires when the CV states a target role that doesn't
 * literally appear in the job title). Bounds cost/latency before any
 * scoring.
 *
 * Role and (physical) location are hard gates: a stated preference that
 * doesn't match zeroes the score outright, regardless of any other
 * overlap. Contract type is intentionally NOT a gate — every job currently
 * has contractType "Other" (the France Travail connector doesn't map a
 * real contract type yet), so gating on it would zero out the entire pool
 * for any CV that states one. It stays a bonus-only signal until that's
 * fixed, and until then never actually fires.
 */
export async function computeRelevanceScore(
  cvContext: CvContext,
  job: Job,
  embeddingProvider: RoleSimilarityProvider,
  roleSimilarityThreshold: number,
): Promise<number> {
  const roleMatchTier = await classifyRoleMatch(
    cvContext,
    job,
    embeddingProvider,
    roleSimilarityThreshold,
  );
  if (cvContext.targetRole && roleMatchTier === "none") {
    return 0;
  }
  if (!passesLocationGate(cvContext, job)) {
    return 0;
  }

  let score = countTechStackOverlap(cvContext, job) * TECH_STACK_WEIGHT;

  if (roleMatchTier === "strong") {
    score += STRONG_ROLE_MATCH_WEIGHT;
  } else if (roleMatchTier === "family") {
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
export async function filterRelevantJobs(
  cvContext: CvContext,
  jobs: readonly Job[],
  embeddingProvider: RoleSimilarityProvider,
  roleSimilarityThreshold: number,
): Promise<readonly RelevantJob[]> {
  const entries = await Promise.all(
    jobs.map(async (job) => ({
      job,
      relevanceScore: await computeRelevanceScore(
        cvContext,
        job,
        embeddingProvider,
        roleSimilarityThreshold,
      ),
    })),
  );
  return entries.filter((entry) => entry.relevanceScore > 0);
}
