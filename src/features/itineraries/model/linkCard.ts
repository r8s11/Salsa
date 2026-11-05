import { ITINERARY_POSTER_SIZE } from "./itineraryPoster";

const START_QUALITY = 82;
const QUALITY_STEP = 8;
const FLOOR_QUALITY = 42;

// Executor form: this project's tsconfig lib (ES2020) has no Promise.withResolvers.
function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Link preview image could not be encoded"))),
      "image/jpeg",
      quality,
    );
  });
}

/**
 * Re-encodes the captured 1200×630 card as a JPEG small enough for chat
 * previews (WhatsApp tends to drop larger images): quality steps down from
 * 0.82 by 0.08 until the file fits, and never below 0.42.
 */
export async function encodeLinkCard(png: Blob, maxBytes = 300_000): Promise<Blob> {
  const { width, height } = ITINERARY_POSTER_SIZE.card;
  const bitmap = await createImageBitmap(png);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Link preview image could not be drawn");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  for (let quality = START_QUALITY; quality >= FLOOR_QUALITY; quality -= QUALITY_STEP) {
    const jpeg = await toJpeg(canvas, quality / 100);
    if (jpeg.size <= maxBytes) return jpeg;
  }
  throw new Error("Link preview image is too large");
}
