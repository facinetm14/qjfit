import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createMatchFlow } from './useMatchFlow.js';

describe('createMatchFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts on the upload panel with a full quota and no file', () => {
    const flow = createMatchFlow();
    expect(flow.panel.value).toBe('upload');
    expect(flow.checksLeft.value).toBe(2);
    expect(flow.selectedFile.value).toBeNull();
  });

  it('does nothing when running a check without a selected file', async () => {
    const flow = createMatchFlow();
    await flow.runCheck();
    expect(flow.panel.value).toBe('upload');
  });

  it('moves through scanning to results and decrements the quota', async () => {
    const flow = createMatchFlow();
    flow.selectFile(new File(['cv'], 'cv.pdf'));

    const run = flow.runCheck();
    expect(flow.panel.value).toBe('scanning');
    expect(flow.checksLeft.value).toBe(1);

    await vi.advanceTimersByTimeAsync(3000);
    await run;

    expect(flow.panel.value).toBe('results');
    expect(flow.results.value.length).toBeGreaterThan(0);
  });

  it('routes to the limited panel once the daily quota is exhausted', async () => {
    const flow = createMatchFlow();

    flow.selectFile(new File(['cv'], 'cv.pdf'));
    let run = flow.runCheck();
    await vi.advanceTimersByTimeAsync(3000);
    await run;

    flow.selectFile(new File(['cv'], 'cv.pdf'));
    run = flow.runCheck();
    await vi.advanceTimersByTimeAsync(3000);
    await run;

    expect(flow.checksLeft.value).toBe(0);

    flow.selectFile(new File(['cv'], 'cv.pdf'));
    await flow.runCheck();
    expect(flow.panel.value).toBe('limited');
  });

  it('reset returns to the initial upload state', async () => {
    const flow = createMatchFlow();
    flow.selectFile(new File(['cv'], 'cv.pdf'));
    const run = flow.runCheck();
    await vi.advanceTimersByTimeAsync(3000);
    await run;

    flow.reset();

    expect(flow.panel.value).toBe('upload');
    expect(flow.checksLeft.value).toBe(2);
    expect(flow.selectedFile.value).toBeNull();
    expect(flow.results.value).toEqual([]);
  });
});
