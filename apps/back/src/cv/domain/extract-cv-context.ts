import type { ContractType } from "@shared/domain/contract-type.js";
import { FRENCH_REGIONS } from "@shared/domain/french-region.js";
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

// Broadened free-text role-noun matching (issue #24), replacing the former
// fixed 12-label English enum above: this returns the literal matched phrase
// from the CV text, not a normalized label, so the output tracks whatever
// real-world spelling/wording the CV used (EN or FR) rather than collapsing
// distinct titles ("Senior Backend Engineer", "Lead Backend Engineer") into
// one canonical string. A qualifier (seniority/specialty word) may appear
// before and/or after the role noun; up to two leading qualifiers are
// tolerated ("Senior Full Stack Developer") since a single one is common but
// not universal. Matching genuine title synonyms beyond this heuristic is
// the real LLM scoring step's job (PRD §3.4 step 3), not this deterministic
// pre-filter.
const QUALIFIER_FRAGMENTS = [
  "senior",
  "junior",
  "principal",
  "staff",
  "lead",
  "full[\\s-]?stack",
  "front[\\s-]?end",
  "back[\\s-]?end",
  "mobile",
  "dev[\\s-]?ops",
  "cloud",
  "platform",
  "data",
  "product",
  "technical",
  "software",
  "web",
  "site\\s+reliability",
  "sre",
  "qa",
  "security",
  "embedded",
  "confirm[ée]e?",
  "d[ée]butant(?:e)?",
  "donn[ée]es",
  "logiciel",
  "produit",
  "technique",
  "s[ée]curit[ée]",
  "qualit[ée]",
  "infrastructure",
  "r[ée]seau",
  "syst[èe]mes?",
] as const;

// French "développeur"/"développeuse" is spelled with a double "p" and an
// accented "é" — it does not share a stem with English "developer", so both
// spellings are matched as separate alternatives rather than one shared
// prefix.
const NOUN_FRAGMENTS = [
  "develop(?:er)",
  "d[ée]velopp(?:eur|euse)",
  "engineers?",
  "ing[ée]nieur(?:e)?s?",
  "scientists?",
  "scientifiques?",
  "analysts?",
  "analystes?",
  "architects?",
  "architectes?",
  "designers?",
  "concepteurs?",
  "conceptrices?",
  "consultants?",
  "consultantes?",
  "administrators?",
  "administrateurs?",
  "administratrices?",
  "managers?",
  "directors?",
  "directeurs?",
  "directrices?",
  "specialists?",
  "sp[ée]cialistes?",
  "responsables?",
  "owners?",
  "chefs?\\s+de\\s+produits?",
  "chefs?\\s+de\\s+projets?",
  "dev[\\s-]?ops",
] as const;

const QUALIFIER_ALTERNATION = QUALIFIER_FRAGMENTS.join("|");
const NOUN_ALTERNATION = NOUN_FRAGMENTS.join("|");

// `\b` is ASCII-only and would fail a boundary check next to an accented
// letter (see keywordRegex below) — `\p{L}\p{N}` lookarounds stay
// Unicode-aware so this matches consistently for accented FR role nouns too.
const TITLE_PHRASE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:(?:${QUALIFIER_ALTERNATION})[\\s-]+){0,2}(?:${NOUN_ALTERNATION})(?:[\\s-]+(?:${QUALIFIER_ALTERNATION}))?(?![\\p{L}\\p{N}])`,
  "iu",
);

// City keywords take priority over region keywords below (findFirstKeyword
// returns the first array match) — a CV stating a specific city is more
// precise than a region-wide preference, and city-level gating is already a
// subset of region-level resolution (same department -> same region).
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
  ...FRENCH_REGIONS,
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

// Plain `\b` relies on `\w`, which is ASCII-only — it fails to find a
// boundary before/after an accented letter (e.g. the "Î" in
// "Île-de-France"), silently rejecting a true match. `\p{L}`/`\p{N}` with
// the `u` flag are Unicode-aware, so this matches consistently regardless
// of whether the keyword starts with an ASCII or accented character.
function keywordRegex(keyword: string): RegExp {
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(keyword)}(?![\\p{L}\\p{N}])`,
    "iu",
  );
}

function findKeywordMatches(
  text: string,
  keywords: readonly string[],
): string[] {
  return keywords.filter((keyword) => keywordRegex(keyword).test(text));
}

function findFirstKeyword(
  text: string,
  keywords: readonly string[],
): string | null {
  return keywords.find((keyword) => keywordRegex(keyword).test(text)) ?? null;
}

function findExplicitTitlePhrase(text: string): string | null {
  return TITLE_PHRASE_PATTERN.exec(text)?.[0] ?? null;
}

// Low-confidence fallback (issue #24): when the CV states no recognizable
// title phrase but does list tech-stack keywords, synthesize a search term
// from the first-detected one rather than leaving targetRole null — the
// alternative is hard-failing the match request even though the CV carries
// a usable (if weaker) signal for what role the visitor wants.
function synthesizeFallbackTitle(techStack: readonly string[]): string | null {
  const [primary] = techStack;
  return primary ? `${primary} Developer` : null;
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
  const techStack = findKeywordMatches(text, TECH_STACK_KEYWORDS);
  const targetRole = findExplicitTitlePhrase(text) ?? synthesizeFallbackTitle(techStack);

  return {
    targetRole,
    techStack,
    seniority: extractSeniority(text),
    location: findFirstKeyword(text, LOCATION_KEYWORDS),
    excludedKeywords: extractExcludedKeywords(text),
    contractTypes: extractContractTypes(text),
    salaryFloor: extractSalaryFloor(text),
  };
}
