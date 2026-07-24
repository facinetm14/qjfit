// Mirrors apps/back/src/domain/cv/cv-upload.entity.ts — the backend is the
// source of truth (and still validates server-side), this only lets the
// visitor fail fast before uploading.
export const CV_MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export const CV_ACCEPTED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const;

export interface CvFileValidation {
  readonly valid: boolean;
  readonly error?: string;
}

function hasAcceptedExtension(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.endsWith('.pdf') || lower.endsWith('.docx');
}

export function validateCvFile(file: File): CvFileValidation {
  const hasAcceptedType = (CV_ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  if (!hasAcceptedType && !hasAcceptedExtension(file.name)) {
    return { valid: false, error: 'Only PDF or DOCX files are accepted.' };
  }

  if (file.size > CV_MAX_FILE_SIZE_BYTES) {
    return { valid: false, error: 'File exceeds the 5 MB limit.' };
  }

  return { valid: true };
}
