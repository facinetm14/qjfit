export interface ScoreResult {
  readonly jobId: string;
  readonly score: number;
  readonly summary: string;
  readonly matchReasons: readonly string[];
  readonly missingSkills: readonly string[];
  readonly seniorityFit: string;
  readonly redFlags: readonly string[];
  readonly rawResponse: unknown;
}
