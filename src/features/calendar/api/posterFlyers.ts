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

async function fetchAssetAsDataUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) return null;
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read poster image"));
      reader.readAsDataURL(blob);
    });
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
  if (asset.status === "unavailable") return { status: "unavailable" };

  const dataUrl = await fetchAssetAsDataUrl(asset.url);
  return dataUrl ? { status: "ready", dataUrl } : { status: "unavailable" };
}
