export type PosterFormat = "story" | "feed";

/** Export sizes: an Instagram Story and a 4:5 feed cut. */
export const POSTER_SIZE: Record<PosterFormat, { width: number; height: number }> = {
  story: { width: 1080, height: 1920 },
  feed: { width: 1080, height: 1350 },
};
