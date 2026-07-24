import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createMatchFlow } from './useMatchFlow.js';
import type { ApiScoredJob } from '../types/match-api.js';

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body
  };
}

function pdfFile(): File {
  return new File(['%PDF-1.4 fake cv'], 'cv.pdf', { type: 'application/pdf' });
}

function scoredJobFixture(overrides: Partial<ApiScoredJob> = {}): ApiScoredJob {
  return {
    job: {
      id: 'job-1',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Paris',
      contractType: 'CDI',
      remotePolicy: 'Full',
      description: 'Full description',
      url: 'https://example.com/job-1',
      source: 'france-travail',
      sourceJobId: 'FT-1',
      dedupKey: 'dedup-1',
      fetchedAt: '2026-07-20T00:00:00.000Z'
    },
    score: 88,
    summary: 'Great match',
    matchReasons: ['Python'],
    missingSkills: [],
    seniorityFit: 'good',
    redFlags: [],
    rankingScore: 80,
    ...overrides
  };
}

const POLL_INTERVAL_MS = 2000;

describe('createMatchFlow', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts on the upload panel with no file selected', () => {
    const flow = createMatchFlow();
    expect(flow.panel.value).toBe('upload');
    expect(flow.selectedFile.value).toBeNull();
    expect(flow.fileError.value).toBeNull();
  });

  it('does nothing when running a check without a selected file', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const flow = createMatchFlow();

    await flow.runCheck();

    expect(flow.panel.value).toBe('upload');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('flags an oversized or wrong-type file at selection time and blocks submission', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const flow = createMatchFlow();

    flow.selectFile(new File(['x'], 'cv.exe', { type: 'application/x-msdownload' }));
    expect(flow.fileError.value).toBeTruthy();

    await flow.runCheck();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(flow.panel.value).toBe('upload');
  });

  it('polls the ticket until it completes, then renders ranked results and updates the remaining count', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(202, { ticketId: 'ticket-1', remaining: 1 }))
      .mockResolvedValueOnce(
        jsonResponse(200, { id: 'ticket-1', status: 'pending', createdAt: '2026-07-24T10:00:00.000Z' })
      )
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'ticket-1',
          status: 'completed',
          createdAt: '2026-07-24T10:00:00.000Z',
          results: [scoredJobFixture()]
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const flow = createMatchFlow();
    flow.selectFile(pdfFile());

    const run = flow.runCheck();
    expect(flow.panel.value).toBe('scanning');

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await run;

    expect(flow.panel.value).toBe('results');
    expect(flow.checksLeft.value).toBe(1);
    expect(flow.results.value).toHaveLength(1);
    expect(flow.results.value[0]).toMatchObject({ id: 'job-1', score: 88, title: 'Backend Engineer' });
    expect(fetchMock).toHaveBeenCalledWith('/api/match/ticket-1');
  });

  it('routes to the limited panel with the reset time once the daily quota is exhausted', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(429, { error: 'Too many requests today.', resetAt: '2026-07-25T00:00:00.000Z' })
      );
    vi.stubGlobal('fetch', fetchMock);

    const flow = createMatchFlow();
    flow.selectFile(pdfFile());
    await flow.runCheck();

    expect(flow.panel.value).toBe('limited');
    expect(flow.checksLeft.value).toBe(0);
    expect(flow.resetAt.value).toEqual(new Date('2026-07-25T00:00:00.000Z'));
  });

  it('shows an error state when the ticket ultimately fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(202, { ticketId: 'ticket-1', remaining: 1 }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'ticket-1',
          status: 'failed',
          createdAt: '2026-07-24T10:00:00.000Z',
          error: 'scoring provider unavailable'
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const flow = createMatchFlow();
    flow.selectFile(pdfFile());
    await flow.runCheck();

    expect(flow.panel.value).toBe('error');
    expect(flow.errorMessage.value).toBe('scoring provider unavailable');
  });

  it('reset returns to the initial upload state', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(202, { ticketId: 'ticket-1', remaining: 1 }))
      .mockResolvedValueOnce(
        jsonResponse(200, {
          id: 'ticket-1',
          status: 'completed',
          createdAt: '2026-07-24T10:00:00.000Z',
          results: [scoredJobFixture()]
        })
      );
    vi.stubGlobal('fetch', fetchMock);

    const flow = createMatchFlow();
    flow.selectFile(pdfFile());
    await flow.runCheck();

    flow.reset();

    expect(flow.panel.value).toBe('upload');
    expect(flow.selectedFile.value).toBeNull();
    expect(flow.results.value).toEqual([]);
  });
});
