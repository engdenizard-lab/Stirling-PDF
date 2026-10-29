import { describe, expect, it } from "vitest";
import { PDFDocument } from "@cantoo/pdf-lib";
import { parseLocalPageSelection, removePagesLocally, reorderPagesLocally, validatePageOrder } from "./localPdfPages";

async function fixture() {
  const doc = await PDFDocument.create();
  for (const w of [200, 300, 400, 500]) doc.addPage([w, 700]);
  return doc.save();
}

describe("local PDF page operations", () => {
  it("parses page ranges and rejects invalid selections", () => {
    expect(parseLocalPageSelection("1,3-4", 4)).toEqual([1, 3, 4]);
    expect(() => parseLocalPageSelection("2-6", 4)).toThrow();
    expect(() => parseLocalPageSelection("2n+1", 4)).toThrow();
  });
  it("removes only chosen pages and preserves the others", async () => {
    const result = await PDFDocument.load(await removePagesLocally(await fixture(), "1,3"));
    expect(result.getPages().map(p => p.getWidth())).toEqual([300, 500]);
  });
  it("does not allow removing every page", async () => {
    await expect(removePagesLocally(await fixture(), "1-4")).rejects.toThrow();
  });
  it("reorders pages according to the draggable selection", async () => {
    const result = await PDFDocument.load(await reorderPagesLocally(await fixture(), [4, 2, 1, 3]));
    expect(result.getPages().map(p => p.getWidth())).toEqual([500, 300, 200, 400]);
  });
  it("rejects missing, duplicated or out-of-range pages", () => {
    expect(() => validatePageOrder([2, 2, 3, 4], 4)).toThrow();
    expect(() => validatePageOrder([1, 2, 3], 4)).toThrow();
    expect(() => validatePageOrder([1, 2, 3, 5], 4)).toThrow();
  });
});
