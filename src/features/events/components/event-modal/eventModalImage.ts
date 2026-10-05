const FALLBACK_DIR = "/images/event-fallbacks";

// Fallback art names a kind of night, so it has to match the event: a class
// under "BACHATA NIGHTS" tells a dancer something false. Every SVG that names
// a type or style is reserved for events that are that thing; everything else
// gets the neutral "Salsa Segura" flyer.
export function resolveEventFlyer(event: {
  imageUrl?: string;
  calendarId?: string;
  danceStyles?: string[];
}): string {
  if (event.imageUrl?.trim()) return event.imageUrl;

  if (event.calendarId === "workshop") return `${FALLBACK_DIR}/workshop.svg`;
  if (event.calendarId === "social") {
    const styles = event.danceStyles?.map((style) => style.trim().toLowerCase()) ?? [];
    const bachataOnly = styles.length > 0 && styles.every((style) => style === "bachata");
    return `${FALLBACK_DIR}/${bachataOnly ? "bachata" : "social"}.svg`;
  }
  return `${FALLBACK_DIR}/salsa.svg`;
}
