// Phase 4 — conservative normalization utilities.
//
// The only job here is to make two independently-authored strings (one printed
// on a flyer, one in the canonical record) comparable deterministically. We do
// NOT aggressively strip meaningful words: "Havana Club" and
// "Havana Club Cambridge" normalize to DIFFERENT strings, so neither can be
// mistaken for the other. Matching strength comes from composite signals
// (name + city, name + address) handled by the matchers, not from fuzzy
// deletion of tokens.

/** Normalize a venue/organizer name for comparison. */
export function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value
    .normalize("NFKC")
    .toLowerCase()
    // Keep letters/numbers/spaces; drop punctuation, accents handled by NFKC.
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length > 0 ? normalized : null;
}

// Conservative street-suffix expansion. Both sides of a comparison are run
// through this, so "288 Green St" and "288 Green Street" become equal without
// geocoding. Only unambiguous abbreviations are expanded; "st" as in "Saint"
// is rare in an address token and the risk is symmetric (both normalized).
const STREET_SUFFIXES: Record<string, string> = {
  st: "street",
  str: "street",
  ave: "avenue",
  av: "avenue",
  rd: "road",
  blvd: "boulevard",
  ln: "lane",
  dr: "drive",
  ct: "court",
  pl: "place",
  sq: "square",
  pkwy: "parkway",
  pky: "parkway",
  terr: "terrace",
  hwy: "highway",
  ste: "suite",
  apt: "apartment",
  fl: "floor",
};

function expandSuffix(token: string): string {
  return STREET_SUFFIXES[token] ?? token;
}

/** Normalize a street address for comparison (conservative; no geocoding). */
export function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const collapsed = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return null;
  const expanded = collapsed
    .split(/\s+/)
    .map(expandSuffix)
    .join(" ");
  return expanded.length > 0 ? expanded : null;
}

/** Normalize an Instagram handle to a bare, lowercased identifier. */
export function normalizeInstagramHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  let cleaned = handle
    .trim()
    .replace(/^@/, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "");
  // Also accept an instagram.com URL form, e.g. "instagram.com/salsaycontrol".
  const urlMatch = /instagram\.com\/([a-z0-9._]+)/i.exec(handle.trim());
  if (urlMatch) cleaned = urlMatch[1].toLowerCase().replace(/[^a-z0-9._]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

/** Extract the bare domain (no scheme, no leading www) from a URL-ish string. */
export function normalizeDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  let candidate = url.trim();
  if (!/^https?:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const host = new URL(candidate).hostname.toLowerCase().replace(/^www\./, "");
    return host.length > 0 ? host : null;
  } catch {
    return null;
  }
}
