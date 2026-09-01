import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { founderWelcomeEmailContent } from "../_shared/founderWelcomeEmail.ts";
import { hostDashboardUrl } from "../_shared/invitation.ts";
import { classifyResendFailure, type ResendResult } from "../_shared/emailLayout.ts";

/**
 * POST /functions/v1/send-founder-welcome-email
 * Body: {} (ignored — see ANTI-RELAY note below)
 *
 * The optional Phase 8 Founder welcome email. Sent once, only after
 * organization provisioning succeeds (`founder_access_requests.organizer_id`
 * is set), to the email address on the caller's own Supabase Auth account.
 *
 * ANTI-RELAY INVARIANT: the request body is never read. There is no
 * recipient, subject, or content parameter for a caller to supply — the
 * ONLY input to this function is the caller's own Bearer JWT. The claim
 * RPC derives everything (organizer, organization name, recipient email)
 * server-side from `auth.uid()`. This cannot become a generic mail relay:
 * there is nothing in the request for a caller to redirect it with.
 *
 * AUTHORIZATION: always a self-service call with the caller's own JWT
 * (never the service role) — the founder emailing themselves about their
 * own organization. `claim_founder_welcome_email()` is itself the
 * authorization boundary: it can only ever touch the row belonging to
 * whichever founder_access_request `auth.uid()` accepted an invitation
 * for, and only once organizer_id is set.
 *
 * IDEMPOTENCY: `claim_founder_welcome_email()` is an atomic UPDATE guarded
 * by `welcome_email_status is null`, taken BEFORE the Resend call — the
 * same claim-before-send principle as send-submission-email. A page
 * refresh, a second tab, or a client retry all collide on the same
 * guarded UPDATE and send nothing.
 *
 * RELIABILITY: never mutates provisioning state. A send failure is
 * recorded via complete_founder_welcome_email(failed, ...) and returned
 * as non-2xx; the organizer + owner membership already committed and
 * stand regardless (spec §19).
 */

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

type AuthError = { message?: string };
type PostgrestError = { code?: string; message?: string };
type RpcResult<T> = { data: T | null; error: PostgrestError | null };

type ClaimResult = {
  claimed: boolean;
  organizerId?: string;
  organizationName?: string;
  recipientEmail?: string;
};

type ResendMessage = { from: string; to: string; subject: string; html: string; text: string };
type ResendSendOptions = { idempotencyKey: string };

export type SendFounderWelcomeEmailDependencies = {
  /** Runs `claim_founder_welcome_email()` as the caller — never the service role. */
  claim: (authorization: string) => Promise<RpcResult<ClaimResult>>;
  /** Runs `complete_founder_welcome_email(status, error_code)` as the caller. */
  complete: (
    authorization: string,
    status: "sent" | "failed",
    errorCode: string | null
  ) => Promise<RpcResult<boolean>>;
  /** Verifies the bearer token resolves to a real user — 401s a malformed/expired one early. */
  authenticateCaller: (authorization: string) => Promise<{ error: AuthError | null }>;
  resend: {
    emails: { send: (message: ResendMessage, options?: ResendSendOptions) => Promise<ResendResult> };
  };
  from: string;
  platformName: string;
  supportEmail: string;
  hostDashboardUrl: string;
  log: (message: string, details?: Record<string, unknown>) => void;
};

