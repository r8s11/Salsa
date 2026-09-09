// Display-side formatting helpers for extracted flyer data. Phase 3 will own
// stronger normalization; here we only make raw strings presentable.

/**
 * Format an ISO date (YYYY-MM-DD) as a friendly label, e.g. "Friday, October 24".
 * Falls back to the raw string if it can't be parsed.
 */
export function formatExtractedDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const parsed = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

/** Format a 24h time (HH:MM) as e.g. "9:00 PM"; null-safe. */
export function formatExtractedTime(time: string | null): string | null {
  if (!time) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!match) return time;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return time;
  const period = hours >= 12 ? "PM" : "AM";
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return minutes === 0 ? `${displayHour}:00 ${period}` : `${displayHour}:${match[2]} ${period}`;
}

/**
 * Format a start/end time pair as e.g. "9:00 PM – 1:00 AM". Returns null when
 * neither is present. Overnight ranges (end < start) are left intact — Phase 3
 * converts them to a proper next-day end_at.
 */
export function formatTimeRange(
  startTime: string | null,
  endTime: string | null
): string | null {
  const start = formatExtractedTime(startTime);
  const end = formatExtractedTime(endTime);
  if (!start && !end) return null;
  if (start && end) return `${start} – ${end}`;
  return start ?? end;
}

/** Normalize an Instagram handle to a leading-@ display form. */
export function formatInstagram(handle: string | null): string | null {
  if (!handle) return null;
  const trimmed = handle.trim().replace(/^@/, "");
  return trimmed ? `@${trimmed}` : null;
}
