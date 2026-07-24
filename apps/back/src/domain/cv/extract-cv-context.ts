import type { ContractType } from "../shared/contract-type.js";
import type { CvContext, CvSeniorityRange } from "./cv-context.entity.js";

// Deterministic, keyword/regex-based heuristics — a cheap best-effort
// structuring of free-form CV text, not NLP. Accuracy is bounded by these
// lists; there is no LLM extraction step wired in yet (see issue #4 scope).

const TECH_STACK_KEYWORDS = [
  "TypeScript",
  "JavaScript",
  "Python",
  "Java",
  "Rust",
  "React",
  "Vue",
  "Angular",
  "Node.js",
  "Express",
  "NestJS",
  "PostgreSQL",
  "MySQL",
  "MongoDB",
  "Redis",
  "Docker",
  "Kubernetes",
  "AWS",
  "GCP",
  "Azure",
  "GraphQL",
  "Django",
  "Flask",
  "Ruby",
  "Swift",
  "Kotlin",
  "PHP",
] as const;

const ROLE_KEYWORDS = [
  "Full Stack Developer",
  "Backend Developer",
  "Frontend Developer",
  "Backend Engineer",
  "Frontend Engineer",
  "Software Engineer",
  "Data Scientist",
  "Data Engineer",
  "DevOps Engineer",
  "Product Manager",
  "Mobile Developer",
  "QA Engineer",
] as const;

const LOCATION_KEYWORDS = [
  "Paris",
  "Lyon",
  "Marseille",
  "Toulouse",
  "Bordeaux",
  "Lille",
  "Nantes",
  "Nice",
  "Strasbourg",
  "Rennes",
  "Montpellier",
  "Remote",
  "Télétravail",
] as const;

const CONTRACT_TYPE_PATTERNS: ReadonlyArray<{
  readonly type: ContractType;
  readonly pattern: RegExp;
}> = [
  { type: "CDI", pattern: /\bCDI\b/i },
  { type: "CDD", pattern: /\bCDD\b/i },
  { type: "Freelance", pattern: /\b(freelance|ind[ée]pendant)\b/i },
  { type: "Internship", pattern: /\b(internship|stage)\b/i },
  {
    type: "Apprenticeship",
    pattern: /\b(apprenticeship|alternance|apprentissage)\b/i,
  },
];

const SENIORITY_RANGE_PATTERN =
  /(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*years?\s*(?:of\s*)?experience/i;
const SENIORITY_FR_SINGLE_PATTERN =
  /(\d{1,2})\+?\s*ans\s*d['’]exp[ée]rience/i;
const SENIORITY_EN_SINGLE_PATTERN =
  /(\d{1,2})\+?\s*years?\s*(?:of\s*)?experience/i;

const SALARY_FLOOR_PATTERN = /(\d{2,3})\s*[kK]\s*€/;

const EXCLUDED_KEYWORDS_PATTERN =
  /(?:excluding|except|not interested in)\s*:?\s*([^.\n]+)/i;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findKeywordMatches(
  text: string,
  keywords: readonly string[],
): string[] {
  return keywords.filter((keyword) =>
    new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text),
  );
}

function findFirstKeyword(
  text: string,
  keywords: readonly string[],
): string | null {
  return (
    keywords.find((keyword) =>
      new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text),
    ) ?? null
  );
}

function extractSeniority(text: string): CvSeniorityRange | null {
  const range = SENIORITY_RANGE_PATTERN.exec(text);
  if (range) {
    return { minYears: Number(range[1]), maxYears: Number(range[2]) };
  }

  const frSingle = SENIORITY_FR_SINGLE_PATTERN.exec(text);
  if (frSingle) {
    return { minYears: Number(frSingle[1]), maxYears: null };
  }

  const enSingle = SENIORITY_EN_SINGLE_PATTERN.exec(text);
  if (enSingle) {
    return { minYears: Number(enSingle[1]), maxYears: null };
  }

  return null;
}

function extractContractTypes(text: string): ContractType[] {
  return CONTRACT_TYPE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(
    ({ type }) => type,
  );
}

function extractSalaryFloor(text: string): number | null {
  const match = SALARY_FLOOR_PATTERN.exec(text);
  return match ? Number(match[1]) * 1000 : null;
}

function extractExcludedKeywords(text: string): string[] {
  const match = EXCLUDED_KEYWORDS_PATTERN.exec(text);
  if (!match?.[1]) {
    return [];
  }
  return match[1]
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

export function extractCvContext(text: string): CvContext {
  return {
    targetRole: findFirstKeyword(text, ROLE_KEYWORDS),
    techStack: findKeywordMatches(text, TECH_STACK_KEYWORDS),
    seniority: extractSeniority(text),
    location: findFirstKeyword(text, LOCATION_KEYWORDS),
    excludedKeywords: extractExcludedKeywords(text),
    contractTypes: extractContractTypes(text),
    salaryFloor: extractSalaryFloor(text),
  };
}
