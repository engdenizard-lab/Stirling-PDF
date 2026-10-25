// @vitest-environment node
import { describe, expect, it } from "vitest";
import { TransformImageObjectCommand } from "@editor/tools/pdfTextEditor/commands/TransformImageObjectCommand";
import { Page } from "@editor/tools/pdfTextEditor/model/Page";
import { ImageObject } from "@editor/tools/pdfTextEditor/model/ImageObject";
import type { EditorDocument } from "@editor/tools/pdfTextEditor/model/EditorDocument";

describe("rotate image by a numeric angle", () => {
  it("rotates around the center without changing image scale and supports undo/redo", () => {
    const page = new Page({ index: 0, pagePtr: 1, width: 600, height: 800 });
    const original = { a: 100, b: 0, c: 0, d: 50, e: 20, f: 30 };
    page.setImages([new ImageObject({
      id: "image-1", pageIndex: 0, pdfiumObjPtr: 7,
      matrix: { ...original }, bounds: { x: 20, y: 30, width: 100, height: 50 },
    })]);
    const calls: number[][] = [];
    const doc = {
      page: () => page,
      module: { FPDFImageObj_SetMatrix: (...args: number[]) => {
        calls.push(args); return true;
      } },
    } as unknown as EditorDocument;
    const command = new TransformImageObjectCommand({
      pageIndex: 0, imageId: "image-1", mode: "rotate-angle", angleDegrees: 30,
    });
    command.apply(doc);
    const rotated = page.images[0].matrix;
    expect(rotated.a).toBeCloseTo(100 * Math.cos(Math.PI / 6));
    expect(rotated.b).toBeCloseTo(100 * Math.sin(Math.PI / 6));
    expect(rotated.c).toBeCloseTo(-50 * Math.sin(Math.PI / 6));
    expect(rotated.d).toBeCloseTo(50 * Math.cos(Math.PI / 6));
    expect(rotated.e + (rotated.a + rotated.c) / 2).toBeCloseTo(70);
    expect(rotated.f + (rotated.b + rotated.d) / 2).toBeCloseTo(55);
    expect(page.images[0].bounds.width).toBeGreaterThan(100);
    command.revert(doc);
    expect(page.images[0].matrix).toEqual(original);
    command.apply(doc);
    expect(page.images[0].matrix.a).toBeCloseTo(rotated.a);
    expect(calls.length).toBe(3);
  });
  it("accepts negative angles without rasterizing the image", () => {
    const page = new Page({ index: 0, pagePtr: 1, width: 600, height: 800 });
    page.setImages([new ImageObject({ id: "i", pageIndex: 0, pdfiumObjPtr: 7,
      matrix: { a: 10, b: 0, c: 0, d: 20, e: 0, f: 0 },
      bounds: { x: 0, y: 0, width: 10, height: 20 },
    })]);
    const doc = { page: () => page, module: {
      FPDFImageObj_SetMatrix: () => true,
    } } as unknown as EditorDocument;
    new TransformImageObjectCommand({
      pageIndex: 0, imageId: "i", mode: "rotate-angle", angleDegrees: -90,
    }).apply(doc);
    expect(page.images[0].matrix.b).toBeCloseTo(-10);
    expect(page.images[0].matrix.c).toBeCloseTo(20);
    expect(page.images[0].pdfiumObjPtr).toBe(7);
  });
});
