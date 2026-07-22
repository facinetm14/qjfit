import type { MatchedJob } from '../types/job.js';

const CSV_HEADER = [
  'title',
  'company',
  'location',
  'contract',
  'remote',
  'source',
  'score',
  'days_since_posted',
  'match_reasons',
  'missing_skills',
  'url'
];

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function jobsToCsv(jobs: readonly MatchedJob[]): string {
  const rows = jobs.map((job) => [
    job.title,
    job.company,
    job.location,
    job.contract,
    job.remote,
    job.source,
    String(job.score),
    String(job.daysAgo),
    job.reasons.join('; '),
    job.gaps.join('; '),
    job.url
  ]);

  return [CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
