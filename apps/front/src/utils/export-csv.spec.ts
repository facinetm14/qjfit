import { describe, expect, it } from 'vitest';
import { jobsToCsv } from './export-csv.js';
import type { MatchedJob } from '../types/job.js';

function buildJob(overrides: Partial<MatchedJob> = {}): MatchedJob {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Paris',
    contract: 'CDI',
    remote: 'Full',
    source: 'france-travail',
    score: 82,
    daysAgo: 2,
    summary: 'Great fit',
    reasons: ['FastAPI'],
    gaps: ['Kubernetes'],
    full: 'Full description',
    url: 'https://example.com/job-1',
    ...overrides
  };
}

describe('jobsToCsv', () => {
  it('produces a header row plus one row per job', () => {
    const csv = jobsToCsv([buildJob()]);
    const lines = csv.split('\r\n');

    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(
      'Score,Title,Company,Location,Contract,Remote,Source,Days Since Posted,Match Reasons,Missing Skills,Summary,URL'
    );
    expect(lines[1]).toBe(
      '82,Backend Engineer,Acme,Paris,CDI,Full remote,France Travail,2,FastAPI,Kubernetes,Great fit,https://example.com/job-1'
    );
  });

  it('joins multiple match reasons and missing skills with a semicolon', () => {
    const csv = jobsToCsv([buildJob({ reasons: ['FastAPI', 'PostgreSQL'], gaps: ['Kubernetes', 'Go'] })]);
    const [, row] = csv.split('\r\n');

    expect(row).toContain('FastAPI; PostgreSQL');
    expect(row).toContain('Kubernetes; Go');
  });

  it('quotes and escapes fields containing commas or quotes', () => {
    const csv = jobsToCsv([buildJob({ summary: 'Great fit, "highly" recommended' })]);
    const [, row] = csv.split('\r\n');

    expect(row).toContain('"Great fit, ""highly"" recommended"');
  });

  it('returns only the header row for an empty result set', () => {
    const csv = jobsToCsv([]);
    expect(csv.split('\r\n')).toHaveLength(1);
  });
});
