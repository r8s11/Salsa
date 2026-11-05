import { CANONICAL_ORIGIN } from "../../../utils/seo";
import type { ItineraryPosterFormat } from "./itineraryPoster";

/**
 * The public itinerary page: `/itineraries/<city>/<weekStart>`. Posters and
 * the link card print and encode the canonical origin, never the origin
 * they were rendered on.
 */
export function buildPublicItineraryUrl(city: string, weekStart: string, origin = CANONICAL_ORIGIN): string {
  return new URL(`/itineraries/${encodeURIComponent(city)}/${weekStart}`, origin).toString();
}

/** The URL as printed on a poster: host and path, no scheme. */
export function itineraryUrlLabel(url: string): string {
  const { host, pathname } = new URL(url);
  return `${host}${pathname}`;
}

export function itineraryPosterFilename(city: string, weekStart: string, format: ItineraryPosterFormat): string {
  return `salsa-segura-week-${city}-${weekStart}${format === "feed" ? "-feed" : ""}.png`;
}
