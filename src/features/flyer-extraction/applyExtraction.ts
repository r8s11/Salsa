// Phase 3 — safe merge of AI extraction into the canonical event-form draft.
//
// applyExtractionToEventForm is the single mutation point that turns a validated
// ExtractedEvent (the "accepted" subset, produced by the review layer) into
// updates on EventFormDraft. It is deliberately conservative: it never clears a
// field the user has already filled in, and it only fills fields the form has
// not yet received a value for. Reconciliation enrichment (canonical
// venue/taxonomy IDs) is gated behind the review layer's acceptance flags.

import type { EventFormDraft } from "../events/components/EventForm/types";
import type { ExtractedEvent } from "./types";
import type { ReconciledExtraction } from "../entity-matching/types";

export interface ApplyOptions {
  /**
   * True when the user's review explicitly accepted the venue suggestion.
   * When undefined/false, canonical venue enrichment (address, city from the
   * matched venue) is NOT applied — only raw extracted text is used.
   */
  venueAccepted?: boolean;
}

function hasValue(value: string | string[] | undefined | null): boolean {
  if (!value) return false;
  if (Array.isArray(value)) return value.length > 0;
  return typeof value === "string" && value.trim().length > 0;
}

function applyString<T extends EventFormDraft>(
  draft: T,
  key: keyof T,
  value: string | null | undefined,
): T {
  if (!value || !value.trim()) return draft;
  if (hasValue(draft[key])) return draft; // user-edited value wins
  return { ...draft, [key]: value.trim() as T[keyof T] };
}

export function applyExtractionToEventForm(
  draft: EventFormDraft,
  extraction: ExtractedEvent,
  reconciliation: ReconciledExtraction | null,
  options: ApplyOptions = {},
): EventFormDraft {
  let result: EventFormDraft = { ...draft };

  // ── Title ────────────────────────────────────────────────────────────────
  result = applyString(result, "title", extraction.title);

  // ── Date & time ─────────────────────────────────────────────────────────
  if (extraction.date) {
    result = applyString(result, "event_date", extraction.date);
  }
  if (extraction.start_time) {
    result = applyString(result, "event_time", extraction.start_time);
  }

  // ── Venue ───────────────────────────────────────────────────────────────
  // When the user accepted the venue suggestion (or the function is called
  // directly without review gating), use reconciliation enrichment
  // (canonical address/city from the matched venue) if available. Otherwise
  // fall back to the raw extracted text.
  const useCanonicalVenue = options.venueAccepted !== false;
  if (extraction.venue_name) {
    if (useCanonicalVenue && reconciliation?.venue) {
      // Canonical venue wins when accepted + matched.
      const venue = reconciliation.venue;
      result = applyString(result, "location", venue.venue_name ?? extraction.venue_name);
      if (venue.address) result = applyString(result, "address", venue.address);
      if (venue.city) result = applyString(result, "city", venue.city);
    } else {
      result = applyString(result, "location", extraction.venue_name);
    }
  }
  // Even if venue was explicitly rejected, apply raw address/city if the user
  // hasn't filled them in (these are separate form fields).
  if (!useCanonicalVenue) {
    result = applyString(result, "address", extraction.address);
    result = applyString(result, "city", extraction.city);
  }

  // ── Dance styles ────────────────────────────────────────────────────────
  if (extraction.dance_styles.length > 0) {
    if (result.dance_styles.length === 0) {
      result = { ...result, dance_styles: extraction.dance_styles };
    }
  }

  // ── Event type ──────────────────────────────────────────────────────────
  if (extraction.event_type) {
    if (!hasValue(result.event_type)) {
      result = { ...result, event_type: extraction.event_type as EventFormDraft["event_type"] };
    }
  }

  // ── Price ───────────────────────────────────────────────────────────────
  if (extraction.price && !hasValue(result.price_amount)) {
    const cleaned = extraction.price.replace(/[$]/g, "").trim();
    const amount = parseFloat(cleaned.replace(/[^\d.]/g, ""));
    if (!isNaN(amount)) {
      result = { ...result, price_amount: String(amount) as EventFormDraft["price_amount"] };
    }
  }

  // ── Organizer ───────────────────────────────────────────────────────────
  // When the organizer is resolved to a canonical entity, append a "Presented by"
  // note to the description rather than overwriting the host field (Phases 1–4
  // keep hostAndContact:false for the submit flow). This applies whenever the
  // reconciliation reports a strong organizer match — it's a display affordance,
  // not a form-field overwrite.
  if (reconciliation?.organizer && reconciliation.organizer.status === "strong" && reconciliation.organizer.name) {
    const note = `Presented by: ${reconciliation.organizer.name}`;
    if (!hasValue(result.description)) {
      result = { ...result, description: note };
    }
  } else if (extraction.organizer_name && !hasValue(result.host)) {
    result = applyString(result, "host", extraction.organizer_name);
  }

  // ── Contact links ───────────────────────────────────────────────────────
  result = applyString(result, "contact_instagram", extraction.instagram);
  result = applyString(result, "contact_website", extraction.website);

  return result;
}
