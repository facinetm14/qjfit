import { inject, injectable } from "inversify";
import type {
  CvFile,
  CvTextExtractorPort,
} from "@cv/application/ports/cv-text-extractor.port.js";
import { TYPES } from "@composition-root/container/types.js";
import { CV_ACCEPTED_MIME_TYPES } from "@cv/domain/cv-upload.entity.js";

@injectable()
export class CvTextExtractorAdapter implements CvTextExtractorPort {
  constructor(
    @inject(TYPES.PdfCvTextExtractor)
    private readonly pdfExtractor: CvTextExtractorPort,
    @inject(TYPES.DocxCvTextExtractor)
    private readonly docxExtractor: CvTextExtractorPort,
  ) {}

  async extract(file: CvFile): Promise<string> {
    if (file.mimeType === CV_ACCEPTED_MIME_TYPES[0]) {
      return this.pdfExtractor.extract(file);
    }
    return this.docxExtractor.extract(file);
  }
}
