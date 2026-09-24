// Purpose: Name the night an event falls on, relative to today on the floor.
// `start` is the "YYYY-MM-DD HH:mm" New York wall-clock string convert.ts
// produces, and `today` is New York's calendar date — so the dancer's own
// device zone never decides whether something is "tonight".
import "temporal-polyfill/global";

// A start at or after 5pm is a night out; earlier the same day is "today".
const EVENING_STARTS_AT_HOUR = 17;

export type Night =
  | { kind: "tonight" | "today" }
  | { kind: "later"; date: string; label: string };

export function nightOf(start: string, today: string): Night {
  const startsAt = Temporal.PlainDateTime.from(start.replace(" ", "T"));
  const date = startsAt.toPlainDate();
  if (date.toString() === today) {
    return { kind: startsAt.hour >= EVENING_STARTS_AT_HOUR ? "tonight" : "today" };
  }
  // "Fri 26 Sep": built from parts because en-GB now prints "Sept".
  const weekday = date.toLocaleString("en-US", { weekday: "short" });
  const month = date.toLocaleString("en-US", { month: "short" });
  return { kind: "later", date: date.toString(), label: `${weekday} ${date.day} ${month}` };
}
