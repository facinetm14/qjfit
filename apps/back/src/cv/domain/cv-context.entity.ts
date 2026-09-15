import type { ContractType } from "@shared/domain/contract-type.js";

export interface CvSeniorityRange {
  readonly minYears: number;
  readonly maxYears: number | null;
}

export interface CvContext {
  readonly targetRole: string | null;
  readonly hasExplicitTargetRole: boolean;
  readonly techStack: readonly string[];
  readonly seniority: CvSeniorityRange | null;
  readonly location: string | null;
  readonly excludedKeywords: readonly string[];
  readonly contractTypes: readonly ContractType[];
  readonly salaryFloor: number | null;
}
