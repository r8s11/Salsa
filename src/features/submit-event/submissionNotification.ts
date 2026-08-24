import type { SubmissionCreate } from "../admin/api/submissionsRepo";
import type { PlatformSettings } from "../admin/model/platformSettings";
import { fetchPlatformSettings } from "../admin/api/platformSettingsRepo";
import { sendEmail, SendEmailPayload } from "../events/api/emailClient";
import { formatTimeLabel } from "../events/model/eventDateTime";
import "temporal-polyfill/global";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildSubmissionNotificationEmail(
  submission: SubmissionCreate,
  settings: Pick<PlatformSettings, "platform_name" | "support_email">,
): SendEmailPayload {
  const zdt = Temporal.Instant.from(submission.event_date).toZonedDateTimeISO(
    "America/New_York",
  );
  const dateLabel = zdt.toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const timeLabel = submission.event_time
    ? `${formatTimeLabel(submission.event_time)} ET`
    : null;

  const priceLabel =
    submission.price_type === "free"
      ? "Free"
      : submission.price_type === "paid" && submission.price_amount != null
        ? `$${submission.price_amount}`
        : null;

  const rows: Array<[string, string]> = [
    ["Event", submission.title],
    ["Type", submission.event_type],
    ["City", submission.city],
    [
      "When",
      [dateLabel, timeLabel].filter(Boolean).join(" at "),
    ],
    ...(submission.recurrence ? [["Recurs", submission.recurrence] as [string, string]] : []),
    ...(submission.location ? [["Location", submission.location] as [string, string]] : []),
    ...(submission.address ? [["Address", submission.address] as [string, string]] : []),
    ...(priceLabel ? [["Price", priceLabel] as [string, string]] : []),
    ...(submission.rsvp_link ? [["RSVP", submission.rsvp_link] as [string, string]] : []),
    ...(submission.dance_styles.length > 0
      ? [["Styles", submission.dance_styles.join(", ")] as [string, string]]
      : []),
    ...(submission.description
      ? [["Description", submission.description] as [string, string]]
      : []),
    ["Submitter", submission.submitter_name ?? "(anonymous)"],
    ...(submission.submitter_email
      ? [["Submitter email", submission.submitter_email] as [string, string]]
      : []),
  ];

  const html = `
<p>A new event submission is awaiting review.</p>
<table cellpadding="6" cellspacing="0" border="0">
${rows
  .map(
    ([label, value]) =>
      `<tr><td><strong>${escapeHtml(label)}</strong></td><td>${escapeHtml(value)}</td></tr>`,
  )
  .join("\n")}
</table>
<p>Review it in the admin submissions queue.</p>
`.trim();

  return {
    from: settings.support_email,
    to: settings.support_email,
    subject: `New event submission: ${submission.title}`,
    html,
    ...(submission.submitter_email ? { replyTo: submission.submitter_email } : {}),
  };
}

/**
 * Fire-and-forget admin notification after a successful submission.
 * Never throws — an email failure must not affect the submission result.
 */
export async function notifyAdminsOfNewSubmission(
  submission: SubmissionCreate,
): Promise<void> {
  try {
    const settings = await fetchPlatformSettings();
    const payload = buildSubmissionNotificationEmail(submission, settings);
    const result = await sendEmail(payload);
    if (!result.success) {
      console.warn(`Submission notification email failed: ${result.error}`);
    }
  } catch (err) {
    console.warn("Submission notification email failed:", err);
  }
}
