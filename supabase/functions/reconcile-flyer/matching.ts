// Edge Function: Phase 4 reconciliation matcher (server copy).
//
// This is a deliberately small, dependency-free port of the frontend matcher so
// identity decisions run server-side with the service role. It mirrors
// src/features/entity-matching/* exactly in behavior. Keep the two in sync.

interface VenueCandidate {
  id: string;
  name: string;
  normalized_name: string | null;
  address_line1: string | null;
  city: string | null;
  status: string;
}

interface OrganizerCandidate {
  id: string;
  name: string;
  slug: string | null;
  instagram: string | null;
  website: string | null;
  status: string;
}

type MatchStatus = "exact" | "strong" | "ambiguous" | "none";

interface VenueMatch {
  status: MatchStatus;
  venue_id?: string;
  venue_name?: string;
  city?: string;
  address?: string;
  matched_on?: string[];
  candidates?: { id: string; name: string; city?: string }[];
}

interface OrganizerMatch {
  status: MatchStatus;
  organizer_id?: string;
  name?: string;
  matched_on?: string[];
  candidates?: { id: string; name: string }[];
}

interface StyleReconciliation {
  raw: string;
  slug: string | null;
}

interface EventTypeReconciliation {
  raw: string | null;
  slug: string | null;
}

interface ReconciledExtraction {
  venue: VenueMatch;
  organizer: OrganizerMatch;
  dance_styles: StyleReconciliation[];
  event_type: EventTypeReconciliation;
}

const DANCE_STYLE_ALIASES: Record<string, string> = {
  salsa: "salsa",
  "salsa dancing": "salsa",
  "salsa on1": "salsa",
  "salsa on2": "salsa",
  "salsa on1/on2": "salsa",
  "ny style salsa": "salsa",
  "new york salsa": "salsa",
  "new york style salsa": "salsa",
  mambo: "salsa",
  "cuban salsa": "salsa",
  casino: "salsa",
  bachata: "bachata",
  "bachata dancing": "bachata",
  "bachata sensual": "bachata",
  "dominican bachata": "bachata",
  "bachata moderna": "bachata",
  merengue: "merengue",
  "cha-cha": "cha-cha",
  "cha cha": "cha-cha",
  chacha: "cha-cha",
  "cha cha cha": "cha-cha",
  kizomba: "kizomba",
  "urban kiz": "kizomba",
  "urban kizomba": "kizomba",
  zouk: "zouk",
  "brazilian zouk": "zouk",
  "afro-cuban": "afro-cuban",
  "afro cuban": "afro-cuban",
};

const EVENT_TYPE_ALIASES: Record<string, string> = {
  social: "social",
  "social dance": "social",
  "social dancing": "social",
  "dance social": "social",
  party: "social",
  "dance party": "social",
  class: "class",
  lesson: "class",
  "dance class": "class",
  "group class": "class",
  workshop: "workshop",
  bootcamp: "workshop",
};

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

function normalizeName(value: string | null | undefined): string | null {
  if (!value) return null;
  const n = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return n.length > 0 ? n : null;
}

function expandSuffix(token: string): string {
  return STREET_SUFFIXES[token] ?? token;
}

function normalizeAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const collapsed = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!collapsed) return null;
  const expanded = collapsed.split(/\s+/).map(expandSuffix).join(" ");
  return expanded.length > 0 ? expanded : null;
}

function normalizeInstagramHandle(handle: string | null | undefined): string | null {
  if (!handle) return null;
  let cleaned = handle.trim().replace(/^@/, "").toLowerCase().replace(/[^a-z0-9._]/g, "");
  const urlMatch = /instagram\.com\/([a-z0-9._]+)/i.exec(handle.trim());
  if (urlMatch) cleaned = urlMatch[1].toLowerCase().replace(/[^a-z0-9._]/g, "");
  return cleaned.length > 0 ? cleaned : null;
}

