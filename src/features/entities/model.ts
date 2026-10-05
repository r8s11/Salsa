export const PUBLIC_ENTITY_KINDS = [
  "event",
  "series",
  "organizer",
  "venue",
  "school",
  "instructor",
  "city",
  "style",
] as const;

export type PublicEntityKind = (typeof PUBLIC_ENTITY_KINDS)[number];

export type PublicEntityRef = {
  kind: PublicEntityKind;
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  city: string | null;
  state_region?: string | null;
  country?: string | null;
  address?: string | null;
  website?: string | null;
  instagram?: string | null;
  origin?: string | null;
  category?: string | null;
  event_date?: string | null;
};

export type EventSummary = {
  id: string;
  slug: string;
  title: string;
  event_date: string;
  city: string;
  location: string | null;
  image_url: string | null;
};

export type EntityDetail = {
  entity: PublicEntityRef;
  upcoming: EventSummary[];
  past: EventSummary[];
  related: PublicEntityRef[];
};

export type PublicEventEntities = {
  venue: PublicEntityRef | null;
  organizer: PublicEntityRef | null;
  school: PublicEntityRef | null;
  instructors: PublicEntityRef[];
  schools: PublicEntityRef[];
  series: PublicEntityRef | null;
  city: PublicEntityRef | null;
  styles: PublicEntityRef[];
};

export const ENTITY_LABELS: Record<PublicEntityKind, string> = {
  event: "Event",
  series: "Series",
  organizer: "Organizer",
  venue: "Venue",
  school: "School",
  instructor: "Instructor",
  city: "City",
  style: "Dance style",
};

const ENTITY_PATHS: Record<PublicEntityKind, string> = {
  event: "/events",
  series: "/series",
  organizer: "/o",
  venue: "/v",
  school: "/s",
  instructor: "/i",
  city: "/cities",
  style: "/styles",
};

export function entityHref(entity: Pick<PublicEntityRef, "kind" | "slug">): string {
  return `${ENTITY_PATHS[entity.kind]}/${encodeURIComponent(entity.slug)}`;
}
