import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { founderAcceptUrl } from "../_shared/invitation.ts";
import { founderInvitationEmailContent } from "../_shared/founderInvitationEmail.ts";

/**
 * POST /functions/v1/send-founder-invitation
 *
 * Orchestrates: Approved Founder Request -> Create Invitation (Phase 4
 * RPC) -> Construct Acceptance URL -> Send Email (Resend) -> Persist
 * Delivery Outcome -> Safe Result To Admin UI.
 *
 * Deliberately does NOT use the Supabase service-role key anywhere: every
 * database write goes through a client authenticated as the calling
 * admin's own JWT, relying on the Phase 4/5 SECURITY DEFINER RPCs
 * (admin_create_founder_invitation, admin_record_founder_invitation_delivery_attempt,
 * admin_revoke_founder_invitation) which each re-check is_admin() and
 * read auth.uid() internally. Unlike invite-organizer (which genuinely
 * needs auth.admin.* Admin API calls), this function never touches
 * Supabase Auth at all — it is explicitly prohibited from doing so
 * (spec §24) — so no elevated Supabase secret is required, only the
 * Resend API key.
 */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

type User = { id: string; app_metadata?: Record<string, unknown> | null };
type RpcError = { code?: string; message?: string };
type AuthError = { message?: string };
type AuthResult<T> = { data: T; error: AuthError | null };
type RpcResult<T> = { data: T | null; error: RpcError | null };

type CallerClient = {
  auth: { getUser: () => Promise<AuthResult<{ user: User | null }>> };
  rpc: (fn: string, args: Record<string, unknown>) => Promise<RpcResult<unknown>>;
};

type ResendMessage = { from: string; to: string; subject: string; html: string; text: string };
type ResendResult = { data: { id?: string } | null; error: { message?: string; name?: string } | null };

export type FounderInvitationDeliveryDependencies = {
  createCallerClient: (authorization: string) => CallerClient;
  resend: { emails: { send(message: ResendMessage): Promise<ResendResult> } };
  from: string;
  acceptUrlBase: string;
  log: (message: string, details?: unknown) => void;
};

/** Backward-compatible name used by the existing send endpoint and its tests. */
export type SendFounderInvitationDependencies = FounderInvitationDeliveryDependencies;

export type IssuedFounderInvitation = {
  id: string;
  token: string;
  email: string;
  organizationName: string;
  expiresAt: string;
};

/** Maps a Postgres error surfaced through PostgREST/postgrest-js to an HTTP response. */
function mapInvitationIssueError(error: RpcError, verb: "create" | "reissue"): Response {
  switch (error.code) {
    case "42501":
      return errorResponse("Forbidden", 403);
    case "P0002":
      return errorResponse("Founder request not found", 404);
    case "23505":
      return errorResponse("An invitation has already been issued for this request", 409);
    case "22023":
      return errorResponse(error.message ?? `This request is not eligible to ${verb} an invitation`, 400);
    default:
      return errorResponse(`Unable to ${verb} invitation`, 500);
  }
}

/** Normalizes a Resend failure into a safe, non-sensitive error_code category (spec §22). */
export function classifyFounderInvitationResendFailure(result: ResendResult | null, thrown: unknown): string {
  if (thrown) return "network_error";
  const name = result?.error?.name?.toLowerCase() ?? "";
  const message = result?.error?.message?.toLowerCase() ?? "";
  if (name.includes("rate") || message.includes("rate limit")) return "rate_limited";
  if (message.includes("invalid") && message.includes("to")) return "invalid_recipient";
  if (message.includes("from") || message.includes("domain")) return "invalid_sender";
  return "provider_error";
}

/**
 * Canonical delivery orchestration for a server-issued Founder invitation.
 *
 * `issueRpc` is intentionally the only configurable step. Both create and
 * reissue use caller-authenticated SQL to mint the credential, then share the
 * same controlled recipient, token confinement, delivery-attempt audit, and
 * fail-then-revoke compensation. The request body never carries an email,
 * token, URL, or provider field.
 */
