import { describe, expect, it } from 'vitest';
import { formatCountdown, msUntilMidnight } from './countdown.js';

describe('msUntilMidnight', () => {
  it('returns the exact remaining milliseconds until local midnight', () => {
    const now = new Date(2026, 6, 22, 23, 30, 0, 0);
    expect(msUntilMidnight(now)).toBe(30 * 60 * 1000);
  });

  it('returns a full day when called exactly at midnight', () => {
    const now = new Date(2026, 6, 22, 0, 0, 0, 0);
    expect(msUntilMidnight(now)).toBe(24 * 60 * 60 * 1000);
  });
});

describe('formatCountdown', () => {
  it('formats hours and zero-padded minutes', () => {
    expect(formatCountdown(2 * 3600000 + 5 * 60000)).toBe('resets in 2h 05m');
  });

  it('formats a countdown under an hour', () => {
    expect(formatCountdown(9 * 60000)).toBe('resets in 0h 09m');
  });

  it('floors partial minutes', () => {
    expect(formatCountdown(59_999)).toBe('resets in 0h 00m');
  });
});
