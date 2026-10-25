export const NYC_CITY = "new-york-city";

export const NYC_SUBLOCATIONS = [
  { slug: "manhattan", name: "Manhattan" },
  { slug: "brooklyn", name: "Brooklyn" },
  { slug: "queens", name: "Queens" },
  { slug: "bronx", name: "The Bronx" },
  { slug: "staten-island", name: "Staten Island" },
] as const;

export type SubLocation = (typeof NYC_SUBLOCATIONS)[number]["slug"];

export function isSubLocation(value: unknown): value is SubLocation {
  return NYC_SUBLOCATIONS.some((location) => location.slug === value);
}

export function subLocationsForCity(city: string | null) {
  return city === NYC_CITY ? NYC_SUBLOCATIONS : [];
}

export function normalizeSubLocation(
  city: string | null,
  value: unknown
): SubLocation | null {
  return city === NYC_CITY && isSubLocation(value) ? value : null;
}

export function subLocationLabel(value: string | null | undefined): string | null {
  return NYC_SUBLOCATIONS.find((location) => location.slug === value)?.name ?? null;
}
