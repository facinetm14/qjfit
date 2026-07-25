import { parseScoreResult } from "./validate-score-result.js";

function buildValidRaw(overrides: Record<string, unknown> = {}): unknown {
  return {
    jobId: "job-1",
    score: 82,
    summary: "Senior Python role at a fintech scale-up.",
    matchReasons: ["FastAPI", "PostgreSQL"],
    missingSkills: ["Kubernetes"],
    seniorityFit: "good",
    redFlags: [],
    rawResponse: { raw: true },
    ...overrides,
  };
}

describe("parseScoreResult", () => {
  it("parses a well-formed batch-response item into a ScoreResult", () => {
    const result = parseScoreResult(buildValidRaw());

    expect(result).toEqual({
      jobId: "job-1",
      score: 82,
      summary: "Senior Python role at a fintech scale-up.",
      matchReasons: ["FastAPI", "PostgreSQL"],
      missingSkills: ["Kubernetes"],
      seniorityFit: "good",
      redFlags: [],
      rawResponse: { raw: true },
    });
  });

  it("defaults rawResponse to the raw item when the field is absent", () => {
    const raw = buildValidRaw();
    delete (raw as Record<string, unknown>).rawResponse;

    const result = parseScoreResult(raw);

    expect(result?.rawResponse).toEqual(raw);
  });

  it.each([
    ["missing jobId", { jobId: undefined }],
    ["missing score", { score: undefined }],
    ["score above 100", { score: 101 }],
    ["score below 0", { score: -1 }],
    ["non-numeric score", { score: "82" }],
    ["missing summary", { summary: undefined }],
    ["matchReasons not an array", { matchReasons: "FastAPI" }],
    ["matchReasons with a non-string entry", { matchReasons: [1, 2] }],
    ["missing seniorityFit", { seniorityFit: undefined }],
    ["redFlags not an array", { redFlags: "none" }],
  ])("returns null for a malformed item (%s)", (_label, overrides) => {
    expect(parseScoreResult(buildValidRaw(overrides))).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(parseScoreResult("not an object")).toBeNull();
    expect(parseScoreResult(null)).toBeNull();
    expect(parseScoreResult(undefined)).toBeNull();
    expect(parseScoreResult(42)).toBeNull();
  });
});
