import type { City, EventType } from "../events/model/types";
import type { EventFormDraft } from "../events/components/EventForm";
import type { ExtractedEvent } from "./types";

/**
 * Maps a flyer extraction onto the submit-event draft. The extraction speaks
 * flyer text (free-form city names, "$20", "Social"); the form speaks enums,
 * slugs, and split price fields — this is the translation layer.
 *
 * Rules, all in service of "a wrong prefill is worse than a blank field":
 * - Free-text fields fill only when the draft's field is still empty, so
 *   anything the user already typed is never clobbered.
 * - Enum fields (`event_type`, `price_type`) fill only when still unset.
 * - `city` always has a value (the viewer's current city default, not typed
 *   work), so a confident locality match replaces it.
 * - Anything with a value that cannot be mapped confidently is reported in
 *   `skipped` for the UI notice — never guessed.
 */
export type PrefillResult = {
  draft: EventFormDraft;
  /** Human labels of fields the extraction filled, for the confirm notice. */
  filled: string[];
  /** Human labels of fields that had extraction values but no confident map. */
  skipped: string[];
};

const EVENT_TYPE_ALIASES: Record<string, EventType> = {
  social: "social",
  socials: "social",
  class: "class",
  classes: "class",
  lesson: "class",
  lessons: "class",
  workshop: "workshop",
  workshops: "workshop",
  intensive: "workshop",
  masterclass: "workshop",
};

/** Locality → City. Matched against the part before any comma. */
const CITY_LOCALITIES: Record<string, City> = {
  boston: "boston",
  cambridge: "boston",
  somerville: "boston",
  medford: "boston",
  brookline: "boston",
  newton: "boston",
  quincy: "boston",
  watertown: "boston",
  waltham: "boston",
  arlington: "boston",
  belmont: "boston",
  everett: "boston",
  chelsea: "boston",
  revere: "boston",
  malden: "boston",
  "greater boston": "boston",
  "new york": "new-york-city",
  "new york city": "new-york-city",
  nyc: "new-york-city",
  manhattan: "new-york-city",
  brooklyn: "new-york-city",
  queens: "new-york-city",
  bronx: "new-york-city",
  "staten island": "new-york-city",
};

/** The slug-chips `EventForm` offers on the submit surface. */
const DANCE_STYLE_ALIASES: Record<string, string> = {
  salsa: "salsa",
  bachata: "bachata",
  kizomba: "kizomba",
  merengue: "merengue",
  "cha-cha": "cha-cha",
  "cha cha": "cha-cha",
  chacha: "cha-cha",
  zouk: "zouk",
  "brazilian zouk": "zouk",
  "afro-cuban": "afro-cuban",
  "afro cuban": "afro-cuban",
  afrocuban: "afro-cuban",
};

const FREE_PRICE_PATTERN = /^(free|no\s+cover|cover\s+free)$/i;
const PAID_PRICE_PATTERN =
  /^\$?\s*(\d+(?:\.\d{1,2})?)(?:\s*(?:-|–|—|to|\/)\s*\$?\s*\d+(?:\.\d{1,2})?)?\s*(usd|dollars?)?$/i;

function mapDanceStyles(values: string[]): string[] {
  const mapped = values.map((value) => DANCE_STYLE_ALIASES[value.trim().toLowerCase()] ?? null);
  return mapped.filter((slug, index): slug is string => slug !== null && mapped.indexOf(slug) === index);
}

function mapEventType(value: string): EventType | null {
  return EVENT_TYPE_ALIASES[value.trim().toLowerCase()] ?? null;
}

function mapCity(value: string): City | null {
  const locality = value
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/\s+[a-z]{2}$/, "")
    .trim();
  return CITY_LOCALITIES[locality] ?? null;
}

function mapPrice(value: string): { price_type: "free" | "paid"; price_amount: string } | null {
  const trimmed = value.trim();
  if (FREE_PRICE_PATTERN.test(trimmed)) return { price_type: "free", price_amount: "" };
  const match = trimmed.match(PAID_PRICE_PATTERN);
  if (match) return { price_type: "paid", price_amount: match[1] };
  return null;
}

export function applyExtractionToDraft(
  extraction: ExtractedEvent,
  draft: EventFormDraft,
): PrefillResult {
  const next: EventFormDraft = { ...draft, dance_styles: [...draft.dance_styles] };
  const filled: string[] = [];
  const skipped: string[] = [];

  const fillText = (
    key: "title" | "description" | "location" | "address" | "rsvp_link",
    value: string | null,
    label: string,
  ) => {
    if (value && !next[key]) {
      next[key] = value;
      filled.push(label);
    }
  };

  fillText("title", extraction.title, "Title");

  if (extraction.details.length > 0 && !next.description) {
    next.description = extraction.details.join("\n\n");
    filled.push("Description");
  }

  if (extraction.event_type) {
    const mapped = mapEventType(extraction.event_type);
    if (mapped && !next.event_type) {
      next.event_type = mapped;
      filled.push("Event type");
    } else if (!mapped) {
      skipped.push("Event type");
    }
  }

  if (extraction.city) {
    const mapped = mapCity(extraction.city);
    if (mapped) {
      if (next.city !== mapped) {
        next.city = mapped;
        filled.push("City");
      }
    } else {
      skipped.push("City");
    }
  }

  if (extraction.date && !next.event_date) {
    next.event_date = extraction.date;
    filled.push("Date");
  }
  if (extraction.start_time && !next.event_time) {
    next.event_time = extraction.start_time;
    filled.push("Start time");
  }

  fillText("location", extraction.venue_name, "Venue");
  fillText("address", extraction.address, "Address");

  if (extraction.price && !next.price_type) {
    const mapped = mapPrice(extraction.price);
    if (mapped) {
      next.price_type = mapped.price_type;
      next.price_amount = mapped.price_amount;
      filled.push("Price");
    } else {
      skipped.push("Price");
    }
  }

  fillText("rsvp_link", extraction.website, "RSVP link");

  const mappedStyles = mapDanceStyles(extraction.dance_styles);
  const fresh = mappedStyles.filter((slug) => !next.dance_styles.includes(slug));
  if (fresh.length > 0) {
    next.dance_styles = [...next.dance_styles, ...fresh];
    filled.push("Dance styles");
  }
  if (
    extraction.dance_styles.length > 0 &&
    mappedStyles.length === 0
  ) {
    skipped.push("Dance styles");
  }

  return { draft: next, filled, skipped };
}
