import type { DatabaseEvent } from "../features/events/model/types";
import type { ScheduleXEvent } from "../types/events";
export const CANONICAL_ORIGIN = "https://www.salsasegura.com";

export function canonicalUrl(path: string): string {
  return new URL(path, CANONICAL_ORIGIN).toString();
}


/**
 * Generate Event structured data for SEO
 */
export function generateEventStructuredData(event: Pick<
  DatabaseEvent,
  "id" | "slug" | "title" | "description" | "event_date" | "location" | "address" | "rsvp_link" | "price_type" | "price_amount"
>) {
  const hasKnownPrice =
    event.price_type === "free" ||
    (event.price_type === "paid" && typeof event.price_amount === "number");
  const eventData = {
    "@context": "https://schema.org",
    "@type": "DanceEvent",
    name: event.title,
    description: event.description || undefined,
    startDate: event.event_date,
    url: canonicalUrl(`/events/${event.slug || event.id}`),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: event.location
      ? {
          "@type": "Place",
          name: event.location,
          address: event.address
            ? { "@type": "PostalAddress", streetAddress: event.address }
            : undefined,
        }
      : undefined,
    ...(event.rsvp_link &&
      hasKnownPrice && {
        offers: {
          "@type": "Offer",
          url: event.rsvp_link,
          price: event.price_type === "free" ? 0 : event.price_amount,
          priceCurrency: "USD",
        },
      }),
  };

  return JSON.stringify(eventData);
}

/**
 * Generate ItemList structured data for events page
 */
export function generateEventsListStructuredData(events: ScheduleXEvent[]) {
  const eventsData = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Upcoming Dance Events",
    description: "Salsa, bachata, and Latin dance events in Greater Boston & NYC",
    numberOfItems: events.length,
    itemListElement: events.slice(0, 10).map((event, index) => ({
      "@type": "ListItem",
      position: index + 1,
      item: {
        "@type": "DanceEvent",
        name: event.title,
        description: event.description,
        startDate: event.start,
        endDate: event.end,
        location: event.location
          ? {
              "@type": "Place",
              name: event.location,
            }
          : undefined,
      },
    })),
  };

  return JSON.stringify(eventsData);
}

/**
 * Update page title dynamically
 */
export function updatePageTitle(title: string) {
  document.title = `${title} | Salsa Segura`;
}

/**
 * Update meta description dynamically
 */
export function updateMetaDescription(description: string) {
  let metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
  if (!metaDescription) {
    metaDescription = document.createElement("meta");
    metaDescription.name = "description";
    document.head.appendChild(metaDescription);
  }
  metaDescription.setAttribute("content", description);
}

/**
 * Update canonical URL
 */
export function updateCanonicalUrl(url: string) {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonical) {
    canonical = document.createElement("link");
    canonical.rel = "canonical";
    document.head.appendChild(canonical);
  }
  canonical.href = url;
}

/**
 * Inject structured data into the page
 */
export function injectStructuredData(data: string, id: string = "structured-data") {
  // Remove existing script with same ID if it exists
  const existing = document.getElementById(id);
  if (existing) {
    existing.remove();
  }

  // Create and inject new script
  const script = document.createElement("script");
  script.id = id;
  script.type = "application/ld+json";
  script.textContent = data;
  document.head.appendChild(script);
}
