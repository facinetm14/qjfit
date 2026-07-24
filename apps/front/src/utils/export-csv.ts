import { remotePolicyLabel, sourceLabel, type MatchedJob } from '../types/job.js';

const HEADERS = [
  'Score',
  'Title',
  'Company',
  'Location',
  'Contract',
  'Remote',
  'Source',
  'Days Since Posted',
  'Match Reasons',
  'Missing Skills',
  'Summary',
  'URL'
];

function csvEscape(value: string | number): string {
  const str = String(value);
  return /[",\r\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function jobToRow(job: MatchedJob): string[] {
  return [
    String(job.score),
    job.title,
    job.company,
    job.location,
    job.contract,
    remotePolicyLabel(job.remote),
    sourceLabel(job.source),
    String(job.daysAgo),
    job.reasons.join('; '),
    job.gaps.join('; '),
    job.summary,
    job.url
  ];
}

export function jobsToCsv(jobs: readonly MatchedJob[]): string {
  const rows = [HEADERS, ...jobs.map(jobToRow)];
  return rows.map((row) => row.map(csvEscape).join(',')).join('\r\n');
}
