// Deterministic, heuristic plain-text-to-markdown structuring — no LLM call
// (issue #15). There is no reliable off-the-shelf "plain text to markdown"
// library (unlike pdf-parse/mammoth for binary format extraction: plain
// text carries no structural markup to parse, only conventions), so this is
// a small hand-written, fully-tested heuristic in the same spirit as
// extract-cv-context.ts's keyword/regex extraction — cheap best-effort
// structuring of free-form CV text, not NLP.

// A resume section header ("EXPERIENCE", "SKILLS", "COMPÉTENCES", ...) is
// reliably ALL CAPS and stands alone on its own line, preceded by a blank
// line (or the start of the document). Requiring both the ALL-CAPS shape
// and standalone position avoids misclassifying an inline all-caps company
// name (e.g. "Senior Engineer at ACME CORP") as a section heading.
const HEADING_PATTERN = /^[\p{Lu}\p{N}\s&,.'-]+$/u;
const HEADING_MAX_LENGTH = 40;

const BULLET_PATTERN = /^[-*•●▪◦]\s+(.*)$/;
const NUMBERED_ITEM_PATTERN = /^(\d+)[.)]\s+(.*)$/;

function isHeading(line: string): boolean {
  return (
    line.length <= HEADING_MAX_LENGTH &&
    HEADING_PATTERN.test(line) &&
    /\p{Lu}/u.test(line)
  );
}

function formatLine(line: string, standalone: boolean): string {
  const bulletMatch = BULLET_PATTERN.exec(line);
  if (bulletMatch) {
    return `- ${bulletMatch[1]}`;
  }

  const numberedMatch = NUMBERED_ITEM_PATTERN.exec(line);
  if (numberedMatch) {
    return `${numberedMatch[1]}. ${numberedMatch[2]}`;
  }

  if (standalone && isHeading(line)) {
    return `## ${line}`;
  }

  return line;
}

/**
 * Structures already-extracted plain CV text into markdown: ALL-CAPS
 * standalone lines become headings, bullet/numbered lines become markdown
 * list items, and paragraph breaks are preserved (repeated blank lines
 * collapse to one).
 */
export function convertCvTextToMarkdown(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim());
  const output: string[] = [];
  let blankPending = false;
  let standalone = true;

  for (const line of lines) {
    if (line.length === 0) {
      blankPending = output.length > 0;
      standalone = true;
      continue;
    }

    if (blankPending) {
      output.push("");
      blankPending = false;
    }

    output.push(formatLine(line, standalone));
    standalone = false;
  }

  return output.join("\n");
}

// Reliably pattern-detectable, carry no matching signal for scoring — a
// cheap data-minimization win. Name/address anonymization is out of scope
// (needs NER/LLM assistance); see PRD §3.1's disclosure for what remains.
const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)\S+/gi;
// French phone numbers: +33/0 followed by a non-zero digit, then four
// groups of two digits, each optionally separated by a space/dot/dash —
// covers "06 12 34 56 78", "01.23.45.67.89", "+33 6 12 34 56 78".
const FRENCH_PHONE_PATTERN = /(?:\+33[\s.-]?|0)[1-9](?:[\s.-]?\d{2}){4}/g;

// After stripping a token, a contact line like "email | phone | url" can
// collapse to bare separator noise ("|  |") — drop the whole line rather
// than leave that behind.
const SEPARATOR_ONLY_PATTERN = /^[\s|,\-:•●▪◦]*$/;

function stripPii(line: string): string {
  return line
    .replace(EMAIL_PATTERN, "")
    .replace(URL_PATTERN, "")
    .replace(FRENCH_PHONE_PATTERN, "");
}

/**
 * Strips email addresses, phone numbers, and URLs from already-converted
 * markdown. Blank lines are preserved verbatim; a line that becomes nothing
 * but separator noise once its PII is removed is dropped entirely.
 */
export function anonymizeMarkdownCv(markdown: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];

  for (const line of lines) {
    if (line.trim().length === 0) {
      result.push(line);
      continue;
    }

    const cleaned = stripPii(line)
      .replace(/[ \t]+/g, " ")
      .trim()
      .replace(/^\|\s*/, "")
      .replace(/\s*\|$/, "");

    if (SEPARATOR_ONLY_PATTERN.test(cleaned)) {
      continue;
    }

    result.push(cleaned);
  }

  return result.join("\n");
}

/** Composes structuring and anonymization into the scoring input (issue #15). */
export function buildAnonymizedMarkdownCv(text: string): string {
  return anonymizeMarkdownCv(convertCvTextToMarkdown(text));
}
