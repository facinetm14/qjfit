import { injectable } from "inversify";
import mammoth from "mammoth";
import type {
  CvFile,
  CvTextExtractorPort,
} from "../../../../application/ports/output/cv-text-extractor.port.js";

@injectable()
export class DocxCvTextExtractorAdapter implements CvTextExtractorPort {
  async extract(file: CvFile): Promise<string> {
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value;
  }
}
