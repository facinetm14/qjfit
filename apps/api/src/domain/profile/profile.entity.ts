export interface Profile {
  readonly id: string;
  readonly targetRole: string;
  readonly targetCompanyIndustry: readonly string[];
  readonly techStack: readonly string[];
  readonly seniorityMin: number;
  readonly seniorityMax: number;
  readonly location: string;
  readonly excludedKeywords: readonly string[];
  readonly contractTypes: readonly ContractType[];
  readonly salaryMin: number | null;
  readonly bio: string | null;
  readonly availability: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type ContractType =
  | "CDI"
  | "CDD"
  | "Freelance"
  | "Internship"
  | "Apprenticeship"
  | "Other";

export interface UpsertProfileInput {
  readonly targetRole: string;
  readonly targetCompanyIndustry: readonly string[];
  readonly techStack: readonly string[];
  readonly seniorityMin: number;
  readonly seniorityMax: number;
  readonly location: string;
  readonly excludedKeywords: readonly string[];
  readonly contractTypes: readonly ContractType[];
  readonly salaryMin: number | null;
  readonly bio: string | null;
  readonly availability: Date | null;
}
