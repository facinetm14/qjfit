import fs from "node:fs";
import path from "node:path";
import { DocxCvTextExtractorAdapter } from "./docx-cv-text-extractor.adapter.js";

const fixturesDir = path.resolve(
  process.cwd(),
  "src",
  "infrastructure",
  "adapters",
  "output",
  "cv-parsing",
  "fixtures",
);

describe("DocxCvTextExtractorAdapter", () => {
  it("extracts text from a DOCX file's document.xml", async () => {
    const buffer = fs.readFileSync(path.resolve(fixturesDir, "minimal-cv.docx"));
    const adapter = new DocxCvTextExtractorAdapter();

    const text = await adapter.extract({
      buffer,
      mimeType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    expect(text).toContain("Full Stack Developer");
    expect(text).toContain("Nantes");
    expect(text).toContain("CDD");
    expect(text).toContain("TypeScript, React, PostgreSQL");
  });
});
