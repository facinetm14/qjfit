export class UnsupportedCvFileTypeError extends Error {
  constructor(public readonly mimeType: string) {
    super(
      `Unsupported CV file type: ${mimeType}. Only PDF and DOCX are accepted.`,
    );
    this.name = "UnsupportedCvFileTypeError";
  }
}
