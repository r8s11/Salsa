import { ScheduleXEvent } from "../types/events";

/**
 * Generate Event structured data for SEO
 */
export function generateEventStructuredData(event: ScheduleXEvent) {
  const eventData = {
    "@context": "https://schema.org",
    "@type": "DanceEvent",
    name: event.title,
    description: event.description || `${event.title} - Dance event in Boston`,
    startDate: event.start,
    endDate: event.end,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    location: event.location
      ? {
          "@type": "Place",
          name: event.location,
          address: {
            "@type": "PostalAddress",
            addressLocality: "Boston",
            addressRegion: "MA",
            addressCountry: "US",
          },
        }
      : undefined,
    organizer: {
      "@type": "Organization",
      name: "Salsa Segura",
      url: "https://salsasegura.com",
    },
    performer: {
      "@type": "Organization",
      name: "Salsa Segura",
    },
    ...(event.rsvpLink && {
      url: event.rsvpLink,
      offers: {
        "@type": "Offer",
        url: event.rsvpLink,
        availability: "https://schema.org/InStock",
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
    description: "Salsa, bachata, and Latin dance events in Greater Boston",
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
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    metaDescription.setAttribute("content", description);
  }
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
