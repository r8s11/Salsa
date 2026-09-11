import { supabase } from "../../../lib/supabase";

/**
 * Public validation of a Founder invitation token. Calls the Phase 4
 * `validate_founder_invitation` RPC, which is anon-accessible: the
 * acceptance page must be able to check a token before the visitor signs
 * in or creates an account. Returns only safe, user-facing metadata on
 * success and a generic `{ valid: false }` on every failure mode — the
 * caller cannot distinguish why a token failed (enumeration-safe).
 */
export interface ValidatedFounderInvitation {
  valid: true;
  organizationName: string;
  invitedEmail: string;
  expiresAt: string;
}

export type FounderInvitationValidationResult =
  | ValidatedFounderInvitation
  | { valid: false };

export async function validateFounderInvitation(
  token: string
): Promise<FounderInvitationValidationResult> {
  const { data, error } = await supabase.rpc("validate_founder_invitation", {
    p_token: token,
  });
  if (error) {
    // Network/infrastructure failure, not a token-lifecycle rejection —
    // the page renders its generic "couldn't complete" state, not "invalid".
    throw new Error(error.message);
  }
  if (!data || data.valid !== true) {
    return { valid: false };
  }
  return {
    valid: true,
    organizationName: data.organizationName,
    invitedEmail: data.invitedEmail,
    expiresAt: data.expiresAt,
  };
}

/**
 * Accepts a Founder invitation for the currently authenticated user.
 * Calls the Phase 6 `accept_founder_invitation` RPC (authenticated only —
 * an anonymous call fails at the PostgREST grant layer with 401 before
 * reaching the function). The RPC atomically validates the token, checks
 * the email match, and performs the single-use `pending -> accepted`
 * transition.
 */
export interface AcceptedFounderInvitation {
  accepted: true;
  organizationName: string;
  founderRequestId: string;
}

export async function acceptFounderInvitation(
  token: string
): Promise<AcceptedFounderInvitation> {
  const { data, error } = await supabase.rpc("accept_founder_invitation", {
    p_token: token,
  });
  if (error) {
    // Re-throw with the RPC's safe message — it never contains the token
    // or any internal metadata. The frontend maps this to the correct
    // user-facing state (invalid vs. email-mismatch vs. generic error).
    throw new Error(error.message);
  }
  if (!data || data.accepted !== true) {
    throw new Error("invitation is invalid, expired, or no longer available");
  }
  return {
    accepted: true,
    organizationName: data.organizationName,
    founderRequestId: data.founderRequestId,
  };
}
