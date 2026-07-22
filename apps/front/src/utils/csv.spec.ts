import { describe, expect, it } from 'vitest';
import { jobsToCsv } from './csv.js';
import type { MatchedJob } from '../types/job.js';

function buildJob(overrides: Partial<MatchedJob> = {}): MatchedJob {
  return {
    id: 1,
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Paris',
    contract: 'CDI',
    remote: 'Full',
    source: 'WTTJ',
    score: 88,
    daysAgo: 2,
    summary: 'Great fit',
    reasons: ['Python', 'FastAPI'],
    gaps: ['Kubernetes'],
    full: 'Full brief',
    url: 'https://example.com/job/1',
    ...overrides
  };
}

describe('jobsToCsv', () => {
  it('emits a header row followed by one row per job', () => {
    const csv = jobsToCsv([buildJob(), buildJob({ id: 2, title: 'Frontend Engineer' })]);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe(
      '"title","company","location","contract","remote","source","score","days_since_posted","match_reasons","missing_skills","url"'
    );
  });

  it('joins reasons and gaps with a semicolon', () => {
    const csv = jobsToCsv([buildJob()]);
    expect(csv).toContain('"Python; FastAPI"');
    expect(csv).toContain('"Kubernetes"');
  });

  it('escapes embedded double quotes by doubling them', () => {
    const csv = jobsToCsv([buildJob({ title: 'Senior "Staff" Engineer' })]);
    expect(csv).toContain('"Senior ""Staff"" Engineer"');
  });

  it('returns only the header row for an empty job list', () => {
    const csv = jobsToCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});
