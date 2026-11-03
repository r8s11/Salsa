import type { ItineraryPosterFormat } from "./itineraryPoster";

function origin(explicit?: string): string {
  if (explicit) return explicit;
  if (typeof window === "undefined") {
    throw new Error("A public origin is required outside the browser.");
  }
  return window.location.origin;
}

/** The public itinerary page: `/itineraries/<city>/<weekStart>`. */
export function buildPublicItineraryUrl(city: string, weekStart: string, explicitOrigin?: string): string {
  return new URL(`/itineraries/${encodeURIComponent(city)}/${weekStart}`, origin(explicitOrigin)).toString();
}

/** The URL as printed on a poster: host and path, no scheme. */
export function itineraryUrlLabel(url: string): string {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`;
}

export function itineraryPosterFilename(city: string, weekStart: string, format: ItineraryPosterFormat): string {
  return `salsa-segura-week-${city}-${weekStart}${format === "feed" ? "-feed" : ""}.png`;
}
