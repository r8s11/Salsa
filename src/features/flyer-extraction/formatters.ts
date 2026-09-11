import type { ExtractedEvent } from "./types";

/**
 * Presentation-only helpers for `ExtractedEvent`. These never mutate the
 * canonical machine-readable values (`date: YYYY-MM-DD`, `*_time: HH:MM`) —
 * a later phase maps those raw values onto the event form, so the contract
 * must stay intact here.
 */

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** `"2026-09-18"` → `"September 18, 2026"`. Returns null for anything else. */
export function formatExtractedDate(date: string | null): string | null {
  const match = date ? DATE_PATTERN.exec(date) : null;
  if (!match) return null;
  const [, year, month, day] = match;
  const monthIndex = Number(month) - 1;
  const dayNumber = Number(day);
  const parsed = new Date(Date.UTC(Number(year), monthIndex, dayNumber));
  // `Date.UTC` silently rolls overflow (month 13, day 40) into the next
  // period instead of rejecting it — confirm the parsed date landed on the
  // requested month/day before trusting it.
  if (parsed.getUTCMonth() !== monthIndex || parsed.getUTCDate() !== dayNumber) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

/** `"21:00"` → `"9:00 PM"`. Returns null for anything else. */
export function formatExtractedTime(time: string | null): string | null {
  const match = time ? TIME_PATTERN.exec(time) : null;
  if (!match) return null;
  const [, hourText, minute] = match;
  const hour = Number(hourText);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${minute} ${period}`;
}

/**
 * Combines start/end into one display string, falling back to whichever
 * side is present. Returns null when neither is a valid time.
 */
export function formatTimeRange(start: string | null, end: string | null): string | null {
  const startLabel = formatExtractedTime(start);
  const endLabel = formatExtractedTime(end);
  if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
  return startLabel ?? endLabel;
}

/** Ensures a leading "@" for display without touching the stored value. */
export function formatInstagramHandle(handle: string | null): string | null {
  const trimmed = handle?.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

const STRING_COUNT_FIELDS = [
  "title",
  "date",
  "start_time",
  "end_time",
  "venue_name",
  "address",
  "city",
  "event_type",
  "price",
  "organizer_name",
  "instagram",
  "website",
] as const satisfies readonly (keyof ExtractedEvent)[];

/** Total number of independently-populatable extraction fields. */
export const EXTRACTABLE_FIELD_COUNT = STRING_COUNT_FIELDS.length + 2; // + dance_styles + details

/** Counts meaningful populated fields — never nulls or empty arrays. */
export function countPopulatedFields(extraction: ExtractedEvent): number {
  let count = 0;
  for (const field of STRING_COUNT_FIELDS) {
    if (extraction[field]) count += 1;
  }
  if (extraction.dance_styles.length > 0) count += 1;
  if (extraction.details.length > 0) count += 1;
  return count;
}

/** True when at least one extractable field came back empty. */
export function hasPartialExtraction(extraction: ExtractedEvent): boolean {
  return countPopulatedFields(extraction) < EXTRACTABLE_FIELD_COUNT;
}
