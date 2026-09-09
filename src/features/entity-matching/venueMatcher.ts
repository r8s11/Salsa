// Phase 4 — canonical venue matcher.
//
// Deterministic, candidate-set driven. No Levenshtein, no phonetic matching:
// a flyer's "Havana Club" must NOT silently become "Havana Nights" or
// "Club Havana". Strength comes from combining independent signals:
//
//   exact   : normalized name + normalized address both match
//   strong   : normalized name + city match, with exactly ONE candidate
//   ambiguous: name matches but more than one candidate (or name+city yields
//              multiple candidates) — caller must NOT auto-apply
//   none     : no candidate matched on any reliable signal
//
// Only candidates whose status is in `allowedStatuses` (default "active") are
// considered, so needs_review/archived rows never produce a match.

import type { VenueCandidate, VenueMatch } from "./types";
import { normalizeAddress, normalizeName } from "./normalize";

const DEFAULT_ALLOWED_STATUSES = new Set(["active"]);

function statusAllowed(status: string, allowed: Set<string>): boolean {
  return allowed.has(status);
}

export interface VenueMatchOptions {
  allowedStatuses?: Set<string>;
}

/**
 * Attempt to resolve an extracted venue to a canonical record.
 *
 * @param extracted name / address / city as printed on the flyer
 * @param candidates canonical venue rows supplied by the caller (server-side)
 * @returns structured VenueMatch with a reliability status
 */
export function matchVenue(
  extracted: {
    venue_name: string | null;
    address: string | null;
    city: string | null;
  },
  candidates: VenueCandidate[],
  options: VenueMatchOptions = {}
): VenueMatch {
  const allowed = options.allowedStatuses ?? DEFAULT_ALLOWED_STATUSES;

  const normName = normalizeName(extracted.venue_name);
  const normAddress = normalizeAddress(extracted.address);
  const normCity = normalizeName(extracted.city);

  if (!normName) {
    return { status: "none" };
  }

  const eligible = candidates.filter((c) => statusAllowed(c.status, allowed));

  // Index canonical normals once.
  const rows = eligible.map((c) => ({
    candidate: c,
    normName: normalizeName(c.name),
    normAddress: normalizeAddress(c.address_line1),
    normCity: normalizeName(c.city),
  }));

  const nameMatches = rows.filter((r) => r.normName != null && r.normName === normName);

  if (nameMatches.length === 0) {
    return { status: "none" };
  }

  // ── exact: name + address ──
  const exactMatches = nameMatches.filter(
    (r) => normAddress != null && r.normAddress != null && r.normAddress === normAddress
  );
  if (exactMatches.length >= 1) {
    const best = exactMatches[0].candidate;
    return {
      status: "exact",
      venue_id: best.id,
      venue_name: best.name,
      city: best.city ?? undefined,
      address: best.address_line1 ?? undefined,
      matched_on: ["name", "address"],
    };
  }

  // ── strong: name + city, exactly one candidate ──
  if (normCity) {
    const nameCityMatches = nameMatches.filter(
      (r) => r.normCity != null && r.normCity === normCity
    );
    if (nameCityMatches.length === 1) {
      const best = nameCityMatches[0].candidate;
      return {
        status: "strong",
        venue_id: best.id,
        venue_name: best.name,
        city: best.city ?? undefined,
        address: best.address_line1 ?? undefined,
        matched_on: ["name", "city"],
      };
    }
    // Multiple candidates share the name in (or near) this city → ambiguous.
    if (nameCityMatches.length > 1) {
      return {
        status: "ambiguous",
        candidates: nameCityMatches.map((r) => ({
          id: r.candidate.id,
          name: r.candidate.name,
          city: r.candidate.city ?? undefined,
        })),
      };
    }
  }

  // Name matches one or many but city/address either absent or disagreeing.
  if (nameMatches.length === 1) {
    // A single global name match with no corroborating city/address is not
    // strong enough on its own — fall to ambiguous rather than guess.
    return {
      status: "ambiguous",
      candidates: nameMatches.map((r) => ({
        id: r.candidate.id,
        name: r.candidate.name,
        city: r.candidate.city ?? undefined,
      })),
    };
  }

  // Multiple name matches, no corroborating context → ambiguous.
  return {
    status: "ambiguous",
    candidates: nameMatches.map((r) => ({
      id: r.candidate.id,
      name: r.candidate.name,
      city: r.candidate.city ?? undefined,
    })),
  };
}
