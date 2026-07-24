import { CvTextExtractorAdapter } from "./cv-text-extractor.adapter.js";
import type { CvFile, CvTextExtractorPort } from "../../../../application/ports/output/cv-text-extractor.port.js";

class FakeExtractor implements CvTextExtractorPort {
  constructor(private readonly text: string) {}

  async extract(): Promise<string> {
    return this.text;
  }
}

describe("CvTextExtractorAdapter", () => {
  it("dispatches PDF files to the PDF extractor", async () => {
    const adapter = new CvTextExtractorAdapter(
      new FakeExtractor("pdf text"),
      new FakeExtractor("docx text"),
    );

    const file: CvFile = { buffer: Buffer.from(""), mimeType: "application/pdf" };

    await expect(adapter.extract(file)).resolves.toBe("pdf text");
  });

  it("dispatches DOCX files to the DOCX extractor", async () => {
    const adapter = new CvTextExtractorAdapter(
      new FakeExtractor("pdf text"),
      new FakeExtractor("docx text"),
    );

    const file: CvFile = {
      buffer: Buffer.from(""),
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };

    await expect(adapter.extract(file)).resolves.toBe("docx text");
  });
});
