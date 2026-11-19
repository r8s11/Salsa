// Purpose: Keep calendar events on the day they start. Overnight events
// (e.g. a social running 21:00–02:00) otherwise render a continuation bar in
// the following day's cell, which reads as a second event. Clamping the end to
// the last minute of the start day removes that spill-over without touching
// the stored event data used by the modal or list copy.

import "temporal-polyfill/global";

/**
 * End of the rendered span: the event's own end when it finishes on the start
 * day, otherwise 23:59 of the start day.
 */
export function clampEndToStartDay(
  start: Temporal.PlainDateTime,
  end: Temporal.PlainDateTime
): Temporal.PlainDateTime {
  if (Temporal.PlainDate.compare(end.toPlainDate(), start.toPlainDate()) <= 0) return end;
  return start.with({ hour: 23, minute: 59, second: 0, millisecond: 0 });
}

const escapeHtml = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/**
 * Schedule-X names each month-grid event "8:00 PM Title", so tabbing through the
 * grid never says which day. This content adds the date for assistive tech only.
 */
export function monthGridEventHtml(title: string, start: Temporal.ZonedDateTime): string {
  const date = start.toLocaleString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const time = start.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  return `<span class="calendar-month-event"><span class="sr-only">${escapeHtml(date)}, </span>`
    + `<span class="sx__month-grid-event-time">${escapeHtml(time)}</span>`
    + `<span class="sx__month-grid-event-title" title="${escapeHtml(title)}">${escapeHtml(title)}</span></span>`;
}
