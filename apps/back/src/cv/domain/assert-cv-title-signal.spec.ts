import { assertCvHasTitleSignal } from "./assert-cv-title-signal.js";
import { CvTitleSignalMissingError } from "./errors/cv-title-signal-missing.error.js";
import type { CvContext } from "./cv-context.entity.js";

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

describe("assertCvHasTitleSignal", () => {
  it("accepts a CV context with a target role", () => {
    expect(() =>
      assertCvHasTitleSignal(buildCvContext({ targetRole: "Backend Developer" })),
    ).not.toThrow();
  });

  it("accepts a CV context with a tech-stack-derived fallback target role", () => {
    expect(() =>
      assertCvHasTitleSignal(buildCvContext({ targetRole: "Python Developer" })),
    ).not.toThrow();
  });

  it("rejects a CV context with no target role", () => {
    expect(() => assertCvHasTitleSignal(buildCvContext({ targetRole: null }))).toThrow(
      CvTitleSignalMissingError,
    );
  });
});
