import { FunctionsHttpError } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabase";
import type {
  FounderInvitationDeliveryAttemptRow,
  FounderInvitationRow,
  CreateFounderInvitationResult,
  SendFounderInvitationResult,
} from "../model/founderInvitationQuery";

/**
 * Fetches the most recent invitation for a founder request, or null if
 * none was ever created. Admin/moderator only — the RPC itself enforces
 * that via `is_moderator()`.
 */
export async function fetchFounderInvitationForRequest(
  founderRequestId: string
): Promise<FounderInvitationRow | null> {
  const { data, error } = await supabase.rpc("admin_founder_invitation_for_request", {
    p_founder_request_id: founderRequestId,
  });
  if (error) throw new Error(error.message);
  return (data?.[0] ?? null) as FounderInvitationRow | null;
}

/**
 * Creates a fresh invitation for an approved founder request. Admin only.
 * The returned `token` is shown to the caller exactly once — the caller
 * is responsible for treating the response as sensitive (no persistence
 * beyond the current render, no logging).
 */
export async function createFounderInvitation(
  founderRequestId: string
): Promise<CreateFounderInvitationResult> {
  const { data, error } = await supabase.rpc("admin_create_founder_invitation", {
    p_founder_request_id: founderRequestId,
  });
  if (error) throw new Error(error.message);
  return data as CreateFounderInvitationResult;
}

/**
 * Revokes a pending invitation. Admin only. Rejects (via RPC error) if the
 * invitation is already accepted or already revoked.
 */
export async function revokeFounderInvitation(invitationId: string): Promise<{ success: boolean }> {
  const { error } = await supabase.rpc("admin_revoke_founder_invitation", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Issues a real invitation email for an approved founder request through
 * the `send-founder-invitation` Edge Function: creates the invitation via
 * the Phase 4 primitive, sends it through Resend, and records the
 * delivery outcome server-side. Admin only. If email delivery fails, the
 * Edge Function's own compensation policy revokes the just-created
 * invitation so a retry issues a fresh token rather than orphaning a
 * credential nobody received.
 */
export async function sendFounderInvitation(
  founderRequestId: string,
  idempotencyKey: string
): Promise<SendFounderInvitationResult> {
  return invokeFounderInvitationDelivery("send-founder-invitation", founderRequestId, idempotencyKey);
}

export async function reissueFounderInvitation(
  founderRequestId: string,
  idempotencyKey: string
): Promise<SendFounderInvitationResult> {
  return invokeFounderInvitationDelivery("reissue-founder-invitation", founderRequestId, idempotencyKey);
}

async function invokeFounderInvitationDelivery(
  functionName: "send-founder-invitation" | "reissue-founder-invitation",
  founderRequestId: string,
  idempotencyKey: string
): Promise<SendFounderInvitationResult> {
  const { data, error } = await supabase.functions.invoke<SendFounderInvitationResult>(functionName, {
    body: { founderRequestId, idempotencyKey },
  });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      try {
        const responseBody: unknown = await error.context.json();
        if (
          typeof responseBody === "object" &&
          responseBody !== null &&
          "error" in responseBody &&
          typeof responseBody.error === "string"
        ) {
          message = responseBody.error;
        }
      } catch {
        // Response body was not JSON; use the transport error.
      }
    }
    throw new Error(message);
  }
  if (!data) throw new Error("The invitation email was not sent. Please try again.");
  return data;
}

export async function fetchFounderInvitationHistory(
  founderRequestId: string
): Promise<FounderInvitationRow[]> {
  const { data, error } = await supabase.rpc("admin_founder_invitation_history", {
    p_founder_request_id: founderRequestId,
  });
  if (error) throw new Error(error.message);
  return (data as FounderInvitationRow[] | null) ?? [];
}

export async function fetchFounderInvitationDeliveryAttempts(
  invitationId: string
): Promise<FounderInvitationDeliveryAttemptRow[]> {
  const { data, error } = await supabase.rpc("admin_founder_invitation_delivery_attempts", {
    p_invitation_id: invitationId,
  });
  if (error) throw new Error(error.message);
  return (data as FounderInvitationDeliveryAttemptRow[] | null) ?? [];
}
