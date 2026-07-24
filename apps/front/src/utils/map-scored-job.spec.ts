import { describe, expect, it } from 'vitest';
import { toMatchedJob } from './map-scored-job.js';
import type { ApiScoredJob } from '../types/match-api.js';

function buildScoredJob(overrides: Partial<ApiScoredJob> = {}): ApiScoredJob {
  return {
    job: {
      id: 'job-1',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Paris',
      contractType: 'CDI',
      remotePolicy: 'Full',
      description: 'Full job description text.',
      url: 'https://example.com/job-1',
      source: 'france-travail',
      sourceJobId: 'FT-1',
      dedupKey: 'dedup-1',
      fetchedAt: '2026-07-20T00:00:00.000Z'
    },
    score: 82,
    summary: 'Strong match on stack and seniority.',
    matchReasons: ['FastAPI', 'PostgreSQL'],
    missingSkills: ['Kubernetes'],
    seniorityFit: 'good',
    redFlags: [],
    rankingScore: 71.4,
    ...overrides
  };
}

describe('toMatchedJob', () => {
  it('maps the API-shaped scored job onto the UI-shaped MatchedJob', () => {
    const now = new Date('2026-07-24T00:00:00.000Z');
    const result = toMatchedJob(buildScoredJob(), now);

    expect(result).toEqual({
      id: 'job-1',
      title: 'Backend Engineer',
      company: 'Acme',
      location: 'Paris',
      contract: 'CDI',
      remote: 'Full',
      source: 'france-travail',
      score: 82,
      daysAgo: 4,
      summary: 'Strong match on stack and seniority.',
      reasons: ['FastAPI', 'PostgreSQL'],
      gaps: ['Kubernetes'],
      full: 'Full job description text.',
      url: 'https://example.com/job-1'
    });
  });

  it('floors partial days and never goes negative', () => {
    const now = new Date('2026-07-20T10:00:00.000Z');
    const result = toMatchedJob(
      buildScoredJob({ job: { ...buildScoredJob().job, fetchedAt: '2026-07-20T09:00:00.000Z' } }),
      now
    );

    expect(result.daysAgo).toBe(0);
  });
});
