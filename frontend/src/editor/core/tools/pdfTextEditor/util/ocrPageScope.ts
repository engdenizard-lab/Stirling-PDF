import { PDFDocument } from "@cantoo/pdf-lib";

/** Page numbers in the OCR UI are 1-based; pdf-lib indices are 0-based. */
export type OcrPageScope =
  | { mode: "document" }
  | { mode: "current"; page: number };

export function validateOcrPageScope(scope: OcrPageScope, totalPages: number): void {
  if (!Number.isSafeInteger(totalPages) || totalPages < 1)
    throw new Error("The PDF contains no pages");
  if (scope.mode === "current" &&
      (!Number.isSafeInteger(scope.page) || scope.page < 1 || scope.page > totalPages))
    throw new Error("The selected OCR page is outside the document");
}

/**
 * Extract only the selected page for OCR. Never send other pages to an OCR
 * endpoint when the user chooses current-page mode.
 */
export async function extractOcrInput(
  source: Uint8Array,
  scope: OcrPageScope,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.load(source);
  validateOcrPageScope(scope, pdf.getPageCount());
  if (scope.mode === "document") return source;
  const isolated = await PDFDocument.create();
  const [page] = await isolated.copyPages(pdf, [scope.page - 1]);
  isolated.addPage(page);
  return isolated.save();
}

/**
 * Place a one-page OCR result back into a working copy of the original PDF.
 * The rest of the page tree is untouched by this operation. Any PDF edit may
 * invalidate existing digital signatures; callers must warn before proceeding.
 */
export async function mergeSinglePageOcrResult(
  originalBytes: Uint8Array,
  ocrPageBytes: Uint8Array,
  selectedPage: number,
): Promise<Uint8Array> {
  const original = await PDFDocument.load(originalBytes);
  validateOcrPageScope({ mode: "current", page: selectedPage }, original.getPageCount());
  const result = await PDFDocument.load(ocrPageBytes);
  if (result.getPageCount() !== 1)
    throw new Error("OCR result must contain exactly one page");
  const originalPage = original.getPage(selectedPage - 1);
  const recognizedPage = result.getPage(0);
  const originalSize = originalPage.getSize();
  const recognizedSize = recognizedPage.getSize();
  // Do not silently resize an original page during OCR. OCR text positions
  // would be incorrect if the result were simply resized after recognition.
  if (Math.abs(originalSize.width - recognizedSize.width) > 0.01 ||
      Math.abs(originalSize.height - recognizedSize.height) > 0.01 ||
      originalPage.getRotation().angle !== recognizedPage.getRotation().angle) {
    throw new Error(
      `OCR changed page dimensions or rotation; original PDF preserved ` +
      `(original: ${originalSize.width}x${originalSize.height}, rotation ${originalPage.getRotation().angle}; ` +
      `OCR: ${recognizedSize.width}x${recognizedSize.height}, rotation ${recognizedPage.getRotation().angle})`,
    );
  }
  const [recognized] = await original.copyPages(result, [0]);
  original.removePage(selectedPage - 1);
  original.insertPage(selectedPage - 1, recognized);
  return original.save();
}
