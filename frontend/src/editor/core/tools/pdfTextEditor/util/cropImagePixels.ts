import type { ImagePixels } from "@editor/tools/pdfTextEditor/util/imagePixels";
import type { ImageCropBounds } from "@editor/tools/pdfTextEditor/commands/ReplaceImageCommand";

/** Crop RGBA pixels in top-left image coordinates, retaining exact pixel values. */
export function cropImagePixels(pixels: ImagePixels, crop: ImageCropBounds): ImagePixels {
  const { width, height, rgba } = pixels;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
      rgba.length !== width * height * 4) throw new Error("Invalid source image");
  const { left, top, right, bottom } = crop;
  if (![left, top, right, bottom].every(Number.isFinite) ||
      left < 0 || top < 0 || right > 1 || bottom > 1 || left >= right || top >= bottom)
    throw new Error("Invalid crop bounds");
  const x0 = Math.floor(left * width), y0 = Math.floor(top * height);
  const x1 = Math.min(width, Math.max(x0 + 1, Math.ceil(right * width)));
  const y1 = Math.min(height, Math.max(y0 + 1, Math.ceil(bottom * height)));
  const w = x1 - x0, h = y1 - y0;
  const output = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    const start = ((y0 + y) * width + x0) * 4;
    output.set(rgba.subarray(start, start + w * 4), y * w * 4);
  }
  return { rgba: output, width: w, height: h };
}