export function createSendFounderWelcomeEmailHandler(dependencies: SendFounderWelcomeEmailDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return errorResponse("Method not allowed", 405);

    const authorization = request.headers.get("authorization");
    if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
      return errorResponse("Unauthorized", 401);
    }

    // The body is deliberately never parsed — see ANTI-RELAY note above.
    // Draining it (without acting on the content) lets a caller send a
    // body without the request hanging; its contents are discarded.
    try {
      await request.text();
    } catch {
      /* ignore — nothing here depends on the body */
    }

    let auth: { error: AuthError | null };
    try {
      auth = await dependencies.authenticateCaller(authorization);
    } catch {
      return errorResponse("Unauthorized", 401);
    }
    if (auth.error) return errorResponse("Unauthorized", 401);

    const claimResult = await dependencies.claim(authorization);
    if (claimResult.error) {
      dependencies.log("send-founder-welcome-email: claim failed", { code: claimResult.error.code });
      return errorResponse("Email service is unavailable", 503);
    }
    const claim = claimResult.data;
    if (!claim || !claim.claimed) {
      // Already sent, in flight elsewhere, or not yet provisioned — every
      // case where this caller must not send.
      return json({ success: true, deduplicated: true });
    }
    if (!claim.recipientEmail || !claim.recipientEmail.includes("@")) {
      await dependencies.complete(authorization, "failed", "no_recipient");
      return json({ success: false, skipped: "no_recipient" }, 200);
    }

    const content = founderWelcomeEmailContent({
      platformName: dependencies.platformName,
      organizationName: claim.organizationName ?? "your organization",
      hostDashboardUrl: dependencies.hostDashboardUrl,
      supportEmail: dependencies.supportEmail,
    });

    let sendResult: ResendResult | null = null;
    let thrown: unknown = null;
    try {
      sendResult = await dependencies.resend.emails.send(
        {
          from: dependencies.from,
          to: claim.recipientEmail,
          subject: content.subject,
          html: content.html,
          text: content.text,
        },
        // Deterministic per organizer — this is a one-shot email, so the
        // organizer id alone is a stable, sufficient key. Covers a crash
        // after Resend accepted the message but before the claim closed.
        { idempotencyKey: `founder-welcome-${claim.organizerId}` }
      );
    } catch (err) {
      thrown = err;
    }

    const providerMessageId = sendResult?.data?.id ?? null;
    const succeeded = !thrown && sendResult && !sendResult.error && providerMessageId;

    if (succeeded) {
      const completion = await dependencies.complete(authorization, "sent", null);
      if (completion.error) {
        dependencies.log("send-founder-welcome-email: completion write failed after successful send", {
          code: completion.error.code,
        });
      }
      return json({ success: true, id: providerMessageId });
    }

    const errorCode = classifyResendFailure(sendResult, thrown);
    const completion = await dependencies.complete(authorization, "failed", errorCode);
    if (completion.error) {
      dependencies.log("send-founder-welcome-email: failed-completion write also failed", {
        code: completion.error.code,
      });
    }

    dependencies.log("send-founder-welcome-email: send failed", { errorCode });
    return json({ success: false, error: "The welcome email could not be sent.", errorCode }, 502);
  };
}

// --- Runtime wiring ---------------------------------------------------

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function runtimeDependencies(): SendFounderWelcomeEmailDependencies {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const resendKey = requiredEnvironment("RESEND_API_KEY");

  const callerClient = (authorization: string) =>
    createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

  return {
    authenticateCaller: async (authorization) => {
      const { error } = await callerClient(authorization).auth.getUser();
      return { error: error as unknown as AuthError | null };
    },

    claim: async (authorization) => {
      const result = await callerClient(authorization).rpc("claim_founder_welcome_email");
      return result as unknown as RpcResult<ClaimResult>;
    },

    complete: async (authorization, status, errorCode) => {
      const result = await callerClient(authorization).rpc("complete_founder_welcome_email", {
        p_status: status,
        p_error_code: errorCode,
      });
      return result as unknown as RpcResult<boolean>;
    },

    resend: new Resend(resendKey),
    from: Deno.env.get("AUTH_EMAIL_FROM") ?? "SalsaSegura <onboarding@resend.dev>",
    platformName: "Salsa Segura",
    supportEmail: "info@salsasegura.com",
    hostDashboardUrl: hostDashboardUrl(Deno.env.get("ENVIRONMENT") === "production" ? "production" : "local"),
    log: (message, details) => console.error(message, details),
  };
}

if (import.meta.main) {
  serve(async (request) => {
    try {
      return await createSendFounderWelcomeEmailHandler(runtimeDependencies())(request);
    } catch (err) {
      console.error("send-founder-welcome-email: configuration error", err);
      return errorResponse("Email service is unavailable", 500);
    }
  });
}
