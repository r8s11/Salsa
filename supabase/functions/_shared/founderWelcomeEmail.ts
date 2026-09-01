/**
 * Founder welcome email content — sent once, after organization
 * provisioning succeeds (Phase 8).
 *
 * Deliberately a separate transactional event from the invitation email
 * (`founderInvitationEmail.ts`): the invitation email carries a bearer
 * credential and is sent BEFORE authentication; this email carries no
 * credential at all and is sent AFTER provisioning, to an address already
 * proven via Supabase Auth. Conflating the two would blur two very
 * different trust boundaries.
 *
 * Contains NO invitation token, token hash, acceptance URL, or auth
 * callback token (spec §17) — structurally impossible, since this
 * builder's parameters don't accept any of those. The Host Dashboard URL
 * is a normal authenticated route with no query parameters at all.
 */

import { layout, plainText, type EmailContent } from "./emailLayout.ts";

export function founderWelcomeEmailContent(params: {
  platformName: string;
  organizationName: string;
  hostDashboardUrl: string;
  supportEmail: string;
}): EmailContent {
  const parts = {
    platformName: params.platformName,
    heading: "Your Host access is ready",
    paragraphs: [
      `${params.organizationName} is set up on ${params.platformName}. You're the Owner, with full Host access.`,
      "From your Host Dashboard you can create and edit your event listings, track attendance, and manage your organization's profile.",
    ],
    cta: { label: "Go to Host Dashboard", url: params.hostDashboardUrl },
    footerLines: [
      `Questions? Reply to this email or write to ${params.supportEmail}.`,
      `${params.platformName} — Latin dance events in Boston and New York City.`,
    ],
  };

  return {
    subject: `Your ${params.platformName} Host access is ready`,
    html: layout(parts),
    text: plainText(parts),
  };
}
