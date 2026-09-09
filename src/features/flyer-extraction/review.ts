// Phase 5 — deterministic AI extraction review state.
//
// A pure, React-independent layer that turns an AI extraction + per-field
// confidence + Phase 4 reconciliation into a reviewable field list, applies the
// default accept/review/rejected rules, and produces the subset of fields a user
// has chosen to apply.
//
// Rules (spec §7–§8, §17, §32):
//  - high + valid                 → accepted          (quiet)
//  - medium + valid               → accepted  + "review suggested" affordance/flag
//  - low                         → "review" (not auto-applied when user chooses the
//                                   conservative path; included only via explicit
//                                   "Include all valid details")
//  - invalid (validation rejected) → rejected, no include control
//  - AI confidence is advisory: application validation and reconciliation
//    status outrank it (e.g. AI "high" on an impossible date → rejected).
//  - Ambiguous entity/taxonomy match does not by itself invalidate the raw
//    extracted value, but it upgrades the field's review cue so the user can
//    decide whether to keep the free-text form.
//
// ReviewState is the single source of truth for what the user wants applied.
// It is built once from extraction + reconciliation, then mutated only by the
// user's per-field choices (or the "include all valid details" action).

import type { ExtractionConfidence, ExtractedEvent } from "./types";
import type { ReconciledExtraction } from "../entity-matching/types";
import type { EventFormDraft } from "../events/components/EventForm/types";
import { applyExtractionToEventForm } from "./applyExtraction";

// ── Field-level review model ────────────────────────────────────────────────

export type ReviewStatus =
  | "accepted"   // user (or default rule) wants this suggestion applied
  | "review"     // present-but-uncertain: shown with a cue, not auto-applied
                   // in the conservative path; eligible for "include all valid"
  | "rejected"   // explicitly excluded by the user, or invalid
  | "invalid";   // structurally invalid — no include control, manual entry only

export interface ReviewField {
  /** extraction key (matches ExtractedEvent keys) */
  key: ExtractedEvent["confidence"] extends ExtractConfidenceMap
    ? keyof ExtractConfidenceMap
    : never;
  /** human label used in the review UI (friendly, not AI jargon) */
  label: string;
  /** the value shown and eligible for apply — null/empty when not present */
  value: string | string[] | null;
  /** AI confidence for this field, or null when the AI did not report one */
  confidence: ExtractionConfidence[keyof ExtractionConfidence] | null;
  status: ReviewStatus;
  /** why the field is not transferable (invalid date, ambiguous entity, etc.) */
  reason?: string;
  /** when the field is an array (dance_styles/details), the per-item display rows */
  items?: { value: string; note?: string }[];
}

// ExtractedEvent confidence keys, as a narrow mapped type for ReviewField.key.
export type ExtractConfidenceMap = ExtractedEvent["confidence"];

// ── Build review state from extraction + reconciliation ─────────────────────

export interface ReviewState {
  fields: ReviewField[];
  /** How many fields the user has currently marked for apply (accepted). */
  acceptedCount: number;
  /** How many populated fields are neither accepted nor invalid (i.e. still in
   *  "review" pending a decision). */
  pendingReviewCount: number;
  /** Total populated extractable fields present on the flyer. */
  totalPresent: number;
}

export type ReviewFieldKey =
  | "title"
  | "date"
  | "start_time"
  | "end_time"
  | "venue_name"
  | "address"
  | "city"
  | "dance_styles"
  | "event_type"
  | "price"
  | "organizer_name"
  | "instagram"
  | "website"
  | "details";

const REVIEW_FIELD_ORDER: ReviewFieldKey[] = [
  "title",
  "date",
  "start_time",
  "end_time",
  "venue_name",
  "address",
  "city",
  "dance_styles",
  "event_type",
  "price",
  "organizer_name",
  "instagram",
  "website",
  "details",
];

const LABELS: Record<ReviewFieldKey, string> = {
  title: "Event",
  date: "Date",
  start_time: "Start time",
  end_time: "End time",
  venue_name: "Venue",
  address: "Address",
  city: "City",
  dance_styles: "Dance styles",
  event_type: "Event type",
  price: "Price",
  organizer_name: "Organizer",
  instagram: "Instagram",
  website: "Website",
  details: "Details",
};

