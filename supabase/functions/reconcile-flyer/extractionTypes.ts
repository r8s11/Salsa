// Edge Function: minimal ExtractedEvent validation mirror.
//
// The frontend already validates (see src/features/flyer-extraction/types.ts);
// this guards against a caller passing a malformed body so the matcher only
// ever sees the fields it expects. Degrades unknown/missing fields to null/[].

export interface ExtractedEvent {
  title: string | null;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue_name: string | null;
  address: string | null;
  city: string | null;
  dance_styles: string[];
  event_type: string | null;
  price: string | null;
  organizer_name: string | null;
  instagram: string | null;
  website: string | null;
  details: string[];
}

function sanitizeText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const stripped = value.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
  return stripped.length > 0 ? stripped : null;
}

function sanitizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
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

export function validateExtractedEvent(raw: unknown): ExtractedEvent {
  const source = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
  const getStr = (k: string): string | null => sanitizeText(source[k]);
  return {
    title: getStr("title"),
    date: getStr("date"),
    start_time: getStr("start_time"),
    end_time: getStr("end_time"),
    venue_name: getStr("venue_name"),
    address: getStr("address"),
    city: getStr("city"),
    dance_styles: sanitizeStringArray(source["dance_styles"]),
    event_type: getStr("event_type"),
    price: getStr("price"),
    organizer_name: getStr("organizer_name"),
    instagram: getStr("instagram"),
    website: getStr("website"),
    details: sanitizeStringArray(source["details"]),
  };
}
