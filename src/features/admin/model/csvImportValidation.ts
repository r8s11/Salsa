import type { EventTaxonomyTerm } from "../../events/model/types";
import type { AdminEventForm } from "./adminEventForm";
import { HOST_MAX_LENGTH, INSTAGRAM_MAX_LENGTH } from "./adminEventForm";
import {
  DANCE_STYLES_MAX_COUNT,
  DESCRIPTION_MAX_LENGTH,
  OTHER_TEXT_MAX_LENGTH,
  TITLE_MAX_LENGTH,
} from "../../submit-event/validation";
import type { AdminEventPayload } from "../../events/api/eventsRepo";
import { draftToAdminPayload } from "../../events/components/EventForm";

// The manual editor validates image URLs inline; CSV import applies the same
// maximum length because it has no live character feedback.
const IMAGE_URL_MAX_LENGTH = 2000;

const EVENT_TYPES: Record<string, true> = { social: true, class: true, workshop: true };
const CITIES: Record<string, true> = { boston: true, "new-york-city": true };
const PRICE_TYPES: Record<string, true> = { free: true, paid: true, "": true };
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export interface CsvFieldIssue {
  field: string;
  message: string;
}

export type CsvRowStatus = "valid" | "warning" | "invalid";

export interface CsvRowResult {
  /** 1-based row number as the moderator would see it in a spreadsheet (header = row 1). */
  rowNumber: number;
  raw: Record<string, string>;
  /** Built once the row has no blocking errors; still needs venue/duplicate resolution before import. */
  payload: AdminEventPayload | null;
  danceStyleNames: string[];
  eventAttributeNames: string[];
  venueName: string;
  errors: CsvFieldIssue[];
  warnings: CsvFieldIssue[];
  status: CsvRowStatus;
}

function isValidUrl(value: string): boolean {
  try {
    return new URL(value).protocol.startsWith("http");
  } catch {
    return false;
  }
}

