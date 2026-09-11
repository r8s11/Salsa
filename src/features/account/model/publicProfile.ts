import type { City, DatabaseEvent } from "../../events/model/types";

// Pure derivations behind the redesigned public profile screen. Kept out of
// the component so each rule is testable without rendering.

const CITY_LABEL: Record<City, string> = {
  boston: "Boston",
  "new-york-city": "New York City",
};

/** How many upcoming events the "Hosting next" list shows. */
export const HOSTING_NEXT_LIMIT = 3;

/** How many venues the "Regular at" row shows. */
export const REGULAR_VENUE_LIMIT = 6;

/**
 * The line under the display name: home city and join month, whichever of
 * the two exist. Returns a generic line when neither does, so the slot never
 * renders empty.
 */
export function profileTagline(city: City | null, memberSince: string | null): string {
  const parts: string[] = [];
  if (city) parts.push(`Dancing in ${CITY_LABEL[city]}`);
  if (memberSince) parts.push(`Member since ${memberSince}`);
  return parts.length > 0 ? parts.join(" · ") : "SalsaSegura member";
}

/**
 * Display labels for the owner's saved dance-style slugs, in the canonical
 * option order rather than the stored order. Unknown slugs are dropped: the
 * profile shows only styles the app still offers.
 */
export function profileStyleLabels(
  slugs: readonly string[],
  options: readonly { value: string; label: string }[]
): string[] {
  const saved = new Set(slugs);
  return options.filter((option) => saved.has(option.value)).map((option) => option.label);
}

/**
 * The owner's own approved events that have not started yet, soonest first.
 * Events with an unparseable date are dropped rather than sorted arbitrarily.
 */
export function profileHostingNext(
  events: readonly DatabaseEvent[],
  now: Date = new Date()
): DatabaseEvent[] {
  const nowMs = now.getTime();
  return events
    .filter((event) => event.status === "approved")
    .map((event) => ({ event, at: Date.parse(event.event_date) }))
    .filter((row) => Number.isFinite(row.at) && row.at >= nowMs)
    .sort((a, b) => a.at - b.at)
    .slice(0, HOSTING_NEXT_LIMIT)
    .map((row) => row.event);
}

/**
 * Venues the owner runs events at, most frequent first, deduplicated
 * case-insensitively so "Ryles" and "ryles" collapse into one pill. The
 * first spelling seen wins the label.
 */
export function profileRegularVenues(events: readonly DatabaseEvent[]): string[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const event of events) {
    if (event.status !== "approved") continue;
    const label = event.location?.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    const existing = counts.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { label, count: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, REGULAR_VENUE_LIMIT)
    .map((row) => row.label);
}
