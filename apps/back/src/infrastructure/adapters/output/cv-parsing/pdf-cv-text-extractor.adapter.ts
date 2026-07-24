import { inject, injectable } from "inversify";
import { PDFParse } from "pdf-parse";
import type {
  CvFile,
  CvTextExtractorPort,
} from "../../../../application/ports/output/cv-text-extractor.port.js";
import { TYPES } from "../../../container/types.js";

export interface PdfTextDocument {
  getText(): Promise<{ text: string }>;
  destroy(): Promise<void>;
}

export interface PdfCvTextExtractorOptions {
  readonly createDocument?: (data: Buffer) => PdfTextDocument;
}

function defaultCreateDocument(data: Buffer): PdfTextDocument {
  return new PDFParse({ data });
}

@injectable()
export class PdfCvTextExtractorAdapter implements CvTextExtractorPort {
  constructor(
    @inject(TYPES.PdfCvTextExtractorOptions)
    private readonly options: PdfCvTextExtractorOptions = {},
  ) {}

  async extract(file: CvFile): Promise<string> {
    const createDocument = this.options.createDocument ?? defaultCreateDocument;
    const document = createDocument(file.buffer);
    try {
      const result = await document.getText();
      return result.text;
    } finally {
      await document.destroy();
    }
  }
}
