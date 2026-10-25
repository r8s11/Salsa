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
