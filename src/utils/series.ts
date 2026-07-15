// Purpose: Derive upcoming weekly-series occurrences from an event's start.

import "temporal-polyfill/global";

export function getUpcomingSeriesDates(
  start: string,
  count = 3
): Temporal.PlainDateTime[] {
  const base = Temporal.PlainDateTime.from(start.replace(" ", "T"));
  return Array.from({ length: count }, (_, i) =>
    base.add({ weeks: i + 1 })
  );
}
