/* eslint-disable */
// @ts-nocheck - Deno Edge Function; Vite build excludes supabase directory

/**
 * Pure, deterministic venue matching for `reconcile-flyer`.
 *
 * No fuzzy libraries, no embeddings, no AI. Only conservative normalization
 * plus exact-name/address/city comparisons.
 */

export interface CandidateVenue {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
}

export interface VenueMatchResult {
  status: "exact" | "strong" | "ambiguous" | "none";
  match: { id: string; name: string; address: string | null; city: string | null } | null;
}

/** Unicode NFKC, lowercase, trim, collapse whitespace. */
export function normalizeText(value: string | null | undefined): string {
  if (value == null) return "";
  return value.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
}

/** Normalize a venue name. Conservative — no substring collapsing. */
export function normalizeVenueName(value: string | null | undefined): string {
  return normalizeText(value);
}

/** Normalize an address for comparison. Suffix expansion only. */
const ADDRESS_SUFFIX_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bst\b/gi, "street"],
  [/\bave\b/gi, "avenue"],
  [/\bav\b/gi, "avenue"],
  [/\brd\b/gi, "road"],
  [/\bblvd\b/gi, "boulevard"],
  [/\bblv\b/gi, "boulevard"],
  [/\bct\b/gi, "court"],
  [/\bpl\b/gi, "place"],
  [/\bln\b/gi, "lane"],
  [/\bdr\b/gi, "drive"],
  [/\btrl\b/gi, "trail"],
  [/\bpky\b/gi, "parkway"],
  [/\bway\b/gi, "way"],
];

export function normalizeAddress(value: string | null | undefined): string {
  let normalized = normalizeText(value);
  for (const [pattern, replacement] of ADDRESS_SUFFIX_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement);
  }
  return normalized;
}

/**
 * Deterministic venue matcher.
 *
 * Rules (in order):
 *  1. No name → none.
 *  2. No candidate with matching normalized name → none.
 *  3. Exactly one candidate with matching normalized name AND matching
 *     normalized address → exact.
 *  4. Same normalized name, same city (when both present), exactly one
 *     candidate → strong.
 *  5. Otherwise → ambiguous (multiple plausible candidates).
 */
export function matchVenue(
  extractedName: string | null | undefined,
  extractedAddress: string | null | undefined,
  extractedCity: string | null | undefined,
  candidates: CandidateVenue[]
): VenueMatchResult {
  const name = normalizeVenueName(extractedName);
  if (!name) {
    return { status: "none", match: null };
  }

  const addr = normalizeAddress(extractedAddress);
  const city = normalizeText(extractedCity);

  const nameMatches = candidates.filter((c) => normalizeVenueName(c.name) === name);

  if (nameMatches.length === 0) {
    return { status: "none", match: null };
  }

  // Exact: name + address match.
  if (addr) {
    const exactMatches = nameMatches.filter((c) => {
      const candAddr = normalizeAddress(c.address_line1 ?? "");
      return candAddr === addr;
    });
    if (exactMatches.length === 1) {
      const m = exactMatches[0];
      return {
        status: "exact",
        match: {
          id: m.id,
          name: m.name,
          address: m.address_line1 ?? null,
          city: m.city ?? null,
        },
      };
    }
    // Address provided but no unique exact match → ambiguous.
    return { status: "ambiguous", match: null };
  }
  // Strong: same name, same city, exactly one candidate.
  if (city) {
    const cityMatches = nameMatches.filter((c) => {
      const candCity = normalizeText(c.city ?? "");
      return candCity === city;
    });
    if (cityMatches.length === 1) {
      const m = cityMatches[0];
      return {
        status: "strong",
        match: {
          id: m.id,
          name: m.name,
          address: m.address_line1 ?? null,
          city: m.city ?? null,
        },
      };
    }
  }

  // Ambiguous: multiple name matches.
  return { status: "ambiguous", match: null };
}
