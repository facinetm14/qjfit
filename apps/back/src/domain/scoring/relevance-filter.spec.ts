import { computeRelevanceScore, filterRelevantJobs } from "./relevance-filter.js";
import { StubEmbeddingProviderAdapter } from "../../infrastructure/adapters/output/embedding/stub-embedding-provider.adapter.js";
import type { CvContext } from "../cv/cv-context.entity.js";
import type { Job } from "../jobs/job.entity.js";

// Same default as config.ts's ROLE_SIMILARITY_THRESHOLD — kept as a literal
// here so this domain-layer spec doesn't reach into apps/back/src/config.ts.
const ROLE_SIMILARITY_THRESHOLD = 0.25;
const embeddingProvider = new StubEmbeddingProviderAdapter();

function buildCvContext(overrides: Partial<CvContext> = {}): CvContext {
  return {
    targetRole: null,
    techStack: [],
    seniority: null,
    location: null,
    excludedKeywords: [],
    contractTypes: [],
    salaryFloor: null,
    ...overrides,
  };
}

function buildJob(overrides: Partial<Job> = {}): Job {
  return {
    id: "job-1",
    title: "Backend Engineer",
    company: "Acme",
    location: "Paris",
    contractType: "CDI",
    remotePolicy: "Full",
    description: "We use TypeScript, PostgreSQL and Docker.",
    url: "https://example.com/job-1",
    source: "france-travail",
    sourceJobId: "FT-1",
    dedupKey: "dedup-1",
    fetchedAt: new Date("2026-07-20T00:00:00.000Z"),
    ...overrides,
  };
}

async function score(cvContext: CvContext, job: Job): Promise<number> {
  return computeRelevanceScore(cvContext, job, embeddingProvider, ROLE_SIMILARITY_THRESHOLD);
}

