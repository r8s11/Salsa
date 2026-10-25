/** Hard cap, mirrored by `public.max_event_flyers()` in the database. */
export const MAX_FLYERS_PER_EVENT = 5;

type FlyerSource = {
  image_url?: string | null;
  image_urls?: readonly string[] | null;
};

/** Trim, drop blanks, de-duplicate (first wins), and cap at the per-event maximum. */
export function normalizeFlyerUrls(urls: readonly (string | null | undefined)[]): string[] {
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = raw?.trim();
    if (url) seen.add(url);
    if (seen.size === MAX_FLYERS_PER_EVENT) break;
  }
  return [...seen];
}

/**
 * The ordered flyer list for an event row. Prefers `image_urls`; falls back to
 * the legacy single `image_url` (rows from before the column existed, or
 * fixtures that only carry the primary).
 */
export function eventFlyerList(event: FlyerSource): string[] {
  return normalizeFlyerUrls(event.image_urls?.length ? event.image_urls : [event.image_url]);
}

/** Writer payload fragment: keeps `image_url` (primary) and `image_urls` in step. */
export function flyerPayload(urls: readonly string[]): {
  image_url: string | null;
  image_urls: string[] | null;
} {
  const list = normalizeFlyerUrls(urls);
  return { image_url: list[0] ?? null, image_urls: list.length ? list : null };
}
