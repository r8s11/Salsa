import type { EventType, City } from "../../types/events";

export type SubmitForm = {
  title: string;
  description: string;
  event_type: EventType | "";
  city: City;
  event_date: string;
  event_time: string;
  location: string;
  address: string;
  price_type: "free" | "paid" | "";
  price_amount: string;
  rsvp_link: string;
  submitter_name: string;
  submitter_email: string;
  recurrence: "weekly" | "";
  dance_styles: string[];
};

export const buildInitialForm = (city: City): SubmitForm => ({
  title: "",
  description: "",
  event_type: "",
  city,
  event_date: "",
  event_time: "",
  location: "",
  address: "",
  price_type: "",
  price_amount: "",
  rsvp_link: "",
  submitter_name: "",
  submitter_email: "",
  recurrence: "",
  dance_styles: [],
});

export const TITLE_MAX_LENGTH = 120;
export const DESCRIPTION_MAX_LENGTH = 2000;
export const OTHER_TEXT_MAX_LENGTH = 300;
export const DANCE_STYLES_MAX_COUNT = 10;

/**
 * Mirrors the database rule in
 * sql/submission-emails/002_anon_submitter_contact_required.sql and the
 * Edge Functions' normalizeEmail(). Plausibility only — no regex proves
 * deliverability.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * `isAnonymous` gates the submitter-contact rules. An authenticated submitter
 * is reachable through their account (`submitter_id` -> `auth.users.email`),
 * so the form's free-text fields are genuinely optional for them. An
 * anonymous submitter has no account: these two fields are the only way to
 * send them a confirmation, approval, or rejection notice, which makes them
 * required rather than nice-to-have.
 *
 * Defaults to `false` so existing authenticated/admin callers are unaffected.
 */
export function validateSubmitForm(form: SubmitForm, isAnonymous = false): string | null {
  if (isAnonymous) {
    if (form.submitter_name.trim() === "") {
      return "Please enter your name so we can credit and contact you about this event.";
    }
    if (form.submitter_email.trim() === "") {
      return "Please enter your email so we can tell you when your event has been reviewed.";
    }
    if (!EMAIL_PATTERN.test(form.submitter_email.trim())) {
      return "Please enter a valid email address (e.g. you@example.com).";
    }
  }

  // Length caps (spam friction)
  if (form.title.length > TITLE_MAX_LENGTH) {
    return `Event title must be ${TITLE_MAX_LENGTH} characters or fewer.`;
  }
  if (form.description.length > DESCRIPTION_MAX_LENGTH) {
    return `Description must be ${DESCRIPTION_MAX_LENGTH} characters or fewer.`;
  }
  if (form.location.length > OTHER_TEXT_MAX_LENGTH) {
    return `Venue name must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`;
  }
  if (form.address.length > OTHER_TEXT_MAX_LENGTH) {
    return `Address must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`;
  }
  if (form.rsvp_link.length > OTHER_TEXT_MAX_LENGTH) {
    return `RSVP link must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`;
  }
  if (form.submitter_name.length > OTHER_TEXT_MAX_LENGTH) {
    return `Your name must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`;
  }
  if (form.submitter_email.length > OTHER_TEXT_MAX_LENGTH) {
    return `Your email must be ${OTHER_TEXT_MAX_LENGTH} characters or fewer.`;
  }

  // Validate price amount when price type is "paid"
  if (form.price_type === "paid") {
    if (!form.price_amount || form.price_amount.trim() === "") {
      return "Please enter a price amount for paid events.";
    }
    const price = parseFloat(form.price_amount);
    if (isNaN(price) || price <= 0) {
      return "Price amount must be a positive number.";
    }
  }

  // Validate dance styles count
  if (form.dance_styles.length > DANCE_STYLES_MAX_COUNT) {
    return `You can select up to ${DANCE_STYLES_MAX_COUNT} dance styles.`;
  }

  // Validate RSVP link if provided
  if (form.rsvp_link && form.rsvp_link.trim() !== "") {
    try {
      const url = new URL(form.rsvp_link);
      if (!url.protocol.startsWith("http")) {
        return "RSVP link must be a valid HTTP or HTTPS URL.";
      }
    } catch {
      return "Please enter a valid URL for the RSVP link (e.g., https://example.com).";
    }
  }

  return null;
}
