/**
 * Receipt only: no approval, access grant, or invitation link.
 * Fixed branding keeps applicant delivery independent of admin settings.
 * Shared layout escapes HTML; plain text preserves the original values.
 */

import { layout, plainText, type EmailContent } from "./emailLayout.ts";

const PLATFORM_NAME = "SalsaSegura";

export function founderRequestConfirmationEmail(params: {
  applicantName: string;
  organizationName: string;
}): EmailContent {
  const parts = {
    platformName: PLATFORM_NAME,
    heading: "We've received your Founder access request",
    paragraphs: [
      `Thanks, ${params.applicantName} — your Founder/Host access request for ${params.organizationName} has been received and is pending review.`,
      "No action is needed from you right now. Approval is not guaranteed, and you do not have active Host access yet.",
      "If your request is approved, you'll receive a separate, secure invitation email with instructions to set up your Host account.",
    ],
    footerLines: [`This is an automated receipt from ${PLATFORM_NAME}.`],
  };

  return {
    subject: `We've received your Founder access request — ${PLATFORM_NAME}`,
    html: layout(parts),
    text: plainText(parts),
  };
}
