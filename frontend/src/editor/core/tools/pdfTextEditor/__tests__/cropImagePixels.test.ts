import { describe, expect, it } from "vitest";
import { cropImagePixels } from "@editor/tools/pdfTextEditor/util/cropImagePixels";

describe("cropImagePixels", () => {
  const rgba = new Uint8Array(4 * 4 * 4);
  for (let i = 0; i < 16; i++) {
    rgba[i * 4] = i;
    rgba[i * 4 + 3] = 255;
  }
  const source = { width: 4, height: 4, rgba };

  it("returns the middle four pixels in their original order", () => {
    const { image: out, appliedCrop } = cropImagePixels(source, { left: .25, top: .25, right: .75, bottom: .75 });
    expect(appliedCrop).toEqual({ left: .25, top: .25, right: .75, bottom: .75 });
    expect([out.width, out.height]).toEqual([2, 2]);
    expect([0, 1, 2, 3].map(i => out.rgba[i * 4])).toEqual([5, 6, 9, 10]);
    expect(source.width).toBe(4);
  });

  it("preserves full image pixels when no crop is requested", () => {
    const { image: out } = cropImagePixels(source, { left: 0, top: 0, right: 1, bottom: 1 });
    expect(out.rgba).toEqual(rgba);
    expect(out.rgba).not.toBe(rgba);
  });

  it("aligns the geometry to exact integer pixel boundaries", () => {
    const result = cropImagePixels(source, { left: .3, top: .3, right: .7, bottom: .7 });
    expect(result.image.width).toBe(2);
    expect(result.image.height).toBe(2);
    expect(result.appliedCrop).toEqual({ left: .25, top: .25, right: .75, bottom: .75 });
  });

  it("rejects invalid crop bounds", () => {
    expect(() => cropImagePixels(source, { left: .8, top: 0, right: .2, bottom: 1 })).toThrow();
  });
});
