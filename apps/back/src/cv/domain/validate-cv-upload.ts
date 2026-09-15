import { CV_MAX_FILE_SIZE_BYTES, isCvMimeType, type CvUpload } from "./cv-upload.entity.js";
import { UnsupportedCvFileTypeError } from "./errors/unsupported-cv-file-type.error.js";
import { CvFileTooLargeError } from "./errors/cv-file-too-large.error.js";

export function validateCvUpload(upload: CvUpload): void {
  if (!isCvMimeType(upload.mimeType)) {
    throw new UnsupportedCvFileTypeError(upload.mimeType);
  }
  if (upload.sizeBytes > CV_MAX_FILE_SIZE_BYTES) {
    throw new CvFileTooLargeError(upload.sizeBytes, CV_MAX_FILE_SIZE_BYTES);
  }
}
