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

    expect(context.targetRole).toBe("Software Engineer");
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

  describe("role spacing/hyphenation variants", () => {
    it.each([
      ["Fullstack Developer", "Full Stack Developer"],
      ["Full-Stack Developer", "Full Stack Developer"],
      ["Full Stack Engineer", "Full Stack Developer"],
      ["Backend Engineer", "Backend Engineer"],
      ["Back-End Developer", "Backend Developer"],
      ["DevOps", "DevOps Engineer"],
      ["Dev-Ops Engineer", "DevOps Engineer"],
      ["Ingénieur Logiciel", "Software Engineer"],
      ["Product Owner", "Product Manager"],
    ])("resolves %s to the canonical role %s", (rawTitle, expectedRole) => {
      const context = extractCvContext(rawTitle);
      expect(context.targetRole).toBe(expectedRole);
    });
  });
});
