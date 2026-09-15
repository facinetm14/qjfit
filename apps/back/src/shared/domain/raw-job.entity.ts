export interface RawJob {
  readonly source: string;
  readonly sourceJobId: string | null;
  readonly title: string;
  readonly company: string;
  readonly location: string;
  readonly description: string;
  readonly url: string;
  readonly publishedAt: Date | null;
  readonly raw: unknown;
}
