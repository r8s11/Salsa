// Phase 4 — reconciliation orchestrator.
//
// Pure function: given an extracted flyer and the canonical candidate sets,
// produces a fully structured ReconciledExtraction. It does NOT mutate the form
// and does NOT touch the database — the caller (apply step) decides what to
// merge, preserving Phase 3 safe-merge rules and explicit user values.

import type {
  ExtractedEvent,
} from "../flyer-extraction/types";
import { matchOrganizer } from "./organizerMatcher";
import { matchVenue } from "./venueMatcher";
import {
  reconcileDanceStyles,
  reconcileEventType,
  type TaxonomyMatcherOptions,
} from "./taxonomyMatcher";
import type {
  OrganizerCandidate,
  ReconcileInput,
  ReconciledExtraction,
  VenueCandidate,
} from "./types";

export interface ReconcileOptions extends TaxonomyMatcherOptions {
  allowedVenueStatuses?: Set<string>;
  allowedOrganizerStatuses?: Set<string>;
}

/**
 * Run all Phase 4 matchers against one extraction.
 * Resilience contract: a match failure (e.g. empty candidate list) yields
 * status "none" / null slug — it never throws — so the caller can still fall
 * back to the manual free-text workflow.
 */
export function reconcileExtraction(
  extraction: ExtractedEvent,
  input: ReconcileInput,
  options: ReconcileOptions = {}
): ReconciledExtraction {
  const venue = matchVenue(
    {
      venue_name: extraction.venue_name,
      address: extraction.address,
      city: extraction.city,
    },
    input.venueCandidates as VenueCandidate[],
    { allowedStatuses: options.allowedVenueStatuses }
  );

  const organizer = matchOrganizer(
    {
      organizer_name: extraction.organizer_name,
      instagram: extraction.instagram,
      website: extraction.website,
    },
    input.organizerCandidates as OrganizerCandidate[],
    { allowedStatuses: options.allowedOrganizerStatuses }
  );

  const dance_styles = reconcileDanceStyles(extraction.dance_styles, options);
  const event_type = reconcileEventType(extraction.event_type, options);

  return { venue, organizer, dance_styles, event_type };
}

export { matchVenue, matchOrganizer, reconcileDanceStyles, reconcileEventType };
export { DANCE_STYLE_ALIASES, EVENT_TYPE_ALIASES } from "./taxonomyMatcher";
export type {
  VenueCandidate,
  OrganizerCandidate,
  VenueMatch,
  OrganizerMatch,
  MatchStatus,
  ReconciledExtraction,
  ReconcileInput,
  StyleReconciliation,
  EventTypeReconciliation,
} from "./types";
export { isResolved } from "./types";
