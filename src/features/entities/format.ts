import "temporal-polyfill/global";
import type { PublicEntityRef } from "./model";

export function formatEventDate(value: string): string {
  try {
    return Temporal.Instant.from(value)
      .toZonedDateTimeISO("America/New_York")
      .toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

export function entityLocation(entity: Pick<PublicEntityRef, "address" | "city" | "state_region" | "country">): string {
  return [entity.address, entity.city?.replace(/-/g, " "), entity.state_region, entity.country].filter(Boolean).join(", ");
}

export function eventDateParts(value: string): { day: string; month: string; weekday: string; time: string } | null {
  try {
    const zoned = Temporal.Instant.from(value).toZonedDateTimeISO("America/New_York");
    return {
      day: String(zoned.day),
      month: zoned.toLocaleString(undefined, { month: "short" }),
      weekday: zoned.toLocaleString(undefined, { weekday: "short" }),
      time: zoned.toLocaleString(undefined, { timeStyle: "short" }),
    };
  } catch {
    return null;
  }
}
