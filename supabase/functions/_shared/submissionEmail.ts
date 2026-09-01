/**
 * Event-submission transactional email content — the four content builders
 * (received / awaiting_review / approved / rejected). The shared HTML/text
 * layout, escaping, and Resend-failure classification live in
 * `_shared/emailLayout.ts` (originally defined here, extracted when
 * `founderWelcomeEmail.ts` needed the identical layout).
 *
 * Deliberately its own module rather than reusing `send-auth-email`'s
 * `template()` or `_shared/founderInvitationEmail.ts`: those cover Supabase
 * Auth action types and the Founder invitation credential respectively.
 * These are application-domain notifications about a row in
 * `public.event_submissions`.
 *
 * Nothing in this module reads a caller-supplied recipient. Every value here
 * is presentation-only; the Edge Function derives all addresses from the
 * database row and `platform_settings` before calling in.
 *
 * `internal_note` is intentionally absent from every type in this file. The
 * submitter-facing builders cannot render it because it is not part of their
 * input contract — the separation is structural, not a code-review promise.
 */

import { layout, plainText, type EmailContent } from "./emailLayout.ts";

export type SubmissionEmailContent = EmailContent;

/** Event facts safe to show a submitter or a moderator. */
export interface SubmissionEventFacts {
  title: string;
  /** ISO instant, as stored in submitted_data.event_date. */
  eventDateIso: string | null;
  /** "19:30" wall-clock, as stored in submitted_data.event_time. */
  eventTime: string | null;
  city: string | null;
  location: string | null;
}

const PLATFORM_TIMEZONE = "America/New_York";

/** Formats the stored ISO instant as an America/New_York wall-clock date. */
export function formatEventDate(eventDateIso: string | null): string | null {
  if (!eventDateIso) return null;
  try {
    return new Intl.DateTimeFormat("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: PLATFORM_TIMEZONE,
    }).format(new Date(eventDateIso));
  } catch {
    return null;
  }
}

/** Formats "19:30" as "7:30 PM ET". Returns null for anything unparseable. */
export function formatEventTime(eventTime: string | null): string | null {
  if (!eventTime) return null;
  const match = /^(\d{1,2}):(\d{2})/.exec(eventTime);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || hours < 0 || hours > 23) return null;
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 59) return null;
  const suffix = hours < 12 ? "AM" : "PM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return `${display}:${String(minutes).padStart(2, "0")} ${suffix} ET`;
}

/** "Saturday, September 6, 2026 at 7:30 PM ET", or whichever parts resolve. */
export function formatWhen(facts: SubmissionEventFacts): string | null {
  const date = formatEventDate(facts.eventDateIso);
  const time = formatEventTime(facts.eventTime);
  if (date && time) return `${date} at ${time}`;
  return date ?? time;
}

const CITY_LABEL: Record<string, string> = {
  boston: "Boston",
  "new-york-city": "New York City",
};

export function cityLabel(city: string | null): string | null {
  if (!city) return null;
  return CITY_LABEL[city] ?? city;
}

function eventRows(facts: SubmissionEventFacts): Array<[string, string]> {
  const rows: Array<[string, string]> = [["Event", facts.title]];
  const when = formatWhen(facts);
  if (when) rows.push(["When", when]);
  const city = cityLabel(facts.city);
  if (city) rows.push(["City", city]);
  if (facts.location) rows.push(["Venue", facts.location]);
  return rows;
}

// ── A. Event Submission Received ───────────────────────────────────────────

/**
 * Confirms receipt to the submitter. Deliberately states "pending review"
 * and never implies the event is live.
 */
export function submissionReceivedEmail(params: {
  platformName: string;
  supportEmail: string;
  facts: SubmissionEventFacts;
}): SubmissionEmailContent {
  const parts = {
    platformName: params.platformName,
    heading: "We received your event",
    paragraphs: [
      "Thanks for sending this in. Your event is now in our review queue — a moderator will look it over before it appears on the calendar.",
      "You don't need an account, and there's nothing else for you to do right now. We'll email you at this address once it has been reviewed.",
    ],
    rows: eventRows(params.facts),
    footerLines: [
      `Questions? Reply to this email or write to ${params.supportEmail}.`,
      `${params.platformName} — Latin dance events in Boston and New York City.`,
    ],
  };

  return {
    subject: `We received your event — ${params.platformName}`,
    html: layout(parts),
    text: plainText(parts),
  };
}

