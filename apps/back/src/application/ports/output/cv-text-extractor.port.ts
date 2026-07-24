export interface CvFile {
  readonly buffer: Buffer;
  readonly mimeType: string;
}

export interface CvTextExtractorPort {
  extract(file: CvFile): Promise<string>;
}