function normalizeDomain(url: string | null | undefined): string | null {
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

function matchVenue(
  extracted: { venue_name: string | null; address: string | null; city: string | null },
  candidates: VenueCandidate[]
): VenueMatch {
  const normName = normalizeName(extracted.venue_name);
  const normAddress = normalizeAddress(extracted.address);
  const normCity = normalizeName(extracted.city);
  if (!normName) return { status: "none" };

  const rows = candidates.map((c) => ({
    candidate: c,
    normName: normalizeName(c.name),
    normAddress: normalizeAddress(c.address_line1),
    normCity: normalizeName(c.city),
  }));
  const nameMatches = rows.filter((r) => r.normName != null && r.normName === normName);
  if (nameMatches.length === 0) return { status: "none" };

  const exactMatches = nameMatches.filter(
    (r) => normAddress != null && r.normAddress != null && r.normAddress === normAddress
  );
  if (exactMatches.length >= 1) {
    const best = exactMatches[0].candidate;
    return { status: "exact", venue_id: best.id, venue_name: best.name, city: best.city ?? undefined, address: best.address_line1 ?? undefined, matched_on: ["name", "address"] };
  }

  if (normCity) {
    const nameCityMatches = nameMatches.filter((r) => r.normCity != null && r.normCity === normCity);
    if (nameCityMatches.length === 1) {
      const best = nameCityMatches[0].candidate;
      return { status: "strong", venue_id: best.id, venue_name: best.name, city: best.city ?? undefined, address: best.address_line1 ?? undefined, matched_on: ["name", "city"] };
    }
    if (nameCityMatches.length > 1) {
      return { status: "ambiguous", candidates: nameCityMatches.map((r) => ({ id: r.candidate.id, name: r.candidate.name, city: r.candidate.city ?? undefined })) };
    }
  }

  if (nameMatches.length === 1) {
    return { status: "ambiguous", candidates: nameMatches.map((r) => ({ id: r.candidate.id, name: r.candidate.name, city: r.candidate.city ?? undefined })) };
  }
  return { status: "ambiguous", candidates: nameMatches.map((r) => ({ id: r.candidate.id, name: r.candidate.name, city: r.candidate.city ?? undefined })) };
}

function matchOrganizer(
  extracted: { organizer_name: string | null; instagram: string | null; website: string | null },
  candidates: OrganizerCandidate[]
): OrganizerMatch {
  const normHandle = normalizeInstagramHandle(extracted.instagram);
  const normDomain = normalizeDomain(extracted.website);
  const normName = normalizeName(extracted.organizer_name);

  if (normHandle) {
    const byHandle = candidates.filter((c) => normalizeInstagramHandle(c.instagram) === normHandle);
    if (byHandle.length >= 1) {
      const best = byHandle[0];
      return { status: "strong", organizer_id: best.id, name: best.name, matched_on: ["instagram"] };
    }
  }
  if (normDomain) {
    const byDomain = candidates.filter((c) => normalizeDomain(c.website) === normDomain);
    if (byDomain.length >= 1) {
      const best = byDomain[0];
      return { status: "strong", organizer_id: best.id, name: best.name, matched_on: ["website"] };
    }
  }
  if (!normName) return { status: "none" };
  const byName = candidates.filter((c) => normalizeName(c.name) === normName);
  if (byName.length === 1) {
    const best = byName[0];
    return { status: "strong", organizer_id: best.id, name: best.name, matched_on: ["name"] };
  }
  if (byName.length > 1) {
    return { status: "ambiguous", candidates: byName.map((c) => ({ id: c.id, name: c.name })) };
  }
  return { status: "none" };
}

function reconcileDanceStyles(
  labels: string[],
  knownDanceStyleSlugs: string[]
): StyleReconciliation[] {
  const known = new Set(knownDanceStyleSlugs.map((s) => s.toLowerCase()));
  const seen = new Set<string>();
  const out: StyleReconciliation[] = [];
  for (const raw of labels) {
    const norm = normalizeName(raw);
    if (!norm || seen.has(norm)) continue;
    let slug: string | null = DANCE_STYLE_ALIASES[norm] ?? null;
    if (!slug && known.has(norm)) slug = norm;
    if (slug && known.has(slug) === false) slug = null;
    seen.add(norm);
    out.push({ raw, slug });
  }
  return out;
}

function reconcileEventType(raw: string | null, knownEventTypes: string[]): EventTypeReconciliation {
  if (!raw) return { raw: null, slug: null };
  const norm = normalizeName(raw);
  if (!norm) return { raw, slug: null };
  const allowed = new Set(knownEventTypes.map((t) => t.toLowerCase()));
  let slug: string | null = EVENT_TYPE_ALIASES[norm] ?? null;
  if (!slug && (norm === "social" || norm === "class" || norm === "workshop")) slug = norm;
  if (slug && !allowed.has(slug)) slug = null;
  return { raw, slug };
}

export function reconcileExtraction(
  extraction: {
    venue_name: string | null;
    address: string | null;
    city: string | null;
    organizer_name: string | null;
    instagram: string | null;
    website: string | null;
    dance_styles: string[];
    event_type: string | null;
  },
  input: {
    venueCandidates: VenueCandidate[];
    organizerCandidates: OrganizerCandidate[];
    knownDanceStyleSlugs: string[];
    knownEventTypes: string[];
  }
): ReconciledExtraction {
  return {
    venue: matchVenue(
      { venue_name: extraction.venue_name, address: extraction.address, city: extraction.city },
      input.venueCandidates
    ),
    organizer: matchOrganizer(
      { organizer_name: extraction.organizer_name, instagram: extraction.instagram, website: extraction.website },
      input.organizerCandidates
    ),
    dance_styles: reconcileDanceStyles(extraction.dance_styles, input.knownDanceStyleSlugs),
    event_type: reconcileEventType(extraction.event_type, input.knownEventTypes),
  };
}
