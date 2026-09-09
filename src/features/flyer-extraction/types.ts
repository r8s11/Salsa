// Shared contract for AI flyer extraction (Phase 2 of the Flyer → Event track).
//
// The frontend never contains provider-specific logic: it calls
// `extractEventFromFlyer()` (see ./client.ts), which POSTs to the
// `extract-flyer` Supabase Edge Function. The function returns a JSON object
// matching this schema. This file is the single source of truth for both the
// request/response shape and the runtime validation applied before display.

export type FieldConfidence = "high" | "medium" | "low";

/**
 * Parallel per-field confidence reported by the Phase 2 AI.
 * Each member is optional: the AI emits confidence only for fields it
 * actually populated. Missing entries are treated as "not reported" and
 * default to "medium" in the review layer, never to "high".
 */
export interface ExtractionConfidence {
  title: FieldConfidence | null;
  date: FieldConfidence | null;
  start_time: FieldConfidence | null;
  end_time: FieldConfidence | null;
  venue_name: FieldConfidence | null;
  address: FieldConfidence | null;
  city: FieldConfidence | null;
  dance_styles: FieldConfidence | null;
  event_type: FieldConfidence | null;
  price: FieldConfidence | null;
  organizer_name: FieldConfidence | null;
  instagram: FieldConfidence | null;
  website: FieldConfidence | null;
  details: FieldConfidence | null;
}

/**
 * Structured event information extracted from a single dance flyer.
 *
 * Every field is optional / nullable: a flyer may only show a title and date,
 * and that is still a successful extraction. Phase 3 can normalize values when
 * applying them to the canonical event form; Phase 2 only surfaces what the
 * flyer actually says.
 */
export interface ExtractedEvent {
  /** Event title, e.g. "Havana Nights Social". */
  title: string | null;
  /** ISO date (YYYY-MM-DD) when known, otherwise null. */
  date: string | null;
  /** 24h start time (HH:MM) when known, otherwise null. */
  start_time: string | null;
  /** 24h end time (HH:MM) when known, otherwise null. Overnight (end < start) is valid. */
  end_time: string | null;
  /** Venue name as printed, e.g. "Havana Club". */
  venue_name: string | null;
  /** Street address as printed. */
  address: string | null;
  /** City as printed. */
  city: string | null;
  /** Free-form dance-style labels (e.g. "Salsa", "On2"); no taxonomy yet. */
  dance_styles: string[];
  /** Free-form event type (e.g. "social", "festival"). */
  event_type: string | null;
  /** Raw pricing text (may contain multiple tiers); not a single normalized number. */
  price: string | null;
  /** Presenter / host name if printed. */
  organizer_name: string | null;
  /** Instagram handle if printed (may or may not include leading @). */
  instagram: string | null;
  /** Ticket / website link if printed, otherwise null. */
  website: string | null;
  /** Additional schedule or useful notes, e.g. "Doors 7 PM", "Beginner lesson 8 PM". */
  details: string[];
  /** Per-field AI confidence (Phase 5). Missing entries are treated as not reported. */
  confidence: ExtractionConfidence | null;
}

export type ExtractedEventField = keyof ExtractedEvent;

const STRING_FIELDS: ExtractedEventField[] = [
  "title",
  "date",
  "start_time",
  "end_time",
  "venue_name",
  "address",
  "city",
  "event_type",
  "price",
  "organizer_name",
  "instagram",
  "website",
];

const ARRAY_FIELDS: ExtractedEventField[] = ["dance_styles", "details"];

/**
 * Strip anything that looks like an HTML/XML tag and collapse whitespace so a
 * poisoned flyer cannot inject markup into our (text-only) result panel.
 */
function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    // Accept a single loose string as one entry.
    const single = sanitizeText(value);
    return single ? [single] : [];
  }
  const out: string[] = [];
  for (const item of value) {
    const cleaned = sanitizeText(item);
    if (cleaned) out.push(cleaned);
  }
  return out;
}

/**
 * Coerce an unknown (parsed) JSON payload from the Edge Function into a
 * validated {@link ExtractedEvent}. Missing or malformed fields degrade to
 * null / empty rather than throwing, so partial extractions still render.
 */
export function validateExtractedEvent(raw: unknown): ExtractedEvent {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};

  const coerceConfidence = (confidence: unknown): ExtractionConfidence | null => {
    if (!confidence || typeof confidence !== "object") return null;
    const obj = confidence as Record<string, unknown>;
    const allowed = new Set<string>([
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
    ]);
    for (const k of Object.keys(obj)) {
      if (!allowed.has(k)) return null;
    }
    const out: ExtractionConfidence = {
      title: null,
      date: null,
      start_time: null,
      end_time: null,
      venue_name: null,
      address: null,
      city: null,
      dance_styles: null,
      event_type: null,
      price: null,
      organizer_name: null,
      instagram: null,
      website: null,
      details: null,
    };
    const setIfValid = (key: keyof ExtractionConfidence, value: unknown) => {
      if (value === "high" || value === "medium" || value === "low") out[key] = value;
    };
    setIfValid("title", obj.title);
    setIfValid("date", obj.date);
    setIfValid("start_time", obj.start_time);
    setIfValid("end_time", obj.end_time);
    setIfValid("venue_name", obj.venue_name);
    setIfValid("address", obj.address);
    setIfValid("city", obj.city);
    setIfValid("dance_styles", obj.dance_styles);
    setIfValid("event_type", obj.event_type);
    setIfValid("price", obj.price);
    setIfValid("organizer_name", obj.organizer_name);
    setIfValid("instagram", obj.instagram);
    setIfValid("website", obj.website);
    setIfValid("details", obj.details);
    return Object.values(out).every((v) => v === null) ? null : out;
  };

  let confidence: ExtractionConfidence | null = null;
  if (source.confidence !== undefined) {
    confidence = coerceConfidence(source.confidence);
  }

  const result: ExtractedEvent = {
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
    confidence,
  };

  for (const field of STRING_FIELDS) {
    (result[field] as string | null) = sanitizeText(source[field]);
  }
  for (const field of ARRAY_FIELDS) {
    (result[field] as string[]) = sanitizeStringArray(source[field]);
  }

  return result;
}

/** Count of fields that actually carry extracted information. */
export function countExtractedDetails(event: ExtractedEvent): number {
  let count = 0;
  if (event.title) count += 1;
  if (event.date) count += 1;
  if (event.start_time || event.end_time) count += 1;
  if (event.venue_name) count += 1;
  if (event.address || event.city) count += 1;
  if (event.dance_styles.length > 0) count += 1;
  if (event.event_type) count += 1;
  if (event.price) count += 1;
  if (event.organizer_name) count += 1;
  if (event.instagram) count += 1;
  if (event.website) count += 1;
  if (event.details.length > 0) count += 1;
  return count;
}

/** True when the flyer yielded no usable information at all. */
export function isEmptyExtraction(event: ExtractedEvent): boolean {
  return countExtractedDetails(event) === 0;
}