describe("computeRelevanceScore", () => {
  describe("role gate", () => {
    it("zeroes the score when the job title doesn't indicate the same broad role family, regardless of other overlap", async () => {
      const cvContext = buildCvContext({
        targetRole: "Full Stack Developer",
        techStack: ["TypeScript", "Docker"],
        location: "Paris",
        contractTypes: ["CDI"],
      });
      // A receptionist role that happens to share the CV's location, contract
      // type, and even mentions "Docker" in passing — none of that should
      // matter once the title itself is unrelated.
      const unrelatedJob = buildJob({
        title: "Hospitality Officer H/F",
        description: "Front desk duties. We recently moved offices via a Docker shipping container.",
      });

      expect(await score(cvContext, unrelatedJob)).toBe(0);
    });

    it("zeroes a job whose title only shares the generic word \"ingénieur\"/\"engineer\" from a different discipline", async () => {
      const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
      // Bare "ingénieur"/"engineer" spans every engineering discipline in
      // French job titles (pharmacology, mechanical, civil, ...) — it must
      // not be treated as a software-role-family indicator on its own.
      const pharmaJob = buildJob({ title: "Ingénieur d'Étude en Pharmacologie des Récepteurs" });

      expect(await score(cvContext, pharmaJob)).toBe(0);
    });

    it("does not gate when the CV states no target role", async () => {
      const cvContext = buildCvContext({ techStack: ["TypeScript"] });
      const job = buildJob({ title: "Hospitality Officer H/F" });

      expect(await score(cvContext, job)).toBeGreaterThan(0);
    });

    it("awards the strong-match weight when the exact target role appears in the title", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer" });
      const job = buildJob({ title: "Backend Engineer" });

      expect(await score(cvContext, job)).toBe(4);
    });

    it("awards the (smaller) family-match weight for a same-family title that isn't an exact match", async () => {
      const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
      const job = buildJob({ title: "Développeur Java Angular H/F", description: "desc" });

      expect(await score(cvContext, job)).toBe(2);
    });

    it("still passes 'Développeur Full Stack' for a 'Full Stack Developer' CV via embedding similarity", async () => {
      const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
      const job = buildJob({ title: "Développeur Full Stack", description: "desc" });

      expect(await score(cvContext, job)).toBe(2);
    });
  });

  describe("location gate", () => {
    it("zeroes the score when a stated physical location doesn't overlap, even with a role match", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Marseille" });
      const job = buildJob({ title: "Backend Engineer", location: "Paris" });

      expect(await score(cvContext, job)).toBe(0);
    });

    it("does not gate on a remote-work preference, since a job's location field is never literally \"Remote\"", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Remote" });
      const job = buildJob({ title: "Backend Engineer", location: "Paris" });

      expect(await score(cvContext, job)).toBeGreaterThan(0);
    });

    it("awards the location weight when it overlaps, case-insensitively", async () => {
      const cvContext = buildCvContext({ location: "paris" });
      const job = buildJob({ location: "Paris, France" });

      expect(await score(cvContext, job)).toBe(2);
    });

    it("passes a job in Massy (dept 91) for a CV stating Île-de-France regional mobility", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Île-de-France" });
      const job = buildJob({ title: "Backend Engineer", location: "91 - MASSY" });

      expect(await score(cvContext, job)).toBeGreaterThan(0);
    });

    it("still passes only Paris-area jobs for a CV stating the specific city Paris (unchanged behavior)", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Paris" });
      const parisJob = buildJob({ title: "Backend Engineer", location: "75 - PARIS" });
      const lyonJob = buildJob({ title: "Backend Engineer", location: "69 - LYON" });

      expect(await score(cvContext, parisJob)).toBeGreaterThan(0);
      expect(await score(cvContext, lyonJob)).toBe(0);
    });

    it("rejects a job in a different region from a CV's stated region", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Île-de-France" });
      const job = buildJob({ title: "Backend Engineer", location: "69 - LYON" });

      expect(await score(cvContext, job)).toBe(0);
    });

    it("degrades to plain substring matching when the CV's location doesn't resolve against either table", async () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Springfield" });
      const noMatch = buildJob({ title: "Backend Engineer", location: "75 - PARIS" });
      const literalMatch = buildJob({ title: "Backend Engineer", location: "Springfield, USA" });

      expect(await score(cvContext, noMatch)).toBe(0);
      expect(await score(cvContext, literalMatch)).toBeGreaterThan(0);
    });
  });

  describe("tech stack and contract type", () => {
    it("counts one point per tech stack keyword found in the job description", async () => {
      const cvContext = buildCvContext({
        techStack: ["TypeScript", "Docker", "Python"],
      });
      const job = buildJob();

      expect(await score(cvContext, job)).toBe(2);
    });

    it("counts a point when the job's contract type is among the CV's stated contract types", async () => {
      const cvContext = buildCvContext({ contractTypes: ["CDI", "Freelance"] });
      const job = buildJob({ contractType: "CDI" });

      expect(await score(cvContext, job)).toBe(1);
    });

    it("does not award a contract-type point when the CV states no preference", async () => {
      const cvContext = buildCvContext({ contractTypes: [] });
      const job = buildJob({ contractType: "CDI" });

      expect(await score(cvContext, job)).toBe(0);
    });

    it("never awards a contract-type point today, since every job is currently mapped to contractType \"Other\"", async () => {
      const cvContext = buildCvContext({ contractTypes: ["CDI"] });
      const job = buildJob({ contractType: "Other" });

      expect(await score(cvContext, job)).toBe(0);
    });
  });

  it("sums weighted signals across all dimensions once the gates are cleared", async () => {
    const cvContext = buildCvContext({
      targetRole: "Backend Engineer",
      techStack: ["TypeScript", "Docker"],
      location: "Paris",
      contractTypes: ["CDI"],
    });
    const job = buildJob();

    // 2 tech-stack matches (2*1) + strong role match (4) + location (2) + contract type (1)
    expect(await score(cvContext, job)).toBe(9);
  });
});

describe("filterRelevantJobs", () => {
  it("excludes jobs that don't clear the relevance gates", async () => {
    const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
    const matching = buildJob({ id: "job-match", title: "Développeur Full Stack" });
    const nonMatching = buildJob({ id: "job-no-match", title: "Hospitality Officer H/F" });

    const result = await filterRelevantJobs(
      cvContext,
      [matching, nonMatching],
      embeddingProvider,
      ROLE_SIMILARITY_THRESHOLD,
    );

    expect(result.map((entry) => entry.job.id)).toEqual(["job-match"]);
  });

  it("carries each job's relevanceScore forward instead of collapsing it to pass/fail", async () => {
    const cvContext = buildCvContext({
      targetRole: "Backend Engineer",
      techStack: ["TypeScript", "Docker"],
      location: "Paris",
    });
    const strongMatch = buildJob({ id: "strong" });
    const familyMatch = buildJob({
      id: "family",
      title: "Développeur Backend H/F",
      description: "We use Ruby on Rails.",
    });

    const result = await filterRelevantJobs(
      cvContext,
      [familyMatch, strongMatch],
      embeddingProvider,
      ROLE_SIMILARITY_THRESHOLD,
    );

    expect(result).toEqual([
      { job: familyMatch, relevanceScore: 4 }, // family role match (2) + location (2)
      { job: strongMatch, relevanceScore: 8 }, // strong role match (4) + 2 tech (2) + location (2)
    ]);
  });
});
