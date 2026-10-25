export type PosterFormat = "story" | "feed";

/** Export sizes: an Instagram Story and a 4:5 feed cut. */
export const POSTER_SIZE: Record<PosterFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
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