// ── B. New Event Awaiting Review ───────────────────────────────────────────

/**
 * Notifies the moderation destination. This is the only builder that shows
 * submitter contact details, and it goes exclusively to the configured
 * `platform_settings.support_email` — never to an address from the caller.
 */
export function submissionAwaitingReviewEmail(params: {
  platformName: string;
  facts: SubmissionEventFacts;
  submitterName: string | null;
  submitterEmail: string | null;
  submissionId: string;
  reviewUrl: string | null;
}): SubmissionEmailContent {
  const rows = eventRows(params.facts);
  rows.push(["Submitter", params.submitterName ?? "(not provided)"]);
  rows.push(["Submitter email", params.submitterEmail ?? "(not provided)"]);
  rows.push(["Submission ID", params.submissionId]);

  const parts = {
    platformName: params.platformName,
    heading: "New event awaiting review",
    paragraphs: ["A new event submission is waiting in the moderation queue."],
    rows,
    ...(params.reviewUrl ? { cta: { label: "Review submission", url: params.reviewUrl } } : {}),
    footerLines: [`Sent automatically by ${params.platformName}.`],
  };

  return {
    subject: `New event awaiting review — ${params.platformName}`,
    html: layout(parts),
    text: plainText(parts),
  };
}

// ── C. Event Approved ──────────────────────────────────────────────────────

export function submissionApprovedEmail(params: {
  platformName: string;
  supportEmail: string;
  facts: SubmissionEventFacts;
  eventUrl: string | null;
}): SubmissionEmailContent {
  const parts = {
    platformName: params.platformName,
    heading: "Your event was approved",
    paragraphs: [
      params.eventUrl
        ? "Good news — a moderator approved your event and it's now listed on the calendar."
        : "Good news — a moderator approved your event and it's now listed on the calendar. It may take a moment to appear.",
    ],
    rows: eventRows(params.facts),
    ...(params.eventUrl ? { cta: { label: "View event", url: params.eventUrl } } : {}),
    footerLines: [
      `Need a correction? Reply to this email or write to ${params.supportEmail}.`,
      `${params.platformName} — Latin dance events in Boston and New York City.`,
    ],
  };

  return {
    subject: `Your event was approved — ${params.platformName}`,
    html: layout(parts),
    text: plainText(parts),
  };
}

// ── D. Event Rejected ──────────────────────────────────────────────────────

/**
 * The rejection notice. `rejectionMessage` is the moderator's public-facing
 * note (`event_submissions.rejection_message`). `internal_note` is not a
 * parameter of this function and therefore cannot leak through it.
 */
export function submissionRejectedEmail(params: {
  platformName: string;
  supportEmail: string;
  facts: SubmissionEventFacts;
  rejectionMessage: string | null;
}): SubmissionEmailContent {
  const trimmedMessage = params.rejectionMessage?.trim();
  const paragraphs = [
    "Thanks for sending this in. A moderator reviewed your event, but it wasn't approved for the calendar this time.",
  ];
  if (trimmedMessage) paragraphs.push(`Note from the review team: ${trimmedMessage}`);
  paragraphs.push(
    "You're welcome to submit again with updated details — reviews are done by a person, so context helps."
  );

  const parts = {
    platformName: params.platformName,
    heading: "Update on your event submission",
    paragraphs,
    rows: eventRows(params.facts),
    footerLines: [
      `Questions about this decision? Reply to this email or write to ${params.supportEmail}.`,
      `${params.platformName} — Latin dance events in Boston and New York City.`,
    ],
  };

  return {
    subject: `Update on your ${params.platformName} event submission`,
    html: layout(parts),
    text: plainText(parts),
  };
}
