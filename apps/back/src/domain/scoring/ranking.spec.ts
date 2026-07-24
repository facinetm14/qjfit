import { DEFAULT_DECAY_DAYS, computeRankingScore, daysSince } from "./ranking.js";

describe("daysSince", () => {
  it("returns 0 for the same instant", () => {
    const now = new Date("2026-07-24T00:00:00.000Z");
    expect(daysSince(now, now)).toBe(0);
  });

  it("returns whole days elapsed", () => {
    const from = new Date("2026-07-10T00:00:00.000Z");
    const now = new Date("2026-07-24T00:00:00.000Z");
    expect(daysSince(from, now)).toBe(14);
  });
});

describe("computeRankingScore", () => {
  it("returns the raw score with no decay when posted today", () => {
    expect(computeRankingScore(80, 0)).toBeCloseTo(80);
  });

  it("decays the score by exp(-daysSincePosted / decayDays)", () => {
    const score = 80;
    const daysSincePosted = 14;
    const expected = 80 * Math.exp(-14 / DEFAULT_DECAY_DAYS);

    expect(computeRankingScore(score, daysSincePosted)).toBeCloseTo(expected);
  });

  it("accepts a configurable decayDays", () => {
    const score = 100;
    const daysSincePosted = 7;
    const decayDays = 7;
    const expected = 100 * Math.exp(-7 / 7);

    expect(computeRankingScore(score, daysSincePosted, decayDays)).toBeCloseTo(
      expected,
    );
  });

  it("decays more for older postings than newer ones", () => {
    const older = computeRankingScore(80, 30);
    const newer = computeRankingScore(80, 1);

    expect(newer).toBeGreaterThan(older);
  });
});
