/**
 * Founder Access Request — internal admin notification email content.
 *
 * The one email builder for the "a new Founder/Host access request needs
 * review" notification sent to `platform_settings.support_email`
 * automatically after `request-founder-access` inserts a fresh pending
 * row. Uses the shared layout (`emailLayout.ts`) — the same table-based,
 * inline-styled template as every other transactional email in this
 * project — rather than a second design system.
 *
 * Every interpolated value is HTML-escaped by `layout()`/`plainText()`.
 * No internal-only field (reviewed_by, reviewed_at, rejection state,
 * audit metadata) is a parameter of this function, so none can leak
 * through it.
 */

import { layout, plainText, type EmailContent } from "./emailLayout.ts";

export interface FounderRequestNotificationFacts {
  requestId: string;
  applicantName: string;
  email: string;
  organizationName: string;
  instagram: string | null;
  website: string | null;
  city: string | null;
  region: string | null;
  /** ISO instant — the row's created_at. */
  submittedAt: string;
}

const PLATFORM_TIMEZONE = "America/New_York";

function formatSubmittedAt(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: PLATFORM_TIMEZONE,
      }).format(parsed) + " ET"
    );
  } catch {
    return parsed.toISOString();
  }
}

/**
 * Notifies the moderation destination that a new Founder/Host access
 * request is waiting for review. Goes exclusively to the configured
 * `platform_settings.support_email` — never to an address supplied by
 * the applicant or any other caller.
 */
export function founderRequestAdminNotificationEmail(params: {
  platformName: string;
  facts: FounderRequestNotificationFacts;
  reviewUrl: string | null;
}): EmailContent {
  const rows: Array<[string, string]> = [
    ["Applicant", params.facts.applicantName],
    ["Email", params.facts.email],
    ["Organization", params.facts.organizationName],
  ];
  if (params.facts.instagram) rows.push(["Instagram", params.facts.instagram]);
  if (params.facts.website) rows.push(["Website", params.facts.website]);
  const location = [params.facts.city, params.facts.region]
    .filter((part): part is string => Boolean(part))
    .join(", ");
  if (location) rows.push(["City/Region", location]);
  rows.push(["Submitted", formatSubmittedAt(params.facts.submittedAt)]);
  rows.push(["Request ID", params.facts.requestId]);

  const parts = {
    platformName: params.platformName,
    heading: "New Founder access request",
    paragraphs: ["A new Founder/Host access request has been submitted and is ready for review."],
    rows,
    ...(params.reviewUrl ? { cta: { label: "Review Founder Request", url: params.reviewUrl } } : {}),
    footerLines: [`Sent automatically by ${params.platformName}.`],
  };

  return {
    subject: `New Founder access request — ${params.platformName}`,
    html: layout(parts),
    text: plainText(parts),
  };
}
