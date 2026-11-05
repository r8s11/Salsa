import type { DatabaseEvent } from "../../../types/events";
import type { ItineraryItem } from "./types";
import { nightWeekday } from "./week";

export interface NextWeekMatch {
  items: ItineraryItem[];
  dropped: { item: ItineraryItem; title: string }[];
}

export function normalizeTitle(title: string): string {
  return title
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

type Matcher = (source: DatabaseEvent, candidate: DatabaseEvent) => boolean;

const sameTitle: Matcher = (s, c) => normalizeTitle(s.title) === normalizeTitle(c.title);

// Strongest first; the weekday check is applied separately for every level.
const MATCH_LEVELS: Matcher[] = [
  (s, c) => s.series_id != null && s.series_id === c.series_id,
  (s, c) => s.venue_id != null && s.venue_id === c.venue_id && sameTitle(s, c),
  (s, c) =>
    s.location != null &&
    c.location != null &&
    normalizeTitle(s.location) === normalizeTitle(c.location) &&
    sameTitle(s, c),
];

export function matchNextWeek(
  sourceItems: ItineraryItem[],
  sourceEvents: ReadonlyMap<string, DatabaseEvent>,
  candidates: DatabaseEvent[],
  timeZone: string,
): NextWeekMatch {
  const candidateDays = candidates.map((c) => nightWeekday(c.event_date, timeZone));
  const used = new Set<number>();
  const matchedIndex = new Map<number, number>();

  for (const level of MATCH_LEVELS) {
    sourceItems.forEach((item, i) => {
      if (matchedIndex.has(i)) return;
      const source = sourceEvents.get(item.eventId);
      if (!source) return;
      const day = nightWeekday(source.event_date, timeZone);
      const found = candidates.findIndex(
        (c, j) => !used.has(j) && candidateDays[j] === day && level(source, c),
      );
      if (found === -1) return;
      used.add(found);
      matchedIndex.set(i, found);
    });
  }

  const result: NextWeekMatch = { items: [], dropped: [] };
  sourceItems.forEach((item, i) => {
    const found = matchedIndex.get(i);
    if (found !== undefined) {
      result.items.push({ ...item, eventId: candidates[found].id });
    } else {
      result.dropped.push({ item, title: sourceEvents.get(item.eventId)?.title ?? "Unknown event" });
    }
  });
  return result;
}
