import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@6.26.0";
import { classifyResendFailure, type ResendResult } from "../_shared/emailLayout.ts";
import { organizerInvitationEmailContent } from "../_shared/organizerInvitationEmail.ts";
import { isValidInviteRedirect, resolveInviteRedirectUrl } from "../_shared/invitation.ts";

/**
 * POST /functions/v1/resend-organizer-invitation
 *
 * Admin-only re-send of an organizer invitation that was never accepted.
 * `invite-organizer` provisions the account and sends the first email
 * through the Supabase Auth Send Email hook; this function mints a fresh
 * single-use invite credential for that same account and delivers it via
 * Resend using the one shared invitation email.
 *
 * Trust boundaries, mirroring invite-organizer:
 *   - the caller must be an admin (JWT app_metadata role)
 *   - the recipient address is read server-side from the target Auth user,
 *     never from the request body — the caller supplies only a user id
 *   - the redirect destination comes from server configuration
 *     (resolveInviteRedirectUrl) and fails closed
 *   - the minted credential is never logged and never returned
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

type User = {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  app_metadata?: Record<string, unknown> | null;
};

type AuthError = { message?: string; code?: string };
type AuthResult<T> = { data: T; error: AuthError | null };
type TableResult = { error: { message?: string } | null };

type CallerClient = {
  auth: { getUser: () => Promise<AuthResult<{ user: User | null }>> };
};

export type ServiceClient = {
  auth: {
    admin: {
      getUserById: (id: string) => Promise<AuthResult<{ user: User | null }>>;
      generateLink: (params: {
        type: "invite";
        email: string;
        options: { redirectTo: string };
      }) => Promise<AuthResult<{ properties: { action_link?: string } | null }>>;
    };
  };
  from: (table: "audit_logs") => {
    insert: (values: Record<string, unknown>) => Promise<TableResult>;
  };
};

export type ResendOrganizerInvitationDependencies = {
  createCallerClient: (authorization: string) => CallerClient;
  createServiceClient: () => ServiceClient;
  resend: {
    emails: {
      send: (
        message: { from: string; to: string; subject: string; html: string; text: string },
        options?: { idempotencyKey: string }
      ) => Promise<ResendResult>;
    };
  };
  from: string;
  redirectUrl: string | null;
  log: (message: string, details: Record<string, string>) => void;
};

type ResendInvitationRequest = { userId?: unknown; idempotencyKey?: unknown };

const UUID_SHAPE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createResendOrganizerInvitationHandler(
  dependencies: ResendOrganizerInvitationDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (request.method !== "POST") return error("Method not allowed", 405);

    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      return error("Unauthorized", 401);
    }

    let callerResult: AuthResult<{ user: User | null }>;
    try {
      callerResult = await dependencies.createCallerClient(authorization).auth
        .getUser();
    } catch {
      return error("Unauthorized", 401);
    }
    const caller = callerResult.data.user;
    if (callerResult.error || !caller) return error("Unauthorized", 401);
    if (caller.app_metadata?.role !== "admin") return error("Forbidden", 403);

    if (
      !dependencies.redirectUrl ||
      !isValidInviteRedirect(dependencies.redirectUrl)
    ) {
      dependencies.log("resend-organizer-invitation invalid redirect configuration", {
        userId: caller.id,
      });
      return error("Invitation service is unavailable", 500);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("Invalid JSON body", 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return error("A user id is required", 400);
    }
    const payload = body as ResendInvitationRequest;
    const userId = typeof payload.userId === "string" ? payload.userId.trim() : "";
    if (!UUID_SHAPE.test(userId)) return error("A user id is required", 400);
    // Used only as the provider idempotency key, so a double-clicked Resend
    // delivers one email. It can never influence recipient or redirect.
    const idempotencyKey =
      typeof payload.idempotencyKey === "string" && UUID_SHAPE.test(payload.idempotencyKey.trim())
        ? payload.idempotencyKey.trim()
        : null;
    if (!idempotencyKey) return error("An idempotency key is required", 400);

    let service: ServiceClient;
    try {
      service = dependencies.createServiceClient();
    } catch {
      dependencies.log("resend-organizer-invitation service configuration unavailable", {
        userId: caller.id,
      });
      return error("Invitation service is unavailable", 500);
    }

    let target: AuthResult<{ user: User | null }>;
    try {
      target = await service.auth.admin.getUserById(userId);
    } catch {
      dependencies.log("resend-organizer-invitation target lookup failed", {
        actorId: caller.id,
        targetId: userId,
      });
      return error("Unable to resend invitation; please try again", 500);
    }
    const invited = target.data.user;
    if (target.error || !invited) return error("Account not found", 404);

    // Recipient identity is server-side truth, never the request body.
    const email = invited.email?.trim() ?? "";
    if (!email) return error("Account not found", 404);
    if (invited.app_metadata?.role !== "organizer") {
      return error("This account has no organizer invitation to resend", 409);
    }
    if (invited.email_confirmed_at) {
      return error("This invitation has already been accepted", 409);
    }

    let link: AuthResult<{ properties: { action_link?: string } | null }>;
    try {
      link = await service.auth.admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo: dependencies.redirectUrl },
      });
    } catch {
      dependencies.log("resend-organizer-invitation link generation failed", {
        actorId: caller.id,
        targetId: userId,
      });
      return error("Unable to resend invitation; please try again", 500);
    }
    const acceptUrl = link.data.properties?.action_link ?? "";
    if (link.error || !acceptUrl) {
      dependencies.log("resend-organizer-invitation link generation failed", {
        actorId: caller.id,
        targetId: userId,
      });
      return error("Unable to resend invitation; please try again", 500);
    }

    const content = organizerInvitationEmailContent({ acceptUrl, isResend: true });
    let sendResult: ResendResult | null = null;
    let thrown: unknown = null;
    try {
      sendResult = await dependencies.resend.emails.send(
        { from: dependencies.from, to: email, ...content },
        { idempotencyKey },
      );
    } catch (caught) {
      thrown = caught;
    }
    if (thrown || sendResult?.error || !sendResult?.data?.id) {
      // Category only — never the provider body, never the credential URL.
      dependencies.log("resend-organizer-invitation delivery failed", {
        actorId: caller.id,
        targetId: userId,
        reason: classifyResendFailure(sendResult, thrown),
      });
      return error("Unable to resend invitation; please try again", 500);
    }

    // The audit record is the durable trace of who resent what, and carries
    // the provider message id — never the invitation credential.
    const audit = await service.from("audit_logs").insert({
      actor_id: caller.id,
      action: "user.invitation_resent",
      entity_type: "profile",
      entity_id: invited.id,
      metadata: { email, role: "organizer", provider_message_id: sendResult.data.id },
    });
    if (!audit || audit.error) {
      dependencies.log("resend-organizer-invitation audit write failed", {
        actorId: caller.id,
        targetId: userId,
      });
      // The email is already delivered; failing the request here would invite
      // a retry that sends a second one. Report success, keep the log.
    }

    return json({ delivery: "email_invitation", userId: invited.id, email }, 200);
  };
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function runtimeDependencies(): ResendOrganizerInvitationDependencies {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const resendKey = requiredEnvironment("RESEND_API_KEY");
  const from = requiredEnvironment("AUTH_EMAIL_FROM");

  const redirectUrl = resolveInviteRedirectUrl({
    ENVIRONMENT: Deno.env.get("ENVIRONMENT"),
    AUTH_EXTERNAL_URL: Deno.env.get("AUTH_EXTERNAL_URL"),
    INVITE_REDIRECT_URL: Deno.env.get("INVITE_REDIRECT_URL"),
  });

  return {
    createCallerClient: (authorization) =>
      createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as CallerClient,
    // The service-role key is read only after the caller has passed the
    // authentication and authorization boundary.
    createServiceClient: () => {
      const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
      return createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      }) as unknown as ServiceClient;
    },
    resend: new Resend(resendKey),
    from,
    redirectUrl,
    log: (message, details) => console.error(message, details),
  };
}

if (import.meta.main) {
  serve((request) =>
    createResendOrganizerInvitationHandler(runtimeDependencies())(request)
  );
}
