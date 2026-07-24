import type { Container } from "inversify";
import { PdfCvTextExtractorAdapter } from "../../adapters/output/cv-parsing/pdf-cv-text-extractor.adapter.js";
import { DocxCvTextExtractorAdapter } from "../../adapters/output/cv-parsing/docx-cv-text-extractor.adapter.js";
import { CvTextExtractorAdapter } from "../../adapters/output/cv-parsing/cv-text-extractor.adapter.js";
import { TYPES } from "../types.js";

export function bindCvParsing(container: Container): void {
  container
    .bind(TYPES.PdfCvTextExtractorOptions)
    .toConstantValue({});

  container
    .bind(TYPES.PdfCvTextExtractor)
    .to(PdfCvTextExtractorAdapter)
    .inSingletonScope();

  container
    .bind(TYPES.DocxCvTextExtractor)
    .to(DocxCvTextExtractorAdapter)
    .inSingletonScope();

  container
    .bind(TYPES.CvTextExtractor)
    .to(CvTextExtractorAdapter)
    .inSingletonScope();
}
