import { describe, expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import {
  extractOcrInput,
  mergeSinglePageOcrResult,
  validateOcrPageScope,
} from "@editor/tools/pdfTextEditor/util/ocrPageScope";

async function fixture(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const width of [200, 300, 400]) pdf.addPage([width, 600]);
  return pdf.save();
}

describe("OCR document / current-page scope", () => {
  it("returns the entire source unchanged in document mode", async () => {
    const pdf = await fixture();
    expect(await extractOcrInput(pdf, { mode: "document" })).toBe(pdf);
  });

  it("isolates only the current page for processing", async () => {
    const pdf = await fixture();
    const isolated = await PDFDocument.load(
      await extractOcrInput(pdf, { mode: "current", page: 2 }),
    );
    expect(isolated.getPageCount()).toBe(1);
    expect(isolated.getPage(0).getWidth()).toBe(300);
  });

  it("replaces precisely the selected page and preserves page order", async () => {
    const pdf = await fixture();
    // A real OCR request operates on the extracted page, preserving its
    // media box and inherited page geometry rather than creating a blank page.
    const recognized = await extractOcrInput(pdf, { mode: "current", page: 2 });
    const merged = await PDFDocument.load(
      await mergeSinglePageOcrResult(pdf, recognized, 2),
    );
    expect(merged.getPageCount()).toBe(3);
    expect(merged.getPages().map((p) => p.getWidth())).toEqual([200, 300, 400]);
  });

  it("rejects OCR pages with changed dimensions", async () => {
    const pdf = await fixture();
    const altered = await PDFDocument.create();
    altered.addPage([333, 600]);
    await expect(mergeSinglePageOcrResult(pdf, await altered.save(), 2))
      .rejects.toThrow("changed page dimensions");
  });

  it("rejects invalid pages and multipage OCR output", async () => {
    expect(() => validateOcrPageScope({ mode: "current", page: 4 }, 3)).toThrow();
    const pdf = await fixture();
    await expect(mergeSinglePageOcrResult(pdf, pdf, 1)).rejects.toThrow();
  });
});
