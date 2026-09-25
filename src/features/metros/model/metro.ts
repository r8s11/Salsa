// Metro domain: canonical metropolitan areas and how a visitor lands in one.
//
// The metro list itself comes from the database (public.metros and the
// public_active_metros view). Nothing here enumerates supported cities; the
// only literals are legacy spellings that must keep resolving to the slugs
// events.city already stores.

export type MetroSlug = string;

export interface Metro {
  slug: MetroSlug;
  name: string;
  stateRegion: string | null;
  countryCode: string;
  latitude: number | null;
  longitude: number | null;
}

export interface ActiveMetro extends Metro {
  upcomingEventCount: number;
  nextEventAt: string;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type RankedMetro = ActiveMetro & { distanceKm: number | null };

/**
 * How far a metro can be from the visitor and still count as "near you".
 * Covers the commuter shed of a large metro (Newark → NYC ≈ 15 km, Worcester
 * → Boston ≈ 65 km) without calling Philadelphia a New York suburb.
 */
export const NEARBY_RADIUS_KM = 150;

/** "Los Angeles" → "los-angeles". Accents folded, punctuation collapsed. */
export function toMetroSlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Spellings, boroughs and suburbs that events and old links already use.
// Aliases only redirect to a canonical slug; they never make a metro exist.
const METRO_ALIASES: Record<string, MetroSlug> = {
  nyc: "new-york-city",
  "new-york": "new-york-city",
  "new-york-ny": "new-york-city",
  ny: "new-york-city",
  manhattan: "new-york-city",
  brooklyn: "new-york-city",
  queens: "new-york-city",
  bronx: "new-york-city",
  "the-bronx": "new-york-city",
  "staten-island": "new-york-city",
  "long-island-city": "new-york-city",
  astoria: "new-york-city",
  "jersey-city": "new-york-city",
  hoboken: "new-york-city",
  newark: "new-york-city",
  bos: "boston",
  "greater-boston": "boston",
  "boston-ma": "boston",
  cambridge: "boston",
  somerville: "boston",
  medford: "boston",
  brookline: "boston",
  newton: "boston",
  quincy: "boston",
  watertown: "boston",
  waltham: "boston",
  arlington: "boston",
  belmont: "boston",
  everett: "boston",
  chelsea: "boston",
  revere: "boston",
  malden: "boston",
  "jamaica-plain": "boston",
};

/**
 * Resolve free text (a slug, a metro name, a borough, an old URL segment)
 * to the canonical slug of a registered metro, or null.
 */
export function resolveMetroSlug(
  value: string | null | undefined,
  metros: ReadonlyArray<Pick<Metro, "slug" | "name">>
): MetroSlug | null {
  if (!value) return null;
  const candidate = toMetroSlug(value);
  if (!candidate) return null;
  const known = new Set(metros.map((metro) => metro.slug));
  if (known.has(candidate)) return candidate;
  const byName = metros.find((metro) => toMetroSlug(metro.name) === candidate);
  if (byName) return byName.slug;
  const alias = METRO_ALIASES[candidate];
  return alias && known.has(alias) ? alias : null;
}

/** Display fallback when the metro row is not loaded: "new-york-city" → "New York City". */
export function metroLabelFromSlug(slug: MetroSlug): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/** Compact code for pills and posters: "New York City" → "NYC", "Boston" → "BOS". */
export function metroShortCode(name: string): string {
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words.length > 1) return words.map((word) => word[0].toUpperCase()).join("");
  return (words[0] ?? "").slice(0, 3).toUpperCase();
}

/** Great-circle distance in kilometres. */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Coarsen a position before it is used anywhere: one decimal place is about
 * 11 km, plenty to pick a metro and too coarse to identify a street.
 */
export function coarsen(coords: Coordinates): Coordinates {
  return {
    latitude: Math.round(coords.latitude * 10) / 10,
    longitude: Math.round(coords.longitude * 10) / 10,
  };
}

function byInventory(a: ActiveMetro, b: ActiveMetro): number {
  return (
    b.upcomingEventCount - a.upcomingEventCount ||
    a.nextEventAt.localeCompare(b.nextEventAt) ||
    a.name.localeCompare(b.name)
  );
}

/**
 * Active metros in explorer order: nearest first when the visitor's area is
 * known, otherwise (and for metros without coordinates) by inventory.
 */
export function rankMetros(
  active: ReadonlyArray<ActiveMetro>,
  coords: Coordinates | null
): RankedMetro[] {
  const ranked = active.map((metro) => ({
    ...metro,
    distanceKm:
      coords && metro.latitude !== null && metro.longitude !== null
        ? distanceKm(coords, { latitude: metro.latitude, longitude: metro.longitude })
        : null,
  }));
  return ranked.sort((a, b) => {
    if (a.distanceKm !== null && b.distanceKm !== null) return a.distanceKm - b.distanceKm;
    if (a.distanceKm !== null) return -1;
    if (b.distanceKm !== null) return 1;
    return byInventory(a, b);
  });
}

export type MetroSource =
  | "explicit"
  | "profile"
  | "stored"
  | "location"
  | "inventory"
  | "none-nearby"
  | "none";

export interface MetroChoice {
  slug: MetroSlug | null;
  source: MetroSource;
}

export interface MetroChoiceInput {
  /** Chosen this session: a metro URL or a pick in the city explorer. */
  explicit: MetroSlug | null;
  /** The signed-in dancer's home city. */
  profile: MetroSlug | null;
  /** The last city this browser picked by hand. */
  stored: MetroSlug | null;
  /** Approximate visitor position, when the browser already shared it. */
  coords: Coordinates | null;
  /** Every registered metro (validates remembered slugs). */
  metros: ReadonlyArray<Pick<Metro, "slug" | "name">>;
  /** Metros with approved upcoming events. */
  active: ReadonlyArray<ActiveMetro>;
}

/**
 * Pick the homepage metro. A person's choice always outranks inference:
 * explicit > profile > stored > nearest active metro > inventory fallback.
 * A visitor whose area is known but has no active metro nearby gets no metro
 * (`none-nearby`) so the homepage can say so and suggest the closest ones,
 * instead of silently dropping them into a city hundreds of miles away.
 */
export function chooseMetro(input: MetroChoiceInput): MetroChoice {
  const registered = (slug: MetroSlug | null) =>
    slug !== null && input.metros.some((metro) => metro.slug === slug) ? slug : null;

  const explicit = registered(input.explicit);
  if (explicit) return { slug: explicit, source: "explicit" };
  const profile = registered(input.profile);
  if (profile) return { slug: profile, source: "profile" };
  const stored = registered(input.stored);
  if (stored) return { slug: stored, source: "stored" };

  if (input.coords) {
    const [nearest] = rankMetros(input.active, input.coords);
    if (nearest && nearest.distanceKm !== null && nearest.distanceKm <= NEARBY_RADIUS_KM) {
      return { slug: nearest.slug, source: "location" };
    }
    return { slug: null, source: "none-nearby" };
  }

  const [top] = [...input.active].sort(byInventory);
  return top ? { slug: top.slug, source: "inventory" } : { slug: null, source: "none" };
}

const KM_PER_MILE = 1.609344;

/** "Nearby" inside ten miles, otherwise miles rounded to the nearest five. */
export function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm === null) return null;
  const miles = distanceKm / KM_PER_MILE;
  return miles < 10 ? "Nearby" : `${Math.round(miles / 5) * 5} mi`;
}

export function eventCountLabel(count: number): string {
  return `${count} upcoming ${count === 1 ? "event" : "events"}`;
}
