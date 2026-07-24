import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useCountdown } from './useCountdown.js';

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('formats the time remaining until the given target as soon as it starts', () => {
    vi.setSystemTime(new Date('2026-07-24T22:00:00.000Z'));
    const { label, start } = useCountdown();

    start(new Date('2026-07-25T00:00:00.000Z'));

    expect(label.value).toBe('resets in 2h 00m');
  });

  it('ticks the label down as time passes', () => {
    vi.setSystemTime(new Date('2026-07-24T22:00:00.000Z'));
    const { label, start } = useCountdown();
    start(new Date('2026-07-25T00:00:00.000Z'));

    vi.advanceTimersByTime(60 * 60 * 1000);

    expect(label.value).toBe('resets in 1h 00m');
  });

  it('restarting with a new target resets the countdown', () => {
    vi.setSystemTime(new Date('2026-07-24T22:00:00.000Z'));
    const { label, start } = useCountdown();
    start(new Date('2026-07-25T00:00:00.000Z'));

    start(new Date('2026-07-24T22:30:00.000Z'));

    expect(label.value).toBe('resets in 0h 30m');
  });
});
