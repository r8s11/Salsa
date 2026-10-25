import { type EmailContent, layout, plainText } from "./emailLayout.ts";

/**
 * The one organizer-invitation email, shared by both triggers:
 *   - `send-auth-email` (Supabase Auth Send Email hook, first invite)
 *   - `resend-organizer-invitation` (admin re-send of an unaccepted invite)
 *
 * Both deliver the same content so a recipient who gets a second copy sees
 * the same message with a fresh link, not a different-looking email. The
 * acceptance URL is the only variable: it carries a single-use credential
 * and is never logged or echoed back to the caller.
 */
export function organizerInvitationEmailContent(params: {
  acceptUrl: string;
  /** True for an admin re-send; adds the one line explaining the older link is dead. */
  isResend?: boolean;
}): EmailContent {
  const paragraphs = [
    "You have been invited to SalsaSegura as an organizer.",
    "This invitation is single-use and expires. After accepting it, you will set a password.",
  ];
  if (params.isResend) {
    paragraphs.push("This replaces any earlier invitation link, which no longer works.");
  }

  const content = {
    platformName: "Salsa Segura",
    heading: params.isResend ? "Your invitation, resent" : "You have an invitation to SalsaSegura",
    paragraphs,
    cta: { label: "Accept invitation", url: params.acceptUrl },
    footerLines: [
      "If you were not expecting this invitation, you can ignore this email.",
      "Salsa Segura · info@salsasegura.com",
    ],
  };

  return {
    subject: params.isResend
      ? "Your SalsaSegura invitation (resent)"
      : "You have an invitation to SalsaSegura",
    html: layout(content),
    text: plainText(content),
  };
}
