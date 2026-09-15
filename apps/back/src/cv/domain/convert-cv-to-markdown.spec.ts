import {
  anonymizeMarkdownCv,
  buildAnonymizedMarkdownCv,
  convertCvTextToMarkdown,
} from "./convert-cv-to-markdown.js";

describe("convertCvTextToMarkdown", () => {
  it("converts an ALL-CAPS standalone line into a markdown heading", () => {
    const text = "EXPERIENCE\n\nSenior Backend Engineer at Acme Corp";

    const markdown = convertCvTextToMarkdown(text);

    expect(markdown).toContain("## EXPERIENCE");
    expect(markdown).toContain("Senior Backend Engineer at Acme Corp");
  });

  it("converts a French ALL-CAPS heading (accented uppercase) too", () => {
    const text = "COMPÉTENCES\n\nTypeScript, Node.js";

    const markdown = convertCvTextToMarkdown(text);

    expect(markdown).toContain("## COMPÉTENCES");
  });

  it("does not treat a mixed-case line (e.g. a name or job title) as a heading", () => {
    const text = "Jean Dupont\nBackend Developer";

    const markdown = convertCvTextToMarkdown(text);

    expect(markdown).not.toMatch(/^## /m);
    expect(markdown).toContain("Jean Dupont");
    expect(markdown).toContain("Backend Developer");
  });

  it("converts bullet characters (•, -, *) into markdown list items", () => {
    const text = [
      "SKILLS",
      "",
      "• TypeScript, Node.js",
      "- PostgreSQL, Docker",
      "* Kubernetes",
    ].join("\n");

    const markdown = convertCvTextToMarkdown(text);

    expect(markdown).toContain("- TypeScript, Node.js");
    expect(markdown).toContain("- PostgreSQL, Docker");
    expect(markdown).toContain("- Kubernetes");
  });

  it("normalizes a numbered-list marker like '1)' to markdown's '1.' form", () => {
    const text = "1) Led a team of 4 engineers\n2) Migrated to microservices";

    const markdown = convertCvTextToMarkdown(text);

    expect(markdown).toContain("1. Led a team of 4 engineers");
    expect(markdown).toContain("2. Migrated to microservices");
  });

  it("preserves paragraph breaks between blocks and collapses repeated blank lines", () => {
    const text = "EXPERIENCE\n\n\n\nSenior Engineer\n\nEDUCATION\n\nMSc Computer Science";

    const markdown = convertCvTextToMarkdown(text);

    expect(markdown).toBe(
      ["## EXPERIENCE", "", "Senior Engineer", "", "## EDUCATION", "", "MSc Computer Science"].join(
        "\n",
      ),
    );
  });
});

describe("anonymizeMarkdownCv", () => {
  it("strips email addresses", () => {
    const markdown = "Contact: jean.dupont@example.com";

    expect(anonymizeMarkdownCv(markdown)).not.toContain("jean.dupont@example.com");
    expect(anonymizeMarkdownCv(markdown)).not.toContain("@");
  });

  it("strips French phone numbers in common formats", () => {
    const spaced = anonymizeMarkdownCv("Tel: 06 12 34 56 78");
    const dotted = anonymizeMarkdownCv("Tel: 01.23.45.67.89");
    const international = anonymizeMarkdownCv("Tel: +33 6 12 34 56 78");

    expect(spaced).not.toMatch(/\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}/);
    expect(dotted).not.toMatch(/\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}[\s.]?\d{2}/);
    expect(international).not.toContain("6 12 34 56 78");
  });

  it("strips URLs (http(s) and bare www.)", () => {
    const withScheme = anonymizeMarkdownCv("Portfolio: https://linkedin.com/in/jeandupont");
    const bareWww = anonymizeMarkdownCv("Site: www.jeandupont.dev");

    expect(withScheme).not.toContain("https://linkedin.com/in/jeandupont");
    expect(bareWww).not.toContain("www.jeandupont.dev");
  });

  it("drops a contact line entirely once every token on it has been stripped, leaving no stray separators", () => {
    const markdown = "Jean Dupont\n\njean.dupont@example.com | 06 12 34 56 78 | https://linkedin.com/in/jeandupont\n\nEXPERIENCE";

    const result = anonymizeMarkdownCv(markdown);

    expect(result).not.toContain("|");
    expect(result).toContain("Jean Dupont");
    expect(result).toContain("EXPERIENCE");
  });

  it("leaves unrelated content untouched", () => {
    const markdown = "## EXPERIENCE\n\n- Built a payments platform processing 10k transactions/day";

    expect(anonymizeMarkdownCv(markdown)).toBe(markdown);
  });
});

describe("buildAnonymizedMarkdownCv", () => {
  it("structures the CV into markdown and strips PII in one pass", () => {
    const text = [
      "Jean Dupont",
      "Backend Developer",
      "",
      "jean.dupont@example.com | +33 6 12 34 56 78 | https://linkedin.com/in/jeandupont",
      "",
      "EXPERIENCE",
      "",
      "Senior Backend Engineer at Acme Corp",
      "- Built a payments platform processing 10k transactions/day",
      "- Led a team of 4 engineers",
      "",
      "SKILLS",
      "",
      "- TypeScript, Node.js, PostgreSQL",
      "- Docker, Kubernetes",
    ].join("\n");

    const result = buildAnonymizedMarkdownCv(text);

    expect(result).toContain("## EXPERIENCE");
    expect(result).toContain("## SKILLS");
    expect(result).toContain("- Built a payments platform processing 10k transactions/day");
    expect(result).toContain("- TypeScript, Node.js, PostgreSQL");
    expect(result).not.toContain("jean.dupont@example.com");
    expect(result).not.toContain("linkedin.com/in/jeandupont");
    expect(result).not.toMatch(/\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}[\s.]\d{2}/);
  });
});
