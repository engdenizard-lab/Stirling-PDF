import { PDFDocument, degrees } from "@cantoo/pdf-lib";

/** Only explicit numbers and ranges are supported in the offline editor. */
export function parseLocalPageSelection(text: string, count: number): number[] {
  if (!Number.isSafeInteger(count) || count < 1) throw new Error("PDF sem páginas");
  if (!text.trim()) throw new Error("Informe as páginas");
  const picked: number[] = [];
  for (const piece of text.split(",")) {
    const token = piece.trim();
    const match = /^(\d+)(?:-(\d+))?$/.exec(token);
    if (!match) throw new Error("Use números e intervalos, como 1,3,5-8");
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) ||
        from < 1 || to < from || to > count)
      throw new Error("Número de página fora do documento");
    for (let page = from; page <= to; page++) picked.push(page);
  }
  return picked;
}

export async function removePagesLocally(bytes: Uint8Array, selection: string): Promise<Uint8Array> {
  const document = await PDFDocument.load(bytes);
  const positions = new Set(parseLocalPageSelection(selection, document.getPageCount()));
  if (positions.size >= document.getPageCount())
    throw new Error("Não é possível remover todas as páginas");
  for (let page = document.getPageCount(); page >= 1; page--) {
    if (positions.has(page)) document.removePage(page - 1);
  }
  return document.save();
}

export function validatePageOrder(order: number[], count: number): void {
  if (order.length !== count || new Set(order).size !== count ||
      order.some(page => !Number.isSafeInteger(page) || page < 1 || page > count))
    throw new Error("A nova ordem deve conter cada página exatamente uma vez");
}

export async function reorderPagesLocally(bytes: Uint8Array, order: number[]): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes);
  validatePageOrder(order, source.getPageCount());
  const result = await PDFDocument.create();
  const pages = await result.copyPages(source, order.map(p => p - 1));
  for (const page of pages) result.addPage(page);
  return result.save();
}

/** Rotate all PDF pages by right angles without rasterizing their content. */
export async function rotatePagesLocally(bytes: Uint8Array, angle: number): Promise<Uint8Array> {
  if (!Number.isFinite(angle) || angle % 90 !== 0)
    throw new Error("A rotação deve ser um múltiplo de 90 graus");
  const pdf = await PDFDocument.load(bytes);
  for (const page of pdf.getPages()) {
    const previous = page.getRotation().angle;
    page.setRotation(degrees(((previous + angle) % 360 + 360) % 360));
  }
  return pdf.save();
}

/** Preserve the original vector PDF page contents while extracting selected pages. */
export async function extractPagesLocally(bytes: Uint8Array, pages: number[]): Promise<Uint8Array> {
  const source = await PDFDocument.load(bytes);
  if (!pages.length || pages.some(n => !Number.isSafeInteger(n) || n < 1 || n > source.getPageCount()))
    throw new Error("Seleção de páginas inválida");
  const output = await PDFDocument.create();
  const copies = await output.copyPages(source, pages.map(page => page - 1));
  for (const copy of copies) output.addPage(copy);
  return output.save();
}
