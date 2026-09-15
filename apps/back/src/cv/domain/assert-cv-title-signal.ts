import type { CvContext } from "./cv-context.entity.js";
import { CvTitleSignalMissingError } from "./errors/cv-title-signal-missing.error.js";

// A job title is a required input to fetching/scoring (ADR 0021) — a CV that
// yields neither an explicit title phrase nor a tech-stack fallback (see
// extractCvContext) must reject the match request outright instead of
// silently falling back to an unscoped search.
export function assertCvHasTitleSignal(cvContext: CvContext): void {
  if (!cvContext.targetRole) {
    throw new CvTitleSignalMissingError();
  }
}
