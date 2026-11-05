import type { EntityMatch } from "./entityReview";

/** Address, place, and links that tell one existing record from another. */
export function matchContext(match: EntityMatch): string[] {
  const place = [match.city, match.state_region].filter(Boolean).join(", ");
  return [match.address, place, match.website, match.instagram].filter((part): part is string =>
    Boolean(part)
  );
}

/** Accessible name for a match button; adds place or address only when another match shares the name. */
export function matchLabel(
  match: EntityMatch,
  pool: EntityMatch[],
  noun: string,
  verb: string
): string {
  const shared = pool.some((other) => other.id !== match.id && other.name === match.name);
  const context = shared
    ? [match.city, match.state_region, match.address].filter(Boolean).join(", ")
    : "";
  return `${verb} ${match.name}${context ? ` (${context})` : ""} as the ${noun}`;
}
