export class CvFileTooLargeError extends Error {
  constructor(
    public readonly sizeBytes: number,
    public readonly maxSizeBytes: number,
  ) {
    super(`CV file is too large: ${sizeBytes} bytes (max ${maxSizeBytes} bytes).`);
    this.name = "CvFileTooLargeError";
  }
}
