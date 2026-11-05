import type { SubLocation } from "./sublocation";

export interface Neighborhood {
  slug: string;
  name: string;
  city: string;
  borough: SubLocation | null;
}

/** Curated discovery areas, not an exhaustive list or inferred event locations. */
export const NEIGHBORHOODS: readonly Neighborhood[] = [
  ...[
    ["manhattan", "harlem", "Harlem"],
    ["manhattan", "washington-heights", "Washington Heights"],
    ["manhattan", "east-village", "East Village"],
    ["manhattan", "chelsea", "Chelsea"],
    ["manhattan", "midtown", "Midtown"],
    ["brooklyn", "williamsburg", "Williamsburg"],
    ["brooklyn", "bushwick", "Bushwick"],
    ["brooklyn", "downtown-brooklyn", "Downtown Brooklyn"],
    ["brooklyn", "park-slope", "Park Slope"],
    ["queens", "astoria", "Astoria"],
    ["queens", "long-island-city", "Long Island City"],
    ["queens", "jackson-heights", "Jackson Heights"],
    ["queens", "flushing", "Flushing"],
    ["bronx", "mott-haven", "Mott Haven"],
    ["bronx", "fordham", "Fordham"],
    ["bronx", "kingsbridge", "Kingsbridge"],
    ["staten-island", "st-george", "St. George"],
    ["staten-island", "tompkinsville", "Tompkinsville"],
    ["staten-island", "stapleton", "Stapleton"],
  ].map(([borough, slug, name]) => ({ city: "new-york-city", borough: borough as SubLocation, slug, name })),
  ...[
    ["boston", "allston", "Allston"],
    ["boston", "brighton", "Brighton"],
    ["boston", "back-bay", "Back Bay"],
    ["boston", "south-end", "South End"],
    ["boston", "jamaica-plain", "Jamaica Plain"],
    ["boston", "dorchester", "Dorchester"],
    ["boston", "roxbury", "Roxbury"],
    ["boston", "east-boston", "East Boston"],
    ["atlanta", "midtown-atlanta", "Midtown"],
    ["atlanta", "downtown-atlanta", "Downtown"],
    ["atlanta", "buckhead", "Buckhead"],
    ["atlanta", "old-fourth-ward", "Old Fourth Ward"],
    ["los-angeles", "hollywood", "Hollywood"],
    ["los-angeles", "downtown-los-angeles", "Downtown Los Angeles"],
    ["los-angeles", "silver-lake", "Silver Lake"],
    ["los-angeles", "echo-park", "Echo Park"],
    ["miami", "little-havana", "Little Havana"],
    ["miami", "wynwood", "Wynwood"],
    ["miami", "brickell", "Brickell"],
    ["miami", "downtown-miami", "Downtown"],
    ["orlando", "downtown-orlando", "Downtown"],
    ["orlando", "mills-50", "Mills 50"],
    ["orlando", "college-park", "College Park"],
    ["orlando", "thornton-park", "Thornton Park"],
    ["san-francisco", "mission-district", "Mission District"],
    ["san-francisco", "soma", "SoMa"],
    ["san-francisco", "castro", "Castro"],
    ["san-francisco", "north-beach", "North Beach"],
    ["washington-dc", "adams-morgan", "Adams Morgan"],
    ["washington-dc", "columbia-heights", "Columbia Heights"],
    ["washington-dc", "dupont-circle", "Dupont Circle"],
    ["washington-dc", "u-street", "U Street"],
  ].map(([city, slug, name]) => ({ city, borough: null, slug, name })),
];

export function neighborhoodsForLocation(city: string | null, borough: SubLocation | null): readonly Neighborhood[] {
  return NEIGHBORHOODS.filter((entry) => entry.city === city && entry.borough === borough);
}

export function normalizeNeighborhood(city: string | null, borough: SubLocation | null, value: unknown): string | null {
  return NEIGHBORHOODS.find((entry) => entry.city === city && entry.borough === borough && entry.slug === value)?.slug ?? null;
}

export function neighborhoodLabel(value: string | null | undefined): string | null {
  return NEIGHBORHOODS.find((entry) => entry.slug === value)?.name ?? null;
}
