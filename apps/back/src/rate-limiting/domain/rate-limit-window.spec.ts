import { msUntilNextMidnightUtc, toCalendarDateKey } from "./rate-limit-window.js";

describe("toCalendarDateKey", () => {
  it("returns the UTC calendar date for a timestamp just before midnight", () => {
    expect(toCalendarDateKey(new Date("2026-07-24T23:59:59.999Z"))).toBe(
      "2026-07-24",
    );
  });

  it("rolls over to the next calendar date right at midnight UTC", () => {
    expect(toCalendarDateKey(new Date("2026-07-25T00:00:00.000Z"))).toBe(
      "2026-07-25",
    );
  });
});

describe("msUntilNextMidnightUtc", () => {
  it("returns 1 second when one second remains before midnight", () => {
    const now = new Date("2026-07-24T23:59:59.000Z");
    expect(msUntilNextMidnightUtc(now)).toBe(1000);
  });

  it("returns a full day when called exactly at midnight", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");
    expect(msUntilNextMidnightUtc(now)).toBe(24 * 60 * 60 * 1000);
  });

  it("returns a partial day when called mid-afternoon", () => {
    const now = new Date("2026-07-24T18:00:00.000Z");
    expect(msUntilNextMidnightUtc(now)).toBe(6 * 60 * 60 * 1000);
  });
});
