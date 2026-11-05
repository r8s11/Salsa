// Purpose: Pick the homepage spotlight. `upcoming` must already hold only
// events that have not started, in the selected area, earliest first — the
// feed is fetched per city (and borough/neighborhood), so the choice is always
// local and a past featured event can never win.
import type { ScheduleXEvent } from "./types";

/** The earliest event an admin featured; otherwise the next event, if any. */
export function featuredEventOf<T extends Pick<ScheduleXEvent, "featured">>(
  upcoming: readonly T[]
): T | undefined {
  return upcoming.find((event) => event.featured) ?? upcoming[0];
}
