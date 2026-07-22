import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useTicker } from './useTicker.js';

describe('useTicker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reveals lines one at a time and marks earlier lines done', async () => {
    const { visible, start } = useTicker(['first', 'second']);
    start();

    expect(visible.value).toEqual([{ text: 'first', done: false }]);

    await vi.advanceTimersByTimeAsync(480);
    expect(visible.value).toEqual([
      { text: 'first', done: true },
      { text: 'second', done: false }
    ]);
  });

  it('sets complete and invokes the callback after the final delay', async () => {
    const { complete, start } = useTicker(['only']);
    const onComplete = vi.fn();
    start(onComplete);

    await vi.advanceTimersByTimeAsync(480);
    expect(complete.value).toBe(true);
    expect(onComplete).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(500);
    expect(onComplete).toHaveBeenCalledOnce();
  });
});
