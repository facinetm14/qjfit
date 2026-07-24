import { describe, expect, it } from 'vitest';
import { formatCountdown, msUntil } from './countdown.js';

describe('msUntil', () => {
  it('returns the exact remaining milliseconds until the target', () => {
    const now = new Date('2026-07-22T23:30:00.000Z');
    const target = new Date('2026-07-23T00:00:00.000Z');
    expect(msUntil(target, now)).toBe(30 * 60 * 1000);
  });

  it('returns zero once the target has already passed', () => {
    const now = new Date('2026-07-23T00:05:00.000Z');
    const target = new Date('2026-07-23T00:00:00.000Z');
    expect(msUntil(target, now)).toBe(0);
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
