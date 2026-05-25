export interface NormalizedJobInput {
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly contractType: string;
  readonly remotePolicy: string;
  readonly description: string;
  readonly url: string;
  readonly source: string;
  readonly sourceJobId: string | null;
  readonly dedupKey: string;
  readonly fetchedAt: Date;
}
