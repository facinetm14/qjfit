import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchMatchTicket, submitCvMatch } from './match-api-client.js';
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

describe('submitCvMatch', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('posts the CV as multipart form data to /api/match', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(202, { ticketId: 'ticket-1', remaining: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await submitCvMatch(pdfFile());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/api/match');
    expect(init.method).toBe('POST');
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get('cv')).toBeInstanceOf(File);
  });

  it('returns an accepted result on 2xx', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(202, { ticketId: 'ticket-1', remaining: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitCvMatch(pdfFile());

    expect(result).toEqual({ kind: 'accepted', response: { ticketId: 'ticket-1', remaining: 1 } });
  });

  it('returns a rate-limited result on 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(429, { error: 'Too many requests today.', resetAt: '2026-07-25T00:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitCvMatch(pdfFile());

    expect(result).toEqual({
      kind: 'rate-limited',
      response: { error: 'Too many requests today.', resetAt: '2026-07-25T00:00:00.000Z' }
    });
  });

  it('returns an error result with the server message on another non-OK status', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(500, { error: 'scoring provider unavailable' }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitCvMatch(pdfFile());

    expect(result).toEqual({ kind: 'error', message: 'scoring provider unavailable' });
  });

  it('falls back to a generic error message when the error body cannot be parsed', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error('not json');
      }
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await submitCvMatch(pdfFile());

    expect(result).toEqual({ kind: 'error', message: 'Unable to submit your CV. Please try again.' });
  });
});

describe('fetchMatchTicket', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('requests the ticket by id', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { id: 'ticket-1', status: 'pending', createdAt: '2026-07-24T10:00:00.000Z' }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchMatchTicket('ticket-1');

    expect(fetchMock).toHaveBeenCalledWith('/api/match/ticket-1');
  });

  it('returns an ok result with the ticket on 200', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(200, {
        id: 'ticket-1',
        status: 'completed',
        createdAt: '2026-07-24T10:00:00.000Z',
        results: [scoredJobFixture()]
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMatchTicket('ticket-1');

    expect(result.kind).toBe('ok');
    expect(result).toMatchObject({ ticket: { id: 'ticket-1', status: 'completed' } });
  });

  it('returns a not-found result on 404', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(404, {}));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMatchTicket('ticket-1');

    expect(result).toEqual({ kind: 'not-found' });
  });

  it('returns an error result on another non-OK status', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(500, {}));
    vi.stubGlobal('fetch', fetchMock);

    const result = await fetchMatchTicket('ticket-1');

    expect(result).toEqual({ kind: 'error' });
  });
});
