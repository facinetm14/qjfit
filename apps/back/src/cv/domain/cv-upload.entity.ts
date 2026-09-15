export const CV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const CV_ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

export type CvMimeType = (typeof CV_ACCEPTED_MIME_TYPES)[number];

export interface CvUpload {
  readonly mimeType: string;
  readonly sizeBytes: number;
}

export function isCvMimeType(mimeType: string): mimeType is CvMimeType {
  return (CV_ACCEPTED_MIME_TYPES as readonly string[]).includes(mimeType);
}
