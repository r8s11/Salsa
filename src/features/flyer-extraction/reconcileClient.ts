// Phase 4 — client wrapper around the `reconcile-flyer` Edge Function.
//
// The frontend never reads venues/organizers directly (admin-only RLS); it
// sends the AI extraction to the server, which returns a structured
// ReconciledExtraction. Failures degrade to a benign "no matches" result so the
// manual submission flow is never blocked.

import { supabase } from "../../lib/supabase";
import type { ExtractedEvent } from "./types";
import type {
  ReconciledExtraction,
} from "../entity-matching/types";

export type { ReconciledExtraction } from "../entity-matching/types";

interface ReconcileRequest {
  extraction: ExtractedEvent;
}

/** A safe default returned when the function is unreachable or errors. */
export const NO_RECONCILIATION: ReconciledExtraction = {
  venue: { status: "none" },
  organizer: { status: "none" },
  dance_styles: [],
  event_type: { raw: null, slug: null },
};

/**
 * Ask the server to reconcile an extracted flyer against canonical data.
 * @returns the reconciliation result (always resolves — never throws)
 */
export async function reconcileFlyerExtraction(
  extraction: ExtractedEvent
): Promise<ReconciledExtraction> {
  try {
    const { data, error } = await supabase.functions.invoke<unknown>("reconcile-flyer", {
      body: { extraction } satisfies ReconcileRequest,
    });
    if (error || data == null) return NO_RECONCILIATION;
    return coerceReconciliation(data);
  } catch {
    return NO_RECONCILIATION;
  }
}

function asStatus(value: unknown): ReconciledExtraction["venue"]["status"] {
  return value === "exact" || value === "strong" || value === "ambiguous" || value === "none"
    ? value
    : "none";
}

/** Defensive parse of the function response so a malformed payload can't crash the UI. */
function coerceReconciliation(raw: unknown): ReconciledExtraction {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const venue = (obj.venue ?? {}) as Record<string, unknown>;
  const organizer = (obj.organizer ?? {}) as Record<string, unknown>;

  const danceStyles = Array.isArray(obj.dance_styles)
    ? (obj.dance_styles as unknown[]).map((d) => {
        const item = (d ?? {}) as Record<string, unknown>;
        return {
          raw: typeof item.raw === "string" ? item.raw : "",
          slug: typeof item.slug === "string" ? item.slug : null,
        };
      })
    : [];

  const eventType = (obj.event_type ?? {}) as Record<string, unknown>;

  return {
    venue: {
      status: asStatus(venue.status),
      venue_id: typeof venue.venue_id === "string" ? venue.venue_id : undefined,
      venue_name: typeof venue.venue_name === "string" ? venue.venue_name : undefined,
      city: typeof venue.city === "string" ? venue.city : undefined,
      address: typeof venue.address === "string" ? venue.address : undefined,
      matched_on: Array.isArray(venue.matched_on)
        ? (venue.matched_on as string[]).filter((x) => typeof x === "string")
        : undefined,
      candidates: Array.isArray(venue.candidates)
        ? (venue.candidates as Record<string, unknown>[]).map((c) => ({
            id: String(c.id ?? ""),
            name: String(c.name ?? ""),
            city: typeof c.city === "string" ? c.city : undefined,
          }))
        : undefined,
    },
    organizer: {
      status: asStatus(organizer.status),
      organizer_id: typeof organizer.organizer_id === "string" ? organizer.organizer_id : undefined,
      name: typeof organizer.name === "string" ? organizer.name : undefined,
      matched_on: Array.isArray(organizer.matched_on)
        ? (organizer.matched_on as string[]).filter((x) => typeof x === "string")
        : undefined,
      candidates: Array.isArray(organizer.candidates)
        ? (organizer.candidates as Record<string, unknown>[]).map((c) => ({
            id: String(c.id ?? ""),
            name: String(c.name ?? ""),
          }))
        : undefined,
    },
    dance_styles: danceStyles,
    event_type: {
      raw: typeof eventType.raw === "string" ? eventType.raw : null,
      slug: typeof eventType.slug === "string" ? (eventType.slug as never) : null,
    },
  };
}