function splitList(value: string): string[] {
  return value
    .split(";")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function resolveTermIds(
  names: string[],
  activeTerms: EventTaxonomyTerm[],
  fieldLabel: string,
  warnings: CsvFieldIssue[]
): string[] {
  const idByName: Record<string, string> = Object.fromEntries(
    activeTerms.map((term) => [term.name.trim().toLowerCase(), term.id])
  );
  const ids: string[] = [];
  const unmatched: string[] = [];
  for (const name of names) {
    const id = idByName[name.toLowerCase()];
    if (id) ids.push(id);
    else unmatched.push(name);
  }
  if (unmatched.length > 0) {
    warnings.push({
      field: fieldLabel,
      message: `Not found, skipped: ${unmatched.join(", ")}.`,
    });
  }
  return ids;
}

/**
 * Validates one raw CSV row against the app's actual event rules — reusing
 * the exact same length constants and URL/email checks AdminEventForm and
 * the public submission form already enforce, so a CSV-imported event can
 * never be held to looser rules than a manually created one. Every problem
 * is collected (not "first error wins") so the moderator sees the full list
 * per row.
 *
 * Venue-name matching and duplicate-detection are async (they hit the
 * network) and happen as separate steps in useCsvEventImport — this
 * function is pure and synchronous so it's cheap to run on every keystroke
 * of a re-validate and trivial to unit test.
 */
export function validateCsvRow(
  raw: Record<string, string>,
  rowIndex: number,
  danceStyleTerms: EventTaxonomyTerm[],
  eventAttributeTerms: EventTaxonomyTerm[]
): CsvRowResult {
  const errors: CsvFieldIssue[] = [];
  const warnings: CsvFieldIssue[] = [];

  const title = raw.title ?? "";
  const eventType = raw.event_type ?? "";
  const eventDate = raw.event_date ?? "";
  const city = raw.city ?? "";
  const eventTime = raw.event_time ?? "";
  const description = raw.description ?? "";
  const location = raw.location ?? "";
  const address = raw.address ?? "";
  const priceType = raw.price_type ?? "";
  const priceAmount = raw.price_amount ?? "";
  const rsvpLink = raw.rsvp_link ?? "";
  const host = raw.host ?? "";
  const imageUrl = raw.image_url ?? "";
  const recurrence = raw.recurrence ?? "";
  const contactEmail = raw.contact_email ?? "";
  const contactInstagram = raw.contact_instagram ?? "";
  const contactWebsite = raw.contact_website ?? "";
  const venueName = raw.venue_name ?? "";

  if (!title.trim()) errors.push({ field: "title", message: "Event title is required." });
  else if (title.length > TITLE_MAX_LENGTH)
    errors.push({ field: "title", message: `Must be ${TITLE_MAX_LENGTH} characters or fewer.` });

  if (!eventType) errors.push({ field: "event_type", message: "event_type is required." });
  else if (!EVENT_TYPES[eventType])
    errors.push({ field: "event_type", message: "Must be one of: social, class, workshop." });

  if (!city) errors.push({ field: "city", message: "city is required." });
  else if (!CITIES[city])
    errors.push({ field: "city", message: "Must be one of: boston, new-york-city." });

  if (!eventDate) errors.push({ field: "event_date", message: "event_date is required." });
  else if (!DATE_RE.test(eventDate))
    errors.push({ field: "event_date", message: "Must use YYYY-MM-DD format." });

  if (eventTime && !TIME_RE.test(eventTime))
    errors.push({ field: "event_time", message: "Must use 24-hour HH:MM format." });

  if (description.length > DESCRIPTION_MAX_LENGTH)
    errors.push({
      field: "description",
      message: `Must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`,
    });

  if (location.length > OTHER_TEXT_MAX_LENGTH)
    errors.push({
      field: "location",
      message: `Must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`,
    });

  if (address.length > OTHER_TEXT_MAX_LENGTH)
    errors.push({
      field: "address",
      message: `Must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`,
    });

  if (!PRICE_TYPES[priceType])
    errors.push({ field: "price_type", message: "Must be one of: free, paid (or blank)." });
  if (priceType === "paid") {
    if (!priceAmount.trim()) {
      errors.push({ field: "price_amount", message: "Required when price_type is paid." });
    } else {
      const amount = Number(priceAmount);
      if (!Number.isFinite(amount) || amount <= 0)
        errors.push({ field: "price_amount", message: "Must be a positive number." });
    }
  }

  if (rsvpLink) {
    if (rsvpLink.length > OTHER_TEXT_MAX_LENGTH)
      errors.push({
        field: "rsvp_link",
        message: `Must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`,
      });
    else if (!isValidUrl(rsvpLink))
      errors.push({ field: "rsvp_link", message: "Must be a valid http:// or https:// URL." });
  }

  if (host.length > HOST_MAX_LENGTH)
    errors.push({ field: "host", message: `Must be ${HOST_MAX_LENGTH} characters or fewer.` });

  if (imageUrl) {
    if (imageUrl.length > IMAGE_URL_MAX_LENGTH)
      errors.push({
        field: "image_url",
        message: `Must be ${IMAGE_URL_MAX_LENGTH} characters or fewer.`,
      });
    else if (!isValidUrl(imageUrl))
      errors.push({ field: "image_url", message: "Must be a valid http:// or https:// URL." });
  }

  if (recurrence && recurrence !== "weekly")
    errors.push({ field: "recurrence", message: "Must be weekly, or blank." });

  if (contactEmail && !EMAIL_RE.test(contactEmail))
    errors.push({ field: "contact_email", message: "Must be a valid email address." });

  if (contactInstagram.length > INSTAGRAM_MAX_LENGTH)
    errors.push({
      field: "contact_instagram",
      message: `Must be ${INSTAGRAM_MAX_LENGTH} characters or fewer.`,
    });

  if (contactWebsite && !isValidUrl(contactWebsite))
    errors.push({ field: "contact_website", message: "Must be a valid http:// or https:// URL." });

  const danceStyleNames = splitList(raw.dance_styles ?? "");
  if (danceStyleNames.length > DANCE_STYLES_MAX_COUNT)
    errors.push({
      field: "dance_styles",
      message: `Up to ${DANCE_STYLES_MAX_COUNT} styles allowed.`,
    });
  const danceStyleIds = resolveTermIds(danceStyleNames, danceStyleTerms, "dance_styles", warnings);

  const eventAttributeNames = splitList(raw.event_attributes ?? "");
  const eventAttributeIds = resolveTermIds(
    eventAttributeNames,
    eventAttributeTerms,
    "event_attributes",
    warnings
  );

  const galleryUrls = splitList(raw.gallery ?? "");
  const invalidGalleryUrls = galleryUrls.filter((url) => !isValidUrl(url));
  if (invalidGalleryUrls.length > 0)
    errors.push({
      field: "gallery",
      message: `Not a valid URL: ${invalidGalleryUrls.join(", ")}.`,
    });

  let payload: AdminEventPayload | null = null;
  if (errors.length === 0) {
    const form: AdminEventForm = {
      title: title.trim(),
      description,
      event_type: eventType as AdminEventForm["event_type"],
      city: city as AdminEventForm["city"],
      event_date: eventDate,
      event_time: eventTime,
      location,
      address,
      price_type: priceType as AdminEventForm["price_type"],
      price_amount: priceAmount,
      rsvp_link: rsvpLink,
      submitter_name: "",
      submitter_email: "",
      recurrence: recurrence === "weekly" ? "weekly" : "",
      dance_styles: [],
      host,
      image_url: imageUrl,
      contact_email: contactEmail,
      contact_instagram: contactInstagram,
      contact_website: contactWebsite,
      taxonomy_term_ids: [...danceStyleIds, ...eventAttributeIds],
      venue_id: "",
    };
    payload = {
      ...draftToAdminPayload(form),
      gallery: galleryUrls.length > 0 ? galleryUrls : null,
    };
  }

  return {
    rowNumber: rowIndex + 2,
    raw,
    payload,
    danceStyleNames,
    eventAttributeNames,
    venueName,
    errors,
    warnings,
    status: errors.length > 0 ? "invalid" : warnings.length > 0 ? "warning" : "valid",
  };
}
