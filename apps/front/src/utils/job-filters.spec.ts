import { describe, expect, it } from 'vitest';
import { filterAndSortJobs, type JobFilters } from './job-filters.js';
import type { MatchedJob } from '../types/job.js';

function buildJob(overrides: Partial<MatchedJob> = {}): MatchedJob {
  return {
    id: 'job-1',
    title: 'Backend Engineer',
    company: 'Acme',
    location: 'Paris',
    contract: 'CDI',
    remote: 'Full',
    source: 'wttj-rss',
    score: 80,
    daysAgo: 2,
    summary: 'Great fit',
    reasons: [],
    gaps: [],
    full: '',
    url: '#',
    ...overrides
  };
}

const baseFilters: JobFilters = {
  minScore: 0,
  sources: ['france-travail', 'wttj-rss'],
  contracts: ['CDI', 'CDD', 'Freelance', 'Internship', 'Apprenticeship', 'Other'],
  remotePolicies: ['Full', 'Hybrid', 'OnSite'],
  sortOrder: 'score'
};

describe('filterAndSortJobs', () => {
  it('excludes jobs scoring below the minimum threshold', () => {
    const jobs = [buildJob({ id: '1', score: 90 }), buildJob({ id: '2', score: 40 })];
    const result = filterAndSortJobs(jobs, { ...baseFilters, minScore: 50 });
    expect(result.map((j) => j.id)).toEqual(['1']);
  });

  it('excludes jobs whose source is not selected', () => {
    const jobs = [buildJob({ id: '1', source: 'wttj-rss' }), buildJob({ id: '2', source: 'france-travail' })];
    const result = filterAndSortJobs(jobs, { ...baseFilters, sources: ['wttj-rss'] });
    expect(result.map((j) => j.id)).toEqual(['1']);
  });

  it('excludes jobs whose contract type is not selected', () => {
    const jobs = [buildJob({ id: '1', contract: 'CDI' }), buildJob({ id: '2', contract: 'Freelance' })];
    const result = filterAndSortJobs(jobs, { ...baseFilters, contracts: ['CDI'] });
    expect(result.map((j) => j.id)).toEqual(['1']);
  });

  it('excludes jobs whose remote policy is not selected', () => {
    const jobs = [buildJob({ id: '1', remote: 'Full' }), buildJob({ id: '2', remote: 'OnSite' })];
    const result = filterAndSortJobs(jobs, { ...baseFilters, remotePolicies: ['Full'] });
    expect(result.map((j) => j.id)).toEqual(['1']);
  });

  it('never filters out a job with an unknown remote policy, even when no chip is selected', () => {
    const jobs = [buildJob({ id: '1', remote: 'Unknown' }), buildJob({ id: '2', remote: 'OnSite' })];
    const result = filterAndSortJobs(jobs, { ...baseFilters, remotePolicies: ['Full'] });
    expect(result.map((j) => j.id)).toEqual(['1']);
  });

  it('sorts by score descending by default', () => {
    const jobs = [buildJob({ id: '1', score: 60 }), buildJob({ id: '2', score: 90 }), buildJob({ id: '3', score: 75 })];
    const result = filterAndSortJobs(jobs, baseFilters);
    expect(result.map((j) => j.id)).toEqual(['2', '3', '1']);
  });

  it('sorts by most recent first when sortOrder is date', () => {
    const jobs = [buildJob({ id: '1', daysAgo: 5 }), buildJob({ id: '2', daysAgo: 0 }), buildJob({ id: '3', daysAgo: 2 })];
    const result = filterAndSortJobs(jobs, { ...baseFilters, sortOrder: 'date' });
    expect(result.map((j) => j.id)).toEqual(['2', '3', '1']);
  });
});
