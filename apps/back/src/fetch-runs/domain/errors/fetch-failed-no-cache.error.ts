export class FetchFailedWithNoCacheError extends Error {
  constructor(public readonly querySignature: string) {
    super(
      "Couldn't refresh the job pool for this search and there's no previous result to fall back on. Please try again shortly.",
    );
    this.name = "FetchFailedWithNoCacheError";
  }
}
