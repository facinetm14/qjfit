import { extractCvContext } from "./extract-cv-context.js";

describe("extractCvContext", () => {
  it("extracts tech stack, contract type, seniority, location and target role from a French CV", () => {
    const text = `
      Jean Dupont
      Backend Developer

      Résumé: Ingénieur avec 5 ans d'expérience en développement backend.
      Basé à Lyon, ouvert au télétravail.

      Compétences: TypeScript, Node.js, PostgreSQL, Docker, Kubernetes.

      Recherche un poste en CDI, prétention salariale à partir de 45k€.
    `;

    const context = extractCvContext(text);

    expect(context.targetRole).toBe("Backend Developer");
    expect(context.techStack).toEqual(
      expect.arrayContaining(["TypeScript", "Node.js", "PostgreSQL", "Docker", "Kubernetes"]),
    );
    expect(context.contractTypes).toEqual(["CDI"]);
    expect(context.seniority).toEqual({ minYears: 5, maxYears: null });
    expect(context.location).toBe("Lyon");
    expect(context.salaryFloor).toBe(45000);
  });

  it("extracts a seniority range and freelance contract type from an English CV", () => {
    const text = `
      Senior Software Engineer

      8-10 years of experience building distributed systems.
      Location: Paris. Available for freelance work.

      Skills: Python, React, AWS, GraphQL.
    `;

    const context = extractCvContext(text);

    expect(context.targetRole).toBe("Senior Software Engineer");
    expect(context.seniority).toEqual({ minYears: 8, maxYears: 10 });
    expect(context.contractTypes).toEqual(["Freelance"]);
    expect(context.location).toBe("Paris");
    expect(context.techStack).toEqual(
      expect.arrayContaining(["Python", "React", "AWS", "GraphQL"]),
    );
  });

  it("returns nulls and empty arrays when nothing recognizable is present", () => {
    const context = extractCvContext("Lorem ipsum dolor sit amet.");

    expect(context).toEqual({
      targetRole: null,
      techStack: [],
      seniority: null,
      location: null,
      excludedKeywords: [],
      contractTypes: [],
      salaryFloor: null,
    });
  });

  it("deduplicates repeated tech stack mentions", () => {
    const context = extractCvContext("Python developer. Python, Python, Django, Python.");

    expect(context.techStack.filter((tech) => tech === "Python")).toHaveLength(1);
  });

  it("recognizes a stated French region as the location, alongside city keywords", () => {
    const context = extractCvContext(
      "Développeur Backend, mobile en Île-de-France pour la bonne opportunité.",
    );

    expect(context.location).toBe("Île-de-France");
  });

  it("prefers a stated city over a stated region when both appear", () => {
    const context = extractCvContext("Basé à Paris, en Île-de-France.");

    expect(context.location).toBe("Paris");
  });

  describe("explicit title-phrase matching (issue #24)", () => {
    it.each([
      "Fullstack Developer",
      "Full-Stack Developer",
      "Full Stack Engineer",
      "Backend Engineer",
      "Back-End Developer",
      "DevOps",
      "Dev-Ops Engineer",
      "Ingénieur Logiciel",
      "Product Owner",
      "Développeuse Frontend",
      "Chef de Produit",
      "Ingénieur DevOps",
    ])("returns the literal matched phrase %s verbatim, not a normalized label", (rawTitle) => {
      const context = extractCvContext(rawTitle);
      expect(context.targetRole).toBe(rawTitle);
    });

    it("returns only the matched phrase, not surrounding CV text", () => {
      const context = extractCvContext(
        "Curriculum Vitae\n\nSenior Backend Engineer\n\n5 years of experience.",
      );
      expect(context.targetRole).toBe("Senior Backend Engineer");
    });
  });

  describe("tech-stack fallback (issue #24)", () => {
    it("synthesizes a fallback title from the first detected tech-stack keyword when no title phrase is present", () => {
      const context = extractCvContext(
        "Compétences: Python, Django, PostgreSQL. 3 ans d'expérience en développement.",
      );

      expect(context.targetRole).toBe("Python Developer");
      expect(context.techStack).toEqual(
        expect.arrayContaining(["Python", "Django", "PostgreSQL"]),
      );
    });
  });

  describe("no title signal (issue #24)", () => {
    it("returns a null target role when neither a title phrase nor a tech-stack keyword is present", () => {
      const context = extractCvContext("Lorem ipsum dolor sit amet.");
      expect(context.targetRole).toBeNull();
    });
  });
});
