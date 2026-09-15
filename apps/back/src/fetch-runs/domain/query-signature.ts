import type { ContractType } from "@shared/domain/contract-type.js";
import type { CvSeniorityRange } from "@cv/domain/cv-context.entity.js";

// ADR 0021 §2: a coarse, non-identifying key derived from the CV context a
// visitor uploaded — job title (required) plus optional mobility/experience
// band/contract type. Used to scope fetch freshness/locking per query rather
// than to one shared clock (see ADR 0021's rejected-alternative discussion).
export interface QuerySignatureInput {
  readonly targetRole: string;
  readonly location: string | null;
  readonly seniority: CvSeniorityRange | null;
  readonly contractTypes: readonly ContractType[];
}

export type ExperienceBand = "junior" | "mid" | "senior";

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

// A local bucketing for cache-key grouping only — not the France Travail
// `experience` param mapping, which ADR 0021 explicitly leaves unresolved
// pending clarification of what its 5 codes mean.
function bandFromSeniority(
  seniority: CvSeniorityRange | null,
): ExperienceBand | null {
  if (!seniority) {
    return null;
  }
  if (seniority.minYears <= 2) {
    return "junior";
  }
  if (seniority.minYears <= 5) {
    return "mid";
  }
  return "senior";
}

export function buildQuerySignature(input: QuerySignatureInput): string {
  const band = bandFromSeniority(input.seniority);
  const contractTypes = [...input.contractTypes].sort();

  const parts = [
    `title:${normalize(input.targetRole)}`,
    input.location ? `mobility:${normalize(input.location)}` : null,
    band ? `exp:${band}` : null,
    contractTypes.length > 0
      ? `contract:${contractTypes.map(normalize).join(",")}`
      : null,
  ].filter((part): part is string => part !== null);

  return parts.join("|");
}
