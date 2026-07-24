import { computeRelevanceScore, filterRelevantJobs } from "./relevance-filter.js";
import type { CvContext } from "../cv/cv-context.entity.js";
import type { Job } from "../jobs/job.entity.js";

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

describe("computeRelevanceScore", () => {
  describe("role gate", () => {
    it("zeroes the score when the job title doesn't indicate the same broad role family, regardless of other overlap", () => {
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

      expect(computeRelevanceScore(cvContext, unrelatedJob)).toBe(0);
    });

    it("zeroes a job whose title only shares the generic word \"ingénieur\"/\"engineer\" from a different discipline", () => {
      const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
      // Bare "ingénieur"/"engineer" spans every engineering discipline in
      // French job titles (pharmacology, mechanical, civil, ...) — it must
      // not be treated as a software-role-family indicator on its own.
      const pharmaJob = buildJob({ title: "Ingénieur d'Étude en Pharmacologie des Récepteurs" });

      expect(computeRelevanceScore(cvContext, pharmaJob)).toBe(0);
    });

    it("does not gate when the CV states no target role", () => {
      const cvContext = buildCvContext({ techStack: ["TypeScript"] });
      const job = buildJob({ title: "Hospitality Officer H/F" });

      expect(computeRelevanceScore(cvContext, job)).toBeGreaterThan(0);
    });

    it("awards the strong-match weight when the exact target role appears in the title", () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer" });
      const job = buildJob({ title: "Backend Engineer" });

      expect(computeRelevanceScore(cvContext, job)).toBe(4);
    });

    it("awards the (smaller) family-match weight for a same-family title that isn't an exact match", () => {
      const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
      const job = buildJob({ title: "Développeur Java Angular H/F", description: "desc" });

      expect(computeRelevanceScore(cvContext, job)).toBe(2);
    });
  });

  describe("location gate", () => {
    it("zeroes the score when a stated physical location doesn't overlap, even with a role match", () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Marseille" });
      const job = buildJob({ title: "Backend Engineer", location: "Paris" });

      expect(computeRelevanceScore(cvContext, job)).toBe(0);
    });

    it("does not gate on a remote-work preference, since a job's location field is never literally \"Remote\"", () => {
      const cvContext = buildCvContext({ targetRole: "Backend Engineer", location: "Remote" });
      const job = buildJob({ title: "Backend Engineer", location: "Paris" });

      expect(computeRelevanceScore(cvContext, job)).toBeGreaterThan(0);
    });

    it("awards the location weight when it overlaps, case-insensitively", () => {
      const cvContext = buildCvContext({ location: "paris" });
      const job = buildJob({ location: "Paris, France" });

      expect(computeRelevanceScore(cvContext, job)).toBe(2);
    });
  });

  describe("tech stack and contract type", () => {
    it("counts one point per tech stack keyword found in the job description", () => {
      const cvContext = buildCvContext({
        techStack: ["TypeScript", "Docker", "Python"],
      });
      const job = buildJob();

      expect(computeRelevanceScore(cvContext, job)).toBe(2);
    });

    it("counts a point when the job's contract type is among the CV's stated contract types", () => {
      const cvContext = buildCvContext({ contractTypes: ["CDI", "Freelance"] });
      const job = buildJob({ contractType: "CDI" });

      expect(computeRelevanceScore(cvContext, job)).toBe(1);
    });

    it("does not award a contract-type point when the CV states no preference", () => {
      const cvContext = buildCvContext({ contractTypes: [] });
      const job = buildJob({ contractType: "CDI" });

      expect(computeRelevanceScore(cvContext, job)).toBe(0);
    });

    it("never awards a contract-type point today, since every job is currently mapped to contractType \"Other\"", () => {
      const cvContext = buildCvContext({ contractTypes: ["CDI"] });
      const job = buildJob({ contractType: "Other" });

      expect(computeRelevanceScore(cvContext, job)).toBe(0);
    });
  });

  it("sums weighted signals across all dimensions once the gates are cleared", () => {
    const cvContext = buildCvContext({
      targetRole: "Backend Engineer",
      techStack: ["TypeScript", "Docker"],
      location: "Paris",
      contractTypes: ["CDI"],
    });
    const job = buildJob();

    // 2 tech-stack matches (2*1) + strong role match (4) + location (2) + contract type (1)
    expect(computeRelevanceScore(cvContext, job)).toBe(9);
  });
});

describe("filterRelevantJobs", () => {
  it("excludes jobs that don't clear the relevance gates", () => {
    const cvContext = buildCvContext({ targetRole: "Full Stack Developer" });
    const matching = buildJob({ id: "job-match", title: "Développeur Full Stack" });
    const nonMatching = buildJob({ id: "job-no-match", title: "Hospitality Officer H/F" });

    const result = filterRelevantJobs(cvContext, [matching, nonMatching]);

    expect(result.map((entry) => entry.job.id)).toEqual(["job-match"]);
  });

  it("carries each job's relevanceScore forward instead of collapsing it to pass/fail", () => {
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

    const result = filterRelevantJobs(cvContext, [familyMatch, strongMatch]);

    expect(result).toEqual([
      { job: familyMatch, relevanceScore: 4 }, // family role match (2) + location (2)
      { job: strongMatch, relevanceScore: 8 }, // strong role match (4) + 2 tech (2) + location (2)
    ]);
  });
});
