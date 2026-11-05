export type PosterFormat = "story" | "feed";

/** Export sizes: an Instagram Story and a 4:5 feed cut. */
export const POSTER_SIZE: Record<PosterFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};

/** Metro codes printed on the poster's catalogue line (`SS-… · NYC`). */
export const POSTER_CITY_CODES: Record<string, string> = {
  boston: "BOS",
  "new-york-city": "NYC",
  miami: "MIA",
  orlando: "ORL",
  "los-angeles": "LA",
  atlanta: "ATL",
  "washington-dc": "DC",
  "san-francisco": "SF",
  texas: "TX",
};

/**
 * Price text for the poster, or null when the event's price is unspecified.
 * A missing price is not a free event, so the poster must not claim "Free".
 */
export function posterPriceLabel(event: {
  priceType?: "free" | "paid" | null;
  priceAmount?: number | null;
}): string | null {
  if (event.priceType === "free") return "Free";
  if (event.priceType === "paid" && event.priceAmount != null) return `$${event.priceAmount}`;
  return null;
}
