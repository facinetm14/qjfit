import { parseDate } from "./parse-date.js";

describe("parseDate", () => {
  it("parses a valid ISO date string", () => {
    const result = parseDate("2026-05-01T10:00:00.000Z");

    expect(result).toEqual(new Date("2026-05-01T10:00:00.000Z"));
  });

  it("returns null for undefined", () => {
    expect(parseDate(undefined)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parseDate(null)).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseDate("")).toBeNull();
  });

  it("returns null for an unparseable string", () => {
    expect(parseDate("not-a-date")).toBeNull();
  });
});
