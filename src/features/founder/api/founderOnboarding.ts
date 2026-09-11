import { supabase } from "../../../lib/supabase";
import type { OrganizerMemberRole } from "../../host/api/organizerAccessRepo";

/**
 * Phase 8 read-model + provisioning client. Calls the RPCs added in
 * 20260901000000_founder_organization_provisioning.sql, which close the
 * gap left by Phase 6's `accept_founder_invitation` (which intentionally
 * stops at `founder_invitations.status = 'accepted'` — organization
 * provisioning happens here).
 *
 * Every RPC this module calls is zero-parameter and self-scoped to the
 * caller's own `auth.uid()` server-side — there is no organizer id,
 * request id, or user id for this client to supply or substitute.
 */

/** Mirrors the four states `founder_onboarding_state()` can return. */
export type FounderOnboardingState =
  | { state: "not_founder" }
  | { state: "accepted_not_provisioned"; founderRequestId: string; organizationName: string }
  | { state: "manual_resolution_required"; founderRequestId: string }
  | { state: "provisioned"; organizerId: string; organizationName: string; role: OrganizerMemberRole };

/**
 * Resolves the authenticated caller's Founder onboarding state. This is
 * the ONLY thing `/founders/welcome` trusts to decide what to render —
 * never a query parameter, session flag, or navigation state (spec §3/§6).
 */
export async function fetchFounderOnboardingState(): Promise<FounderOnboardingState> {
  const { data, error } = await supabase.rpc("founder_onboarding_state");
  if (error) throw new Error(error.message);
  if (!data || typeof data !== "object" || typeof data.state !== "string") {
    throw new Error("Unable to determine onboarding state");
  }
  return data as FounderOnboardingState;
}

export interface ProvisionedFounderOrganization {
  organizerId: string;
  organizationName: string;
  role: OrganizerMemberRole;
}

/**
 * Provisions (or idempotently re-affirms) the organizer + owner
 * membership for the caller's own accepted Founder invitation. Safe to
 * call more than once — a second call re-affirms the same organizer
 * rather than creating a duplicate.
 *
 * Also refreshes the current session. `provision_founder_organization()`
 * may update `auth.users.raw_app_meta_data.role` server-side (see the
 * migration's SAFETY NOTES — it only ever lifts a plain 'user' to
 * 'organizer', matching the existing `admin_approve_organizer_request()`
 * convention), but a JWT's claims are fixed at issuance: the browser's
 * CURRENT session token still carries the pre-provisioning role until
 * something refreshes it. Without this, `isOrganizer` (Header's Host
 * Dashboard nav link, AccountPage's Host Events capability card) would
 * stay stale until the access token's next natural refresh — verified
 * live in a real browser: the Header nav link did not appear
 * immediately without this call. The underlying Host *authorization*
 * boundary is unaffected either way — `RequireOrganizer` already grants
 * nested-route access from `organizer_members` alone, independent of
 * the JWT role claim (spec §2) — this only fixes the presentational
 * lag. Best-effort: a refresh failure does not fail provisioning, which
 * already committed.
 */
export async function provisionFounderOrganization(): Promise<ProvisionedFounderOrganization> {
  const { data, error } = await supabase.rpc("provision_founder_organization");
  if (error) throw new Error(error.message);
  if (!data || typeof data.organizerId !== "string") {
    throw new Error("Unable to provision organization");
  }
  try {
    await supabase.auth.refreshSession();
  } catch {
    /* best-effort — provisioning itself already succeeded and stands */
  }
  return {
    organizerId: data.organizerId,
    organizationName: data.organizationName,
    role: data.role,
  };
}

/**
 * Fire-and-forget trigger for the optional Founder welcome email.
 * Idempotent server-side (claim_founder_welcome_email only succeeds
 * once per provisioned request) — safe to call on every page load of
 * the welcome screen. Never throws: email delivery is secondary to the
 * already-committed provisioning state (spec §19).
 */
export async function requestFounderWelcomeEmail(): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke("send-founder-welcome-email", {
      body: {},
    });
    if (error) {
      console.warn("Founder welcome email failed:", error.message);
    }
  } catch (err) {
    console.warn("Founder welcome email failed:", err);
  }
}
