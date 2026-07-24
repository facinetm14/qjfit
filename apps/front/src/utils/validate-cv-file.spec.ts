import { describe, expect, it } from 'vitest';
import { CV_MAX_FILE_SIZE_BYTES, validateCvFile } from './validate-cv-file.js';

function buildFile(name: string, type: string, sizeBytes: number): File {
  return new File([new Uint8Array(sizeBytes)], name, { type });
}

describe('validateCvFile', () => {
  it('accepts a PDF within the size limit', () => {
    const file = buildFile('cv.pdf', 'application/pdf', 1024);
    expect(validateCvFile(file)).toEqual({ valid: true });
  });

  it('accepts a DOCX within the size limit', () => {
    const file = buildFile(
      'cv.docx',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      1024
    );
    expect(validateCvFile(file)).toEqual({ valid: true });
  });

  it('falls back to the file extension when the browser reports no mime type', () => {
    const file = buildFile('cv.pdf', '', 1024);
    expect(validateCvFile(file)).toEqual({ valid: true });
  });

  it('rejects an unsupported file type', () => {
    const file = buildFile('cv.exe', 'application/x-msdownload', 1024);
    expect(validateCvFile(file).valid).toBe(false);
  });

  it('rejects a file over the 5MB limit', () => {
    const file = buildFile('cv.pdf', 'application/pdf', CV_MAX_FILE_SIZE_BYTES + 1);
    expect(validateCvFile(file).valid).toBe(false);
  });

  it('accepts a file exactly at the 5MB limit', () => {
    const file = buildFile('cv.pdf', 'application/pdf', CV_MAX_FILE_SIZE_BYTES);
    expect(validateCvFile(file)).toEqual({ valid: true });
  });
});
