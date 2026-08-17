// Single source of truth for the CSV import column set. Drives the
// downloadable template, header validation in csvImportParse.ts, and the
// field list csvImportValidation.ts walks. Mirrors AdminEventPayload
// (eventsRepo.ts) — the exact shape createEventAsAdmin already accepts —
// so nothing here invents a parallel event model.

export interface CsvColumnSpec {
  key: string;
  required: boolean;
  /** Short, non-developer description shown in the on-page instructions. */
  help: string;
}

export const CSV_COLUMNS: CsvColumnSpec[] = [
  { key: "title", required: true, help: "Event name." },
  { key: "event_type", required: true, help: "One of: social, class, workshop." },
  { key: "event_date", required: true, help: "Date, format YYYY-MM-DD (e.g. 2026-09-15)." },
  { key: "city", required: true, help: "One of: boston, new-york-city." },
  {
    key: "event_time",
    required: false,
    help: "24-hour time, format HH:MM (e.g. 20:00). Leave blank if unknown.",
  },
  { key: "description", required: false, help: "Event description (up to 2000 characters)." },
  {
    key: "venue_name",
    required: false,
    help: "Name of an existing SalsaSegura venue, if it has one. Leave blank if not — location/address below still work on their own.",
  },
  { key: "location", required: false, help: "Venue name as free text (up to 300 characters)." },
  { key: "address", required: false, help: "Street address (up to 300 characters)." },
  { key: "price_type", required: false, help: "One of: free, paid. Leave blank if unknown." },
  {
    key: "price_amount",
    required: false,
    help: "Dollar amount. Required only when price_type is paid.",
  },
  { key: "rsvp_link", required: false, help: "Full URL starting with http:// or https://." },
  { key: "host", required: false, help: "Organizer or host name (up to 300 characters)." },
  { key: "image_url", required: false, help: "Full URL to an event image." },
  { key: "recurrence", required: false, help: "weekly, or leave blank for a one-time event." },
  { key: "contact_email", required: false, help: "Contact email address." },
  { key: "contact_instagram", required: false, help: "Instagram handle (up to 100 characters)." },
  { key: "contact_website", required: false, help: "Full URL." },
  {
    key: "dance_styles",
    required: false,
    help: "Up to 10 styles, separated by semicolons (e.g. Salsa; Bachata On1).",
  },
  { key: "event_attributes", required: false, help: "Event attributes, separated by semicolons." },
  { key: "gallery", required: false, help: "Image URLs, separated by semicolons." },
];

export const CSV_REQUIRED_KEYS = CSV_COLUMNS.filter((c) => c.required).map((c) => c.key);
export const CSV_ALL_KEYS = CSV_COLUMNS.map((c) => c.key);

export const CSV_MAX_ROWS = 200;
export const CSV_MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB

const EXAMPLE_ROW: Record<string, string> = {
  title: "Salsa Social Night",
  event_type: "social",
  event_date: "2026-09-15",
  city: "boston",
  event_time: "20:00",
  description: "A weekly social with live DJ.",
  venue_name: "The Dance Loft",
  location: "",
  address: "",
  price_type: "free",
  price_amount: "",
  rsvp_link: "",
  host: "Maria's Dance Studio",
  image_url: "",
  recurrence: "weekly",
  contact_email: "",
  contact_instagram: "",
  contact_website: "",
  dance_styles: "Salsa; Bachata",
  event_attributes: "",
  gallery: "",
};

/**
 * Escapes a single CSV cell against both CSV syntax (quote wrapping when it
 * contains a comma/quote/newline) and CSV-injection (a leading =,+,-,@ can
 * execute as a formula when the file is later opened in Excel/Sheets — we
 * neutralize that in every CSV we generate ourselves, template or error
 * export).
 */
export function csvSafeCell(value: string): string {
  const injectionGuarded = /^[=+\-@]/.test(value) ? `'${value}` : value;
  const needsQuoting = /[",\n\r]/.test(injectionGuarded);
  if (!needsQuoting) return injectionGuarded;
  return `"${injectionGuarded.replace(/"/g, '""')}"`;
}

function rowToCsvLine(values: string[]): string {
  return values.map(csvSafeCell).join(",");
}

/** Builds the downloadable template: header row + one example row. */
export function buildCsvTemplate(): string {
  const header = rowToCsvLine(CSV_ALL_KEYS);
  const example = rowToCsvLine(CSV_ALL_KEYS.map((key) => EXAMPLE_ROW[key] ?? ""));
  return `${header}\n${example}\n`;
}

/** Builds a downloadable CSV from arbitrary rows (used for the error-rows export). */
export function buildCsvFromRows(headers: string[], rows: string[][]): string {
  const lines = [rowToCsvLine(headers), ...rows.map(rowToCsvLine)];
  return lines.join("\n") + "\n";
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
