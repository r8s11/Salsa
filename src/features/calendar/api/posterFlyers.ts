import { supabase } from "../../../lib/supabase";

export type PosterFlyerResponse =
  | { status: "ready"; url: string }
  | { status: "missing" }
  | { status: "unavailable"; message: string };

const UNAVAILABLE_MESSAGE = "Flyer source cannot be used for sharing.";

export async function requestPosterFlyer(eventId: string): Promise<PosterFlyerResponse> {
  const { data, error } = await supabase.functions.invoke<PosterFlyerResponse>(
    "resolve-poster-flyer",
    { body: { eventId } },
  );

  if (!error && data) return data;

  const maybeContext = error as unknown as { context?: { json: () => Promise<unknown> } };
  if (maybeContext?.context?.json) {
    try {
      const body = (await maybeContext.context.json()) as PosterFlyerResponse;
      if (body && typeof body === "object" && "status" in body) return body;
    } catch {
      // fall through to unavailable
    }
  }

  return { status: "unavailable", message: UNAVAILABLE_MESSAGE };
}

/**
 * Longest-edge cap applied to a flyer before it is embedded in the poster.
 *
 * The Story poster is captured at 1080x1920, so 1440px preserves full visual
 * quality for both the framed foreground copy (936px wide) and the full-bleed
 * blurred background copy. The cap exists because `html-to-image` serializes
 * the whole poster - including every embedded base64 image - into an SVG
 * string and then re-encodes that string for the final canvas draw. A raw
 * multi-megabyte upload (a 2.2 MB phone photo becomes a ~2.9 MB data URL)
 * makes that serialization never finish in practice: capture hangs past 80s
 * instead of the ~60ms it takes once the payload is downscaled.
 */
const MAX_POSTER_IMAGE_EDGE = 1440;
const POSTER_IMAGE_QUALITY = 0.85;

/**
 * Decodes `blob` and re-encodes it as a JPEG data URL no larger than
 * `MAX_POSTER_IMAGE_EDGE` on its longest edge. Returns null when the bytes
 * cannot be decoded as an image.
 */
async function toDownscaledDataUrl(blob: Blob): Promise<string | null> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }

  try {
    const scale = Math.min(1, MAX_POSTER_IMAGE_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));

    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    return canvas.toDataURL("image/jpeg", POSTER_IMAGE_QUALITY);
  } finally {
    bitmap.close();
  }
}

async function fetchAssetAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    return await toDownscaledDataUrl(await response.blob());
  } catch {
    return null;
  }
}

export type PosterImageResolution =
  | { status: "ready"; dataUrl: string }
  | { status: "missing" }
  | { status: "unavailable" };

export async function resolvePosterImageForEvent(params: {
  eventId: string;
  sourceUrl?: string | null;
  cachedUrl?: string | null;
}): Promise<PosterImageResolution> {
  const { eventId, sourceUrl, cachedUrl } = params;

  if (!sourceUrl && !cachedUrl) return { status: "missing" };

  let asset: PosterFlyerResponse;

  if (cachedUrl) {
    asset = { status: "ready", url: cachedUrl };
  } else {
    asset = await requestPosterFlyer(eventId);
  }

  if (asset.status === "missing") return { status: "missing" };
  if (asset.status === "unavailable") {
    // Fallback: try direct fetch for storage URLs or when function is unavailable
    if (sourceUrl) {
      const directDataUrl = await fetchAssetAsDataUrl(sourceUrl);
      if (directDataUrl) return { status: "ready", dataUrl: directDataUrl };
    }
    return { status: "unavailable" };
  }

  const dataUrl = await fetchAssetAsDataUrl(asset.url);
  return dataUrl ? { status: "ready", dataUrl } : { status: "unavailable" };
}
