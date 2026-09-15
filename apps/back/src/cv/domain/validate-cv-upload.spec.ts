import { validateCvUpload } from "./validate-cv-upload.js";
import { CV_MAX_FILE_SIZE_BYTES } from "./cv-upload.entity.js";
import { UnsupportedCvFileTypeError } from "./errors/unsupported-cv-file-type.error.js";
import { CvFileTooLargeError } from "./errors/cv-file-too-large.error.js";

describe("validateCvUpload", () => {
  it("accepts a PDF within the size limit", () => {
    expect(() =>
      validateCvUpload({ mimeType: "application/pdf", sizeBytes: 1024 }),
    ).not.toThrow();
  });

  it("accepts a DOCX within the size limit", () => {
    expect(() =>
      validateCvUpload({
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sizeBytes: 1024,
      }),
    ).not.toThrow();
  });

  it("rejects an unsupported file type before checking size", () => {
    expect(() =>
      validateCvUpload({ mimeType: "image/png", sizeBytes: 10 }),
    ).toThrow(UnsupportedCvFileTypeError);
  });

  it("rejects a PDF over the 5MB limit", () => {
    expect(() =>
      validateCvUpload({
        mimeType: "application/pdf",
        sizeBytes: CV_MAX_FILE_SIZE_BYTES + 1,
      }),
    ).toThrow(CvFileTooLargeError);
  });

  it("accepts a file exactly at the 5MB limit", () => {
    expect(() =>
      validateCvUpload({
        mimeType: "application/pdf",
        sizeBytes: CV_MAX_FILE_SIZE_BYTES,
      }),
    ).not.toThrow();
  });
});
