import { buildQuerySignature } from "./query-signature.js";

describe("buildQuerySignature", () => {
  it("derives a signature from the title alone when nothing else is present", () => {
    const signature = buildQuerySignature({
      targetRole: "Backend Developer",
      location: null,
      seniority: null,
      contractTypes: [],
    });

    expect(signature).toBe("title:backend-developer");
  });

  it("includes mobility, experience band, and contract type when present", () => {
    const signature = buildQuerySignature({
      targetRole: "Backend Developer",
      location: "Paris",
      seniority: { minYears: 6, maxYears: null },
      contractTypes: ["CDI"],
    });

    expect(signature).toBe(
      "title:backend-developer|mobility:paris|exp:senior|contract:cdi",
    );
  });

  it("buckets a low year count as junior", () => {
    const signature = buildQuerySignature({
      targetRole: "Backend Developer",
      location: null,
      seniority: { minYears: 1, maxYears: 2 },
      contractTypes: [],
    });

    expect(signature).toBe("title:backend-developer|exp:junior");
  });

  it("buckets a mid year count as mid", () => {
    const signature = buildQuerySignature({
      targetRole: "Backend Developer",
      location: null,
      seniority: { minYears: 4, maxYears: 5 },
      contractTypes: [],
    });

    expect(signature).toBe("title:backend-developer|exp:mid");
  });

  it("normalizes case and whitespace so equivalent CVs collide onto one signature", () => {
    const signature = buildQuerySignature({
      targetRole: "  Senior Backend Engineer  ",
      location: "Île-de-France",
      seniority: null,
      contractTypes: [],
    });

    expect(signature).toBe(
      "title:senior-backend-engineer|mobility:île-de-france",
    );
  });

  it("sorts and dedups multiple contract types for a stable key", () => {
    const signatureA = buildQuerySignature({
      targetRole: "Backend Developer",
      location: null,
      seniority: null,
      contractTypes: ["Freelance", "CDI"],
    });
    const signatureB = buildQuerySignature({
      targetRole: "Backend Developer",
      location: null,
      seniority: null,
      contractTypes: ["CDI", "Freelance"],
    });

    expect(signatureA).toBe(signatureB);
  });
});
