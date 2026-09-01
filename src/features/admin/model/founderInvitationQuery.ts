/**
 * Founder Invitation — model types and pure client-side helpers.
 *
 * Deliberately separate from founderRequestsQuery.ts: an invitation is a
 * distinct lifecycle (pending -> accepted | revoked) issued *for* an
 * approved founder_access_requests row, not a field on that row. See
 * Docs/operations/phase4-founder-invitation-foundation.md for the full
 * architecture.
 */

export type FounderInvitationStatus = "pending" | "accepted" | "revoked";

/**
 * A founder invitation row as returned by the
 * `admin_founder_invitation_for_request` RPC. Never includes token_hash —
 * the RPC itself never selects it.
 */
export interface FounderInvitationRow {
  id: string;
  founder_request_id: string;
  email: string;
  status: FounderInvitationStatus;
  expires_at: string;
  created_at: string;
  created_by: string;
  revoked_at: string | null;
  revoked_by: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  /** Phase 5: most recent email-delivery attempt for this invitation, if any. */
  latest_delivery_status: "sent" | "failed" | null;
  latest_delivery_provider_message_id: string | null;
  latest_delivery_attempted_at: string | null;
  latest_delivery_error_code: string | null;
  delivery_attempt_count: number;
}

/**
 * Response from `admin_create_founder_invitation`. `token` is the
 * plaintext invitation token, returned exactly once — the database never
 * stores it and it cannot be retrieved again after this response.
 */
export interface CreateFounderInvitationResult {
  id: string;
  email: string;
  token: string;
  organizationName: string;
  expiresAt: string;
}

/**
 * Display status derived client-side for the admin UI. Distinct from
 * `FounderInvitationRow.status`: expiration is never a materialized
 * database status (spec §18) — "expired" only exists here, computed from
 * `expires_at` against the current time.
 */
export type FounderInvitationDisplayStatus = "none" | "pending" | "expired" | "revoked" | "accepted";

export const FOUNDER_INVITATION_DISPLAY_LABEL: Record<FounderInvitationDisplayStatus, string> = {
  none: "No invitation created",
  pending: "Invitation pending",
  expired: "Invitation expired",
  revoked: "Invitation revoked",
  accepted: "Invitation accepted",
};

/**
 * Derives the display status for the admin UI from the most recent
 * invitation row (or null if none was ever created).
 */
export function deriveInvitationDisplayStatus(
  invitation: FounderInvitationRow | null,
  now: Date = new Date()
): FounderInvitationDisplayStatus {
  if (!invitation) return "none";
  if (invitation.status === "revoked") return "revoked";
  if (invitation.status === "accepted") return "accepted";
  return new Date(invitation.expires_at).getTime() <= now.getTime() ? "expired" : "pending";
}

/**
 * Whether the admin "Create Invitation" action should be available for a
 * request in the given display status. Only "none", "expired", and
 * "revoked" allow issuing a fresh invitation — "pending" already has an
 * active one (server-enforced by the partial unique index; this is purely
 * a UI convenience to avoid a round-trip 409), and "accepted" requests
 * are already onboarded.
 */
export function canCreateFounderInvitation(displayStatus: FounderInvitationDisplayStatus): boolean {
  return displayStatus === "none" || displayStatus === "expired" || displayStatus === "revoked";
}

/**
 * Whether the admin "Revoke" action should be available. Only a live
 * pending (non-expired) invitation is revocable — mirrors the RPC's own
 * rejection of already-revoked/accepted invitations, plus treats a
 * client-visible "expired" row the same as "nothing to revoke" since the
 * token is already unusable.
 */
export function canRevokeFounderInvitation(displayStatus: FounderInvitationDisplayStatus): boolean {
  return displayStatus === "pending";
}

/**
 * Whether the admin "Reissue" action should be available for a request
 * in the given display status. Only "pending", "expired", and "revoked"
 * allow reissuing a fresh credential — "none" has no invitation to reissue
 * (use "Send Founder Invitation" instead), and "accepted" requests are
 * already onboarded so reissue is not a recovery path.
 */
export function canReissueFounderInvitation(displayStatus: FounderInvitationDisplayStatus): boolean {
  return displayStatus === "pending" || displayStatus === "expired" || displayStatus === "revoked";
}

/**
 * Canonical future invitation URL shape (spec §13):
 * `/founders/accept?token=<plaintext-token>`. Relative — the caller
 * prefixes the origin. The token is the sole credential; nothing else
 * (email, role, status) is encoded into the URL.
 */
export function founderInvitationAcceptUrl(token: string): string {
  return `/founders/accept?token=${encodeURIComponent(token)}`;
}

/**
 * Email-delivery display status (Phase 5) — deliberately a separate axis
 * from `FounderInvitationDisplayStatus` (spec §8/§20: "do not conflate
 * invitation lifecycle with email lifecycle"). "not_sent" covers both
 * "no invitation ever existed" and "an invitation exists but no delivery
 * attempt has been recorded for it yet" — both render identically to an
 * admin ("no email has gone out").
 */
export type FounderInvitationEmailDisplayStatus = "not_sent" | "sent" | "failed";

export const FOUNDER_INVITATION_EMAIL_DISPLAY_LABEL: Record<FounderInvitationEmailDisplayStatus, string> = {
  not_sent: "Not invited",
  sent: "Invitation email sent",
  failed: "Invitation email failed",
};

export function deriveEmailDisplayStatus(
  invitation: FounderInvitationRow | null
): FounderInvitationEmailDisplayStatus {
  if (!invitation || !invitation.latest_delivery_status) return "not_sent";
  return invitation.latest_delivery_status === "sent" ? "sent" : "failed";
}

/** Response from the `send-founder-invitation` Edge Function on success. */
export interface SendFounderInvitationResult {
  success: true;
  invitationId: string;
  email: string;
  expiresAt: string;
}