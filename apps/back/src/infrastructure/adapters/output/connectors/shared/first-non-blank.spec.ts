import { firstNonBlank } from "./first-non-blank.js";

describe("firstNonBlank", () => {
  it("returns the first candidate when it is non-blank", () => {
    expect(firstNonBlank(["Acme", "Other"], "Unknown")).toBe("Acme");
  });

  it("trims the chosen candidate", () => {
    expect(firstNonBlank(["  Acme  "], "Unknown")).toBe("Acme");
  });

  it("skips blank, whitespace-only, null, and undefined candidates", () => {
    expect(firstNonBlank(["", "   ", null, undefined, "Acme"], "Unknown")).toBe(
      "Acme",
    );
  });

  it("falls back when every candidate is blank", () => {
    expect(firstNonBlank(["", null, undefined], "Unknown")).toBe("Unknown");
  });

  it("falls back when there are no candidates", () => {
    expect(firstNonBlank([], "")).toBe("");
  });
});