// ── validations (mirrors applyExtraction so the review layer and the merge
//    layer agree on what is valid) ───────────────────────────────────────────

function isValidIsoDate(value: string | null): value is string {
  if (!value) return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isValidTime(value: string | null): value is string {
  if (!value) return false;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
}

function isValidUrl(value: string | null): value is string {
  if (!value) return false;
  try {
    const url = new URL(
      value.trim().startsWith("http") ? value.trim() : `https://${value.trim()}`
    );
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isFreeOrPaidPrice(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "free" || normalized.startsWith("free")) return true;
  return /\$/.test(normalized);
}

// ── helpers for formatted display values ─────────────────────────────────────

function fmtDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(value: string | null): string | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return value;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return value;
  const period = h >= 12 ? "PM" : "AM";
  const dh = h % 12 === 0 ? 12 : h % 12;
  return min === 0 ? `${dh}:00 ${period}` : `${dh}:${m[2]} ${period}`;
}

function fmtTimeRange(
  start: string | null,
  end: string | null
): { value: string; parts: string[] } | null {
  const p: string[] = [];
  if (start) p.push(fmtTime(start) ?? start);
  if (end) p.push(fmtTime(end) ?? end);
  if (p.length === 0) return null;
  return { value: p.join(" – "), parts: p };
}

function fmtVenue(event: ExtractedEvent): string | null {
  const lines: string[] = [];
  if (event.venue_name) lines.push(event.venue_name);
  const addr = [event.address, event.city].filter(Boolean).join(", ");
  if (addr) lines.push(addr);
  return lines.length > 0 ? lines.join("\n") : null;
}

// ── build review fields ──────────────────────────────────────────────────────

function confidenceFor(
  confidence: ExtractionConfidence | null,
  key: ReviewFieldKey
): ExtractionConfidence[keyof ExtractionConfidence] | null {
  if (!confidence) return null;
  // confidence keys match extraction keys here (both use the same field names).
  return (confidence as Record<string, ExtractionConfidence[keyof ExtractionConfidence] | null>)[
    key
  ] ?? null;
}

function fieldFrom(
  key: ReviewFieldKey,
  event: ExtractedEvent,
  reconciliation: ReconciledExtraction | null
): ReviewField | null {
  const conf = confidenceFor(event.confidence, key);
  const label = LABELS[key];

  // Compute the reviewable value + display items per field kind.
  if (key === "title") {
    if (!event.title) return null;
    return singleField(key, label, event.title, conf);
  }
  if (key === "date") {
    if (!event.date) return null;
    const valid = isValidIsoDate(event.date);
    const fmt = fmtDate(event.date);
    return singleField(key, label, fmt, conf, valid, valid
      ? undefined
      : "Couldn’t verify this date.");
  }
  if (key === "start_time") {
    if (!event.start_time) return null;
    const valid = isValidTime(event.start_time);
    return singleField(key, label, fmtTime(event.start_time) ?? event.start_time, conf, valid, valid
      ? undefined
      : "Couldn’t verify this start time.");
  }
  if (key === "end_time") {
    if (!event.end_time) return null;
    const valid = isValidTime(event.end_time);
    return singleField(
      key,
      label,
      fmtTime(event.end_time) ?? event.end_time,
      conf,
      valid,
      valid ? undefined : "Couldn’t verify this end time."
    );
  }
  if (key === "venue_name") {
    if (!event.venue_name && !event.address && !event.city) return null;
    const venueText = fmtVenue(event);
    if (!venueText) return null;
    const entityStatus = reconciliation?.venue?.status ?? "none";
    const entityResolved = entityStatus === "exact" || entityStatus === "strong";
    const entityAmbiguous = entityStatus === "ambiguous";
    const cue: ReviewField["reason"] =
      entityResolved && entityStatus === "exact"
        ? "Matched to an existing SalsaSegura venue."
        : entityResolved && entityStatus === "strong"
        ? "Likely matches an existing SalsaSegura venue."
        : entityAmbiguous
        ? "Couldn’t verify which existing venue this refers to."
        : undefined;
    // When the AI was confident about the venue text but reconciliation could
    // not resolve it to a canonical venue, nudge the user to review.
    const effectiveStatus = computeStatus(conf, true, false, entityAmbiguous ? "review" : "accepted");
    return {
      key,
      label,
      value: venueText,
      confidence: conf,
      status: entityAmbiguous ? "review" : effectiveStatus,
      reason: cue,
    };
  }
  if (key === "address") {
    if (!event.address) return null;
    return singleField(key, label, event.address, conf);
  }
  if (key === "city") {
    if (!event.city) return null;
    return singleField(key, label, event.city, conf);
  }
  if (key === "dance_styles") {
    if (event.dance_styles.length === 0) return null;
    const items: { value: string; note?: string }[] = [];
    const byIndex = new Map(
      reconciliation?.dance_styles?.map((d, i) => [i, d]) ??
        []
    );
    event.dance_styles.forEach((raw, i) => {
      const reconciled = byIndex.get(i);
      items.push({
        value: raw,
        note: reconciled?.slug
          ? `Categorized as ${reconciled.slug}`
          : undefined,
      });
    });
    return {
      key,
      label,
      value: event.dance_styles,
      confidence: conf,
      status: computeStatus(conf, true, false, "accepted"),
      items,
    };
  }
  if (key === "event_type") {
    if (!event.event_type) return null;
    const reconciled = reconciliation?.event_type;
    const categorized = reconciled?.slug
      ? `Categorized as ${reconciled.slug}`
      : undefined;
    const ambiguous =
      reconciled?.slug === null && event.event_type && !isKnownEventType(event.event_type)
        ? "Couldn’t match this to a SalsaSegura event type."
        : undefined;
    return {
      key,
      label,
      value: event.event_type,
      confidence: conf,
      status: ambiguous ? "review" : computeStatus(conf, true, false, "accepted"),
      reason: categorized ?? ambiguous,
    };
  }
  if (key === "price") {
    if (!event.price) return null;
    const valid = isFreeOrPaidPrice(event.price);
    return singleField(
      key,
      label,
      event.price,
      conf,
      valid,
      !valid
        ? "Pricing was difficult to read — check this value."
        : undefined
    );
  }
  if (key === "organizer_name") {
    if (!event.organizer_name) return null;
    const orgStatus = reconciliation?.organizer?.status ?? "none";
    const orgResolved = orgStatus === "exact" || orgStatus === "strong";
    const cue =
      orgResolved && reconciliation?.organizer?.name
        ? `Matched organizer: ${reconciliation.organizer.name}`
        : undefined;
    // Phases 1–4 keep hostAndContact:false, so we never imply the organizer is
    // attached to the event — just that an organizer name was read.
    return {
      key,
      label,
      value: event.organizer_name,
      confidence: conf,
      status: orgResolved ? "accepted" : computeStatus(conf, true, false, "accepted"),
      reason: cue,
    };
  }
  if (key === "instagram") {
    if (!event.instagram) return null;
    return singleField(key, label, event.instagram, conf);
  }
  if (key === "website") {
    if (!event.website) return null;
    const valid = isValidUrl(event.website);
    return singleField(
      key,
      label,
      event.website,
      conf,
      valid,
      valid ? undefined : "Couldn’t verify this link."
    );
  }
  if (key === "details") {
    if (event.details.length === 0) return null;
    return {
      key,
      label,
      value: event.details,
      confidence: conf,
      status: computeStatus(conf, true, false, "accepted"),
      items: event.details.map((v) => ({ value: v })),
    };
  }
  return null;
}

function isKnownEventType(raw: string): boolean {
  return ["social", "class", "workshop"].includes(raw.toLowerCase());
}

function singleField(
  key: ReviewFieldKey,
  label: string,
  value: string,
  confidence: ExtractionConfidence[keyof ExtractionConfidence] | null,
  valid: boolean,
  reason?: string
): ReviewField {
  const status =
    !valid
      ? "invalid"
      : computeStatus(confidence, true, false, "accepted");
  return { key, label, value, confidence, status, reason };
}

// ── status derivation ────────────────────────────────────────────────────────
// defaultBehavior: "conservative" (low = review, not accepted) or "include" (as
// used by "Include all valid details").
export type DefaultBehavior = "conservative" | "include";

export function computeStatus(
  confidence: ExtractionConfidence[keyof ExtractionConfidence] | null,
  present: boolean,
  invalid: boolean,
  baseWhenAbsent: ReviewStatus
): ReviewStatus {
  if (!present) return baseWhenAbsent;
  if (invalid) return "invalid";
  if (confidence === "high") return "accepted";
  if (confidence === "medium") return "accepted"; // accepted, but flagged "review suggested"
  // low, or confidence not reported: treat as "review" in the conservative path.
  return baseWhenAbsent === "accepted" ? "review" : "review";
}

// ── build the full review state ──────────────────────────────────────────────

export function buildFlyerReviewState(
  event: ExtractedEvent,
  reconciliation: ReconciledExtraction | null
): ReviewState {
  const fields: ReviewField[] = [];
  for (const key of REVIEW_FIELD_ORDER) {
    const f = fieldFrom(key, event, reconciliation);
    if (f) fields.push(f);
  }
  const acceptedCount = fields.filter((f) => f.status === "accepted").length;
  const pendingReviewCount = fields.filter(
    (f) => f.status === "review" || f.status === "rejected"
  ).length;
  const totalPresent = fields.length;
  return { fields, acceptedCount, pendingReviewCount, totalPresent };
}

// ── mutation helpers (pure, return a new ReviewState) ───────────────────────

export function toggleReviewField(
  state: ReviewState,
  key: ReviewFieldKey,
  accepted: boolean
): ReviewState {
  const fields = state.fields.map((f) => {
    if (f.key !== key) return f;
    if (f.status === "invalid") return f; // no-op on invalid fields
    return { ...f, status: accepted ? "accepted" : "rejected" };
  });
  return recomputeCounts(fields);
}

export function setAllValidAccepted(state: ReviewState): ReviewState {
  const fields = state.fields.map((f) => {
    if (f.status === "invalid") return f;
    return { ...f, status: "accepted" };
  });
  return recomputeCounts(fields);
}

function recomputeCounts(fields: ReviewField[]): ReviewState {
  const acceptedCount = fields.filter((f) => f.status === "accepted").length;
  const pendingReviewCount = fields.filter(
    (f) => f.status === "review" || f.status === "rejected"
  ).length;
  return { fields, acceptedCount, pendingReviewCount, totalPresent: fields.length };
}

// ── produce the subset of the extraction the user has accepted ───────────────
// This returns a new ExtractedEvent where only accepted fields carry values and
// everything else is null/empty. applyExtractionToEventForm then consumes this
// exactly like a normal extraction — the merge layer already guards empty/user
// values, so an accepted field that the user has not filled in the form yet gets
// applied, and a rejected field is treated as absent (never clears the form).
export function createAcceptedExtraction(
  extraction: ExtractedEvent,
  review: ReviewState
): ExtractedEvent {
  const accepted: ExtractedEvent = {
    title: null,
    date: null,
    start_time: null,
    end_time: null,
    venue_name: null,
    address: null,
    city: null,
    dance_styles: [],
    event_type: null,
    price: null,
    organizer_name: null,
    instagram: null,
    website: null,
    details: [],
    confidence: extraction.confidence,
  };
  for (const field of review.fields) {
    if (field.status !== "accepted") continue;
    const v = field.value;
    if (v === null || v === undefined) continue;
    (accepted[field.key] as string | string[] | null) = v;
  }
  return accepted;
}

// ── apply accepted extraction to a form draft ────────────────────────────────
// Thin wrapper so the page/hook does not have to know about review details:
// accept-only subset → merge. Keeps applyExtractionToEventForm reusable and
// review-logic-free.
import type { ApplyOptions } from "./applyExtraction";

export function applyAcceptedToForm(
  draft: EventFormDraft,
  extraction: ExtractedEvent,
  review: ReviewState,
  reconciliation?: ReconciledExtraction | null
): EventFormDraft {
  const accepted = createAcceptedExtraction(extraction, review);
  // Gate canonical venue enrichment on the venue field actually being accepted
  // (the accepted extraction already nulls rejected venue_name, but add an
  // explicit guard so canonical address/city enrichment does not sneak in when
  // the user excluded the venue suggestion).
  const venueAccepted = review.fields.find((f) => f.key === "venue_name")?.status === "accepted";
  return applyExtractionToEventForm(draft, accepted, reconciliation, {
    venueAccepted,
  });
}
