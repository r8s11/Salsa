// Column event_date is timestamp with time zone (timestamptz)
import "temporal-polyfill/global";

// Form fields (New York wall-clock) -> DB timestamptz ISO instant
export function toEventDateInstant(date: string, time: string): string {
  const wallClockTime = time || "00:00";

  return Temporal.PlainDateTime.from(`${date}T${wallClockTime}:00`)
    .toZonedDateTime("America/New_York")
    .toInstant()
    .toString();
}

// DB timestamptz ISO instant -> form fields (New York wall-clock)
export function fromEventDateInstant(iso: string): { date: string; time: string } {
  const zdt = Temporal.Instant.from(iso).toZonedDateTimeISO("America/New_York");

  const year = zdt.year.toString().padStart(4, "0");
  const month = zdt.month.toString().padStart(2, "0");
  const day = zdt.day.toString().padStart(2, "0");
  const hours = zdt.hour.toString().padStart(2, "0");
  const minutes = zdt.minute.toString().padStart(2, "0");

  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

// 24h "HH:MM" -> locale "h:mm AM/PM" display label. Shared by every place
// that needs the same time-label style produced from a form field
// (AdminEventsTable's date column, AdminDuplicateEventDialog's stamped
// event_time on the new row).
export function formatTimeLabel(time24: string): string {
  const [hours, minutes] = time24.split(":").map(Number);
  return new Date(2000, 0, 1, hours, minutes).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}
