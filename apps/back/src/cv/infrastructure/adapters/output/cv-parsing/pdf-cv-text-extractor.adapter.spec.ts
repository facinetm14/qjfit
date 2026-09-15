import {
  PdfCvTextExtractorAdapter,
  type PdfTextDocument,
} from "./pdf-cv-text-extractor.adapter.js";

describe("PdfCvTextExtractorAdapter", () => {
  it("returns the text extracted from the PDF document", async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    const document: PdfTextDocument = {
      getText: jest.fn().mockResolvedValue({ text: "Backend Developer, Bordeaux" }),
      destroy,
    };
    const createDocument = jest.fn().mockReturnValue(document);
    const adapter = new PdfCvTextExtractorAdapter({ createDocument });
    const buffer = Buffer.from("fake-pdf-bytes");

    const text = await adapter.extract({ buffer, mimeType: "application/pdf" });

    expect(text).toBe("Backend Developer, Bordeaux");
    expect(createDocument).toHaveBeenCalledWith(buffer);
  });

  it("releases the document even when text extraction fails", async () => {
    const destroy = jest.fn().mockResolvedValue(undefined);
    const document: PdfTextDocument = {
      getText: jest.fn().mockRejectedValue(new Error("corrupt PDF")),
      destroy,
    };
    const createDocument = jest.fn().mockReturnValue(document);
    const adapter = new PdfCvTextExtractorAdapter({ createDocument });

    await expect(
      adapter.extract({ buffer: Buffer.from(""), mimeType: "application/pdf" }),
    ).rejects.toThrow("corrupt PDF");
    expect(destroy).toHaveBeenCalled();
  });
});
