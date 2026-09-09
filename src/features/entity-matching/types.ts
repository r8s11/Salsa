// Phase 4 — Entity matching shared types.
//
// Matching is deterministic and candidate-driven: every matcher receives an
// explicit list of canonical candidates and returns a structured result with a
// reliability level. The matchers never touch the database or the network; the
// candidate set is supplied by a server-side lookup (see ./client.ts → the
// `reconcile-flyer` Edge Function) so that RLS on venues/organizers is never
// weakened for the client.

import type { EventType } from "../events/model/types";

/** Reliability of a match. Drives whether a canonical entity may be applied. */
export type MatchStatus = "exact" | "strong" | "ambiguous" | "none";

/**
 * A canonical venue as the matcher needs it. `normalized_name` is optional
 * (the matcher normalizes `name` itself when the column is absent) and `status`
 * lets the caller restrict matching to trustworthy rows (e.g. "active").
 */
export interface VenueCandidate {
  id: string;
  name: string;
  normalized_name: string | null;
  address_line1: string | null;
  city: string | null;
  status: string;
}

/** A canonical organizer brand as the matcher needs it. */
export interface OrganizerCandidate {
  id: string;
  name: string;
  slug: string | null;
  instagram: string | null;
  website: string | null;
  status: string;
}

export interface VenueMatch {
  status: MatchStatus;
  venue_id?: string;
  venue_name?: string;
  city?: string;
  address?: string;
  /** Which signals produced the match (e.g. ["name", "address"]). */
  matched_on?: string[];
  /** Candidate summaries when the match is ambiguous (never auto-applied). */
  candidates?: { id: string; name: string; city?: string }[];
}

export interface OrganizerMatch {
  status: MatchStatus;
  organizer_id?: string;
  name?: string;
  matched_on?: string[];
  candidates?: { id: string; name: string }[];
}

/** One extracted dance-style label mapped to (possibly) a known taxonomy slug. */
export interface StyleReconciliation {
  raw: string;
  slug: string | null;
}

export interface EventTypeReconciliation {
  raw: string | null;
  slug: EventType | null;
}

/** The full Phase 4 reconciliation of one extracted flyer. */
export interface ReconciledExtraction {
  venue: VenueMatch;
  organizer: OrganizerMatch;
  dance_styles: StyleReconciliation[];
  event_type: EventTypeReconciliation;
}

/** Everything the reconciliation needs from the canonical data layer. */
export interface ReconcileInput {
  venueCandidates: VenueCandidate[];
  organizerCandidates: OrganizerCandidate[];
  knownDanceStyleSlugs: string[];
  knownEventTypes: string[];
}

/** Both "exact" and "strong" are safe to apply; ambiguous/none are not. */
export function isResolved(status: MatchStatus | undefined): status is "exact" | "strong" {
  return status === "exact" || status === "strong";
}
