/**
 * Founder invitation email content — subject, HTML body, plain-text
 * fallback. Deliberately its own template rather than reusing
 * send-auth-email's `template()`: that function only handles Supabase
 * Auth action types (invite/signup/magiclink/recovery) tied to Auth's own
 * verification-URL shape. A Founder invitation is an application-domain
 * email pointing at `/founders/accept?token=...`, not an Auth callback.
 */

export interface FounderInvitationEmailContent {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatExpiry(expiresAtIso: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "UTC",
    }).format(new Date(expiresAtIso)) + " UTC";
  } catch {
    return "soon";
  }
}

/**
 * Builds the Founder invitation email. `organizationName` and
 * `acceptUrl` are untrusted presentation values (organizationName comes
 * from the approved request; acceptUrl is server-constructed, never
 * client input) — both are HTML-escaped for the HTML body. Nothing else
 * from the invitation/request (reviewer identity, internal request id,
 * admin notes, token hash) is ever included (spec §12).
 */
export function founderInvitationEmailContent(params: {
  organizationName: string;
  acceptUrl: string;
  expiresAtIso: string;
}): FounderInvitationEmailContent {
  const safeOrg = escapeHtml(params.organizationName);
  const safeUrl = escapeHtml(params.acceptUrl);
  const expiresLabel = formatExpiry(params.expiresAtIso);

  const subject = "You're invited to manage your events on SalsaSegura";

  const html = [
    `<p>SalsaSegura has approved the Host access request for <strong>${safeOrg}</strong>.</p>`,
    `<p>You're invited to continue setting up your account and start managing your events on SalsaSegura.</p>`,
    `<p><a href="${safeUrl}">Accept Founder Invitation</a></p>`,
    `<p>This invitation is time-limited and expires ${expiresLabel}. Please don't forward this link — it's meant only for you.</p>`,
    `<p>If you weren't expecting this invitation, you can safely ignore this email.</p>`,
  ].join("\n");

  const text = [
    `SalsaSegura has approved the Host access request for ${params.organizationName}.`,
    `You're invited to continue setting up your account and start managing your events on SalsaSegura.`,
    `Accept your invitation: ${params.acceptUrl}`,
    `This invitation is time-limited and expires ${expiresLabel}. Please don't forward this link — it's meant only for you.`,
    `If you weren't expecting this invitation, you can safely ignore this email.`,
  ].join("\n\n");

  return { subject, html, text };
}
