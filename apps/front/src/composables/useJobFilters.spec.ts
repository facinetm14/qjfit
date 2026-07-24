import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
import { useJobFilters } from './useJobFilters.js';
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
    summary: '',
    reasons: [],
    gaps: [],
    full: '',
    url: '#',
    ...overrides
  };
}

describe('useJobFilters', () => {
  it('includes all jobs by default', () => {
    const jobs = ref<MatchedJob[]>([buildJob({ id: '1' }), buildJob({ id: '2', source: 'france-travail' })]);
    const { filteredJobs } = useJobFilters(jobs);
    expect(filteredJobs.value.map((j) => j.id)).toEqual(['1', '2']);
  });

  it('toggleSource removes a source from the active set and re-filters reactively', () => {
    const jobs = ref<MatchedJob[]>([buildJob({ id: '1', source: 'wttj-rss' }), buildJob({ id: '2', source: 'france-travail' })]);
    const { filteredJobs, toggleSource } = useJobFilters(jobs);

    toggleSource('france-travail');

    expect(filteredJobs.value.map((j) => j.id)).toEqual(['1']);
  });

  it('toggleContract and toggleRemote can be toggled back on', () => {
    const jobs = ref<MatchedJob[]>([buildJob({ id: '1', contract: 'CDD', remote: 'OnSite' })]);
    const { filteredJobs, toggleContract, toggleRemote } = useJobFilters(jobs);

    toggleContract('CDD');
    toggleRemote('OnSite');
    expect(filteredJobs.value).toEqual([]);

    toggleContract('CDD');
    toggleRemote('OnSite');
    expect(filteredJobs.value.map((j) => j.id)).toEqual(['1']);
  });

  it('minScore filters out low scores reactively', () => {
    const jobs = ref<MatchedJob[]>([buildJob({ id: '1', score: 90 }), buildJob({ id: '2', score: 30 })]);
    const { filteredJobs, minScore } = useJobFilters(jobs);

    minScore.value = 50;

    expect(filteredJobs.value.map((j) => j.id)).toEqual(['1']);
  });
});
