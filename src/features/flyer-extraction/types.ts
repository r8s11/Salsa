export const EXTRACTION_FIELDS = [
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
] as const;

export type ExtractedEvent = {
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
};

export type ExtractFlyerResponse = { extraction: ExtractedEvent };

/** Lifecycle of one extraction attempt for the currently persisted flyer. */
export type FlyerExtractionStatus = "idle" | "loading" | "success" | "error";

type StringField = Exclude<(typeof EXTRACTION_FIELDS)[number], "dance_styles" | "details">;
const STRING_FIELDS: readonly StringField[] = [
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

const MAX_TEXT_LENGTH = 500;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join("")
    .trim();
  return cleaned ? cleaned.slice(0, MAX_TEXT_LENGTH) : null;
}

function cleanArray(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid flyer extraction field: ${field}`);
  const values: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const cleaned = cleanText(item);
    if (!cleaned) continue;
    const key = cleaned.toLocaleLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      values.push(cleaned);
    }
  }
  return values;
}

// Flyers print bare domains ("salsasegura.com") far more often than full URLs,
// and `new URL` rejects those outright. Assume https for a scheme-less value
// that still looks like a hostname, and reject anything that is not http(s).
function cleanWebsite(value: string | null): string | null {
  if (!value) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(parsed.hostname)) return null;
  return candidate;
}

export function parseFlyerExtraction(raw: unknown): ExtractedEvent {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid flyer extraction");
  }
  const source = raw as Record<string, unknown>;
  for (const key of Object.keys(source)) {
    if (!(EXTRACTION_FIELDS as readonly string[]).includes(key)) {
      throw new Error("Invalid flyer extraction");
    }
  }

  const result = {
    title: null,
    date: null,
    start_time: null,
    end_time: null,
    venue_name: null,
    address: null,
    city: null,
    dance_styles: cleanArray(source.dance_styles ?? [], "dance_styles"),
    event_type: null,
    price: null,
    organizer_name: null,
    instagram: null,
    website: null,
    details: cleanArray(source.details ?? [], "details"),
  } as ExtractedEvent;

  for (const field of STRING_FIELDS) {
    const value = source[field];
    if (value !== undefined && value !== null && typeof value !== "string") {
      throw new Error(`Invalid flyer extraction field: ${field}`);
    }
    result[field] = cleanText(value);
  }

  // Mirrors the edge function: one unreadable value costs the user that field,
  // not the whole prefill. A structurally wrong payload still throws above.
  if (result.date && !DATE_PATTERN.test(result.date)) result.date = null;
  if (result.start_time && !TIME_PATTERN.test(result.start_time)) result.start_time = null;
  if (result.end_time && !TIME_PATTERN.test(result.end_time)) result.end_time = null;
  result.website = cleanWebsite(result.website);
  return result;
}