export function createFounderInvitationDeliveryHandler(
  dependencies: FounderInvitationDeliveryDependencies,
  options: {
    issueRpc: "admin_create_founder_invitation" | "admin_reissue_founder_invitation";
    verb: "create" | "reissue";
    logPrefix: string;
  }
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return errorResponse("Method not allowed", 405);

    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      return errorResponse("Unauthorized", 401);
    }

    const caller = dependencies.createCallerClient(authorization);
    let callerResult: AuthResult<{ user: User | null }>;
    try {
      callerResult = await caller.auth.getUser();
    } catch {
      return errorResponse("Unauthorized", 401);
    }
    const user = callerResult.data.user;
    if (callerResult.error || !user) return errorResponse("Unauthorized", 401);
    if (user.app_metadata?.role !== "admin") return errorResponse("Forbidden", 403);

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return errorResponse("founderRequestId is required", 400);
    }
    const founderRequestId = (body as { founderRequestId?: unknown }).founderRequestId;
    if (typeof founderRequestId !== "string" || founderRequestId.length === 0) {
      return errorResponse("founderRequestId is required", 400);
    }

    const issueResult = await caller.rpc(options.issueRpc, {
      p_founder_request_id: founderRequestId,
    });
    if (issueResult.error) {
      dependencies.log(`${options.logPrefix}: invitation ${options.verb} failed`, {
        userId: user.id,
        code: issueResult.error.code,
      });
      return mapInvitationIssueError(issueResult.error, options.verb);
    }
    const invitation = issueResult.data as IssuedFounderInvitation | null;
    if (!invitation || typeof invitation.token !== "string") {
      dependencies.log(`${options.logPrefix}: RPC returned no invitation data`, { userId: user.id });
      return errorResponse(`Unable to ${options.verb} invitation`, 500);
    }

    const acceptUrl = `${dependencies.acceptUrlBase}?token=${encodeURIComponent(invitation.token)}`;
    const content = founderInvitationEmailContent({
      organizationName: invitation.organizationName,
      acceptUrl,
      expiresAtIso: invitation.expiresAt,
    });

    let sendResult: ResendResult | null = null;
    let thrown: unknown = null;
    try {
      sendResult = await dependencies.resend.emails.send({
        from: dependencies.from,
        to: invitation.email,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch (err) {
      thrown = err;
    }

    const succeeded = !thrown && sendResult && !sendResult.error && sendResult.data?.id;
    if (succeeded) {
      const recordResult = await caller.rpc("admin_record_founder_invitation_delivery_attempt", {
        p_invitation_id: invitation.id,
        p_status: "sent",
        p_provider_message_id: sendResult.data.id,
        p_provider: "resend",
      });
      if (recordResult.error) {
        dependencies.log(`${options.logPrefix}: delivery recording failed after successful send`, {
          invitationId: invitation.id,
          code: recordResult.error.code,
        });
      }
      return json({
        success: true,
        invitationId: invitation.id,
        email: invitation.email,
        expiresAt: invitation.expiresAt,
      });
    }

    const errorCode = classifyFounderInvitationResendFailure(sendResult, thrown);
    const recordResult = await caller.rpc("admin_record_founder_invitation_delivery_attempt", {
      p_invitation_id: invitation.id,
      p_status: "failed",
      p_error_code: errorCode,
      p_provider: "resend",
    });
    if (recordResult.error) {
      dependencies.log(`${options.logPrefix}: failed delivery recording also failed`, {
        invitationId: invitation.id,
        code: recordResult.error.code,
      });
    }

    const revokeResult = await caller.rpc("admin_revoke_founder_invitation", {
      p_invitation_id: invitation.id,
    });
    if (revokeResult.error) {
      dependencies.log(`${options.logPrefix}: compensating revoke failed`, {
        invitationId: invitation.id,
        code: revokeResult.error.code,
      });
    }

    dependencies.log(`${options.logPrefix}: email send failed`, {
      invitationId: invitation.id,
      errorCode,
    });
    return errorResponse("Invitation created, but the email could not be sent. Please try again.", 502);
  };
}

export function createSendFounderInvitationHandler(dependencies: SendFounderInvitationDependencies) {
  return createFounderInvitationDeliveryHandler(dependencies, {
    issueRpc: "admin_create_founder_invitation",
    verb: "create",
    logPrefix: "send-founder-invitation",
  });
}

// --- Runtime wiring ---------------------------------------------------

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function runtimeDependencies(): SendFounderInvitationDependencies {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const resendKey = requiredEnvironment("RESEND_API_KEY");

  const acceptUrlBase = founderAcceptUrl(Deno.env.get("ENVIRONMENT") === "production" ? "production" : "local");

  return {
    createCallerClient: (authorization: string) => {
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return {
        auth: { getUser: () => client.auth.getUser() },
        rpc: (fn: string, args: Record<string, unknown>) =>
          client.rpc(fn, args) as unknown as Promise<RpcResult<unknown>>,
      };
    },
    resend: new Resend(resendKey),
    from: Deno.env.get("AUTH_EMAIL_FROM") ?? "SalsaSegura <onboarding@resend.dev>",
    acceptUrlBase,
    log: (message, details) => console.error(message, details),
  };
}

if (import.meta.main) {
  serve(async (request) => {
    try {
      return await createSendFounderInvitationHandler(runtimeDependencies())(request);
    } catch (err) {
      console.error("send-founder-invitation: configuration error", err);
      return errorResponse("Invitation service is unavailable", 500);
    }
  });
}
