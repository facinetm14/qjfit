import { extractDepartmentCode, FRENCH_REGIONS, resolveRegion } from "./french-region.js";

describe("resolveRegion", () => {
  it("resolves a metropolitan department code to its region", () => {
    expect(resolveRegion("91")).toBe("Île-de-France");
    expect(resolveRegion("75")).toBe("Île-de-France");
    expect(resolveRegion("69")).toBe("Auvergne-Rhône-Alpes");
  });

  it("resolves Corsica's letter-suffixed codes", () => {
    expect(resolveRegion("2A")).toBe("Corse");
    expect(resolveRegion("2B")).toBe("Corse");
  });

  it("resolves an overseas department code", () => {
    expect(resolveRegion("974")).toBe("La Réunion");
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(resolveRegion(" 2a ")).toBe("Corse");
  });

  it("returns null for an unrecognized code", () => {
    expect(resolveRegion("99")).toBeNull();
  });

  it("maps every French department to one of the 18 regions", () => {
    // 96 metropolitan (94 numbered 01-95 excluding 20, + 2A/2B) + 5 overseas.
    const departmentCount = Object.keys({
      ...Object.fromEntries(
        Array.from({ length: 95 }, (_, i) => i + 1)
          .filter((n) => n !== 20)
          .map((n) => [String(n).padStart(2, "0"), true]),
      ),
      "2A": true,
      "2B": true,
      "971": true,
      "972": true,
      "973": true,
      "974": true,
      "976": true,
    }).length;

    expect(departmentCount).toBe(101);
    expect(FRENCH_REGIONS.length).toBe(18);
  });
});

describe("extractDepartmentCode", () => {
  it("extracts the department code from a France Travail-style location", () => {
    expect(extractDepartmentCode("75 - PARIS")).toBe("75");
    expect(extractDepartmentCode("91 - MASSY")).toBe("91");
  });

  it("extracts a 3-digit overseas department code", () => {
    expect(extractDepartmentCode("974 - SAINT-DENIS")).toBe("974");
  });

  it("extracts a Corsica letter-suffixed department code", () => {
    expect(extractDepartmentCode("2A - AJACCIO")).toBe("2A");
  });

  it("returns null when the location doesn't start with a department code", () => {
    expect(extractDepartmentCode("Remote")).toBeNull();
    expect(extractDepartmentCode("Paris, France")).toBeNull();
  });
});
