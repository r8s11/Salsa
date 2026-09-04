import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@6.26.0";
import {
  validateAndNormalize,
  isHoneypotTripped,
} from "../_shared/founderRequest.ts";
import { founderRequestAdminNotificationEmail } from "../_shared/founderRequestNotificationEmail.ts";
import { classifyResendFailure } from "../_shared/emailLayout.ts";

/**
 * POST /functions/v1/request-founder-access
 *
 * Public, unauthenticated Founder/Host access request intake — the ONLY
 * write path for public submissions into founder_access_requests.
 *
 * Pipeline: body-size guard → JSON parse → honeypot → authoritative
 * validation/normalization (shared module) → duplicate check → insert
 * with status forced to 'pending' → automatic internal admin
 * notification attempt.
 *
 * Responses are enumeration-safe: every successful path returns the exact
 * same body whether a row was inserted, a duplicate was suppressed, or a
 * honeypot was tripped — nothing reveals whether a given email has
 * applied, and no admin workflow state is exposed.
 *
 * The gateway keeps default JWT verification: callers must present a
 * valid Supabase key (the frontend uses supabase.functions.invoke, which
 * always sends the publishable key or a session token). No caller
 * identity is used for authorization — payload validation is the whole
 * boundary.
 *
 * ADMIN NOTIFICATION, ANTI-RELAY. After — and only after — a fresh row
 * is durably inserted, this function attempts one internal notification
 * to `platform_settings.support_email`, mirroring the invariant
 * established by send-submission-email: the caller (an anonymous
 * applicant) supplies none of the recipient, subject, or body — those
 * are derived entirely server-side from the row just inserted and from
 * trusted platform configuration. A duplicate or honeypot outcome never
 * triggers a notification (spec §7/§8): only the branch that actually
 * performs the INSERT calls the notification helper.
 *
 * RELIABILITY. The notification is attempted after the insert commits
 * and is never allowed to change the public response or roll back the
 * request. A send failure — including a missing recipient or missing
 * Resend configuration — is recorded in
 * founder_request_notification_attempts and logged; the caller still
 * receives SUCCESS_RESPONSE. Idempotency is enforced the same way as
 * the four event-submission emails: an atomic claim, keyed on
 * (request_id, email_event), taken before the provider call.
 */
export interface FounderAccessResponse {
  success: boolean;
}

const MAX_BODY_BYTES = 10_000;
const MAX_EMAIL = 320;
// Same shape as the database rule in
// sql/submission-emails/002_anon_submitter_contact_required.sql and
// send-submission-email's normalizedRecipient(), so every layer agrees on
// what a plausible, header-injection-safe address looks like.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Every successful path returns this exact body. A response that varied
// with applicant state would let anyone probe arbitrary emails to learn
// who has applied (spec §11/§13 — enumeration-safe).
const SUCCESS_RESPONSE: FounderAccessResponse = { success: true };

// --- Dependency seam (mirrors invite-organizer's ServiceClient pattern) ---

type MaybeSingleResult = Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
type InsertedRow = { id: string; created_at: string };
type InsertResult = Promise<{ data: InsertedRow | null; error: { code?: string; message?: string } | null }>;

export type FounderAccessTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => MaybeSingleResult;
      };
    };
  };
  insert: (values: Record<string, unknown>) => {
    select: (columns: string) => {
      single: () => InsertResult;
    };
  };
};

type PostgrestError = { code?: string; message?: string };
type QueryResult<T> = { data: T | null; error: PostgrestError | null };
type SettingsRow = { platform_name: string; support_email: string };

type ResendMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};
type ResendResult = {
  data: { id?: string } | null;
  error: { message?: string; name?: string } | null;
};

/**
 * The internal admin-notification dependencies. `resend` is nullable —
 * when RESEND_API_KEY is not configured, the notification is skipped
 * (recorded as a `configuration_error` attempt) rather than the whole
 * function failing to boot. The public submission path never depends on
 * any of these.
 */
export type FounderRequestNotifyDependencies = {
  readSettings: () => Promise<QueryResult<SettingsRow>>;
  /** Atomically claims the right to send one admin notification for this request. */
  claimAttempt: (requestId: string) => Promise<{ attemptId: string | null; error: PostgrestError | null }>;
  /** Closes a claim opened by claimAttempt as sent or failed. */
  completeAttempt: (attempt: {
    attemptId: string;
    status: "sent" | "failed";
    providerMessageId: string | null;
    errorCode: string | null;
  }) => Promise<{ error: PostgrestError | null }>;
  resend: {
    emails: {
      send: (message: ResendMessage, options?: { idempotencyKey: string }) => Promise<ResendResult>;
    };
  } | null;
  from: string;
  /** `${AUTH_EXTERNAL_URL}/admin/founder-requests/`, or null when unconfigured/unparseable. */
  reviewUrlBase: string | null;
  log: (message: string, details?: Record<string, unknown>) => void;
};

export type FounderAccessDependencies = {
  service: { from: (table: "founder_access_requests") => FounderAccessTable };
  notify: FounderRequestNotifyDependencies;
  log: (message: string) => void;
};

// --- Handler --------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

function isDuplicateInsertError(error: { code?: string; message?: string }): boolean {
  // 23505 = unique_violation; the partial unique index on
  // (normalized_email) where status='pending' makes this the atomic
  // backstop for two concurrent submissions racing the pre-check.
  return error.code === "23505" || /duplicate key/i.test(error.message ?? "");
}

/** Validates a stored/derived address before it is handed to the provider. */
function normalizedRecipient(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_EMAIL) return null;
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * Attempts the internal admin notification for one freshly inserted
 * Founder request. Never throws and never returns a value the caller
 * needs to act on — a failure here is diagnosable through
 * founder_request_notification_attempts, never a reason to change the
 * public response.
 */
async function attemptFounderRequestAdminNotification(
  notify: FounderRequestNotifyDependencies,
  request: {
    requestId: string;
    applicantName: string;
    email: string;
    organizationName: string;
    instagram: string | null;
    website: string | null;
    city: string | null;
    region: string | null;
    submittedAt: string;
  }
): Promise<void> {
  const claim = await notify.claimAttempt(request.requestId);
  if (claim.error) {
    notify.log("request-founder-access: notification claim failed", {
      requestId: request.requestId,
      code: claim.error.code,
    });
    return;
  }
  if (!claim.attemptId) return; // already sent, or another caller holds the claim
  const attemptId = claim.attemptId;

  const settingsResult = await notify.readSettings();
  if (settingsResult.error || !settingsResult.data || !notify.resend) {
    await notify.completeAttempt({
      attemptId,
      status: "failed",
      providerMessageId: null,
      errorCode: "configuration_error",
    });
    notify.log("request-founder-access: notification configuration unavailable", {
      requestId: request.requestId,
      settingsError: settingsResult.error?.code,
      resendConfigured: notify.resend !== null,
    });
    return;
  }

  const recipient = normalizedRecipient(settingsResult.data.support_email);
  if (!recipient) {
    await notify.completeAttempt({
      attemptId,
      status: "failed",
      providerMessageId: null,
      errorCode: settingsResult.data.support_email ? "invalid_recipient" : "no_recipient",
    });
    notify.log("request-founder-access: unusable admin recipient", { requestId: request.requestId });
    return;
  }

  const reviewUrl = notify.reviewUrlBase ? `${notify.reviewUrlBase}${request.requestId}` : null;
  const content = founderRequestAdminNotificationEmail({
    platformName: settingsResult.data.platform_name,
    facts: {
      requestId: request.requestId,
      applicantName: request.applicantName,
      email: request.email,
      organizationName: request.organizationName,
      instagram: request.instagram,
      website: request.website,
      city: request.city,
      region: request.region,
      submittedAt: request.submittedAt,
    },
    reviewUrl,
  });

  // Replying to the notification reaches the applicant directly — the
  // useful default for a moderator following up on a review.
  const replyTo = normalizedRecipient(request.email) ?? undefined;

  let sendResult: ResendResult | null = null;
  let thrown: unknown = null;
  try {
    sendResult = await notify.resend.emails.send(
      {
        from: notify.from,
        to: recipient,
        subject: content.subject,
        html: content.html,
        text: content.text,
        ...(replyTo ? { replyTo } : {}),
      },
      // Deterministic per request: covers a crash after Resend accepted the
      // message but before the claim was closed — a later retry then
      // returns the original message instead of sending a second copy.
      { idempotencyKey: `founder-request-${request.requestId}-admin_request_notification` }
    );
  } catch (err) {
    thrown = err;
  }

  const providerMessageId = sendResult?.data?.id ?? null;
  const succeeded = !thrown && sendResult && !sendResult.error && providerMessageId;

  if (succeeded) {
    await notify.completeAttempt({ attemptId, status: "sent", providerMessageId, errorCode: null });
    return;
  }

  const errorCode = classifyResendFailure(sendResult, thrown);
  await notify.completeAttempt({ attemptId, status: "failed", providerMessageId: null, errorCode });
  notify.log("request-founder-access: notification send failed", {
    requestId: request.requestId,
    errorCode,
  });
}

export function createRequestFounderAccessHandler(dependencies: FounderAccessDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: CORS_HEADERS });
    }
    const declaredLength = Number(req.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return errorResponse("Request body too large", 413);
    }
    if (req.method !== "POST") {
      return errorResponse("Method not allowed", 405);
    }

    let raw: string;
    try {
      raw = await req.text();
    } catch {
      return errorResponse("Unable to read request body", 400);
    }
    if (raw.length > MAX_BODY_BYTES) {
      return errorResponse("Request body too large", 413);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(raw);
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }

    // Honeypot: a filled hidden field means a bot — answer with the normal
    // success body, insert nothing, and notify nobody.
    if (isHoneypotTripped(payload)) {
      return json(SUCCESS_RESPONSE);
    }

    const outcome = validateAndNormalize(payload);
    if (!outcome.ok) {
      return errorResponse(outcome.error, 400);
    }
    const data = outcome.data;

    // Duplicate policy: one pending request per normalized email. The
    // response is identical to a fresh submission (privacy — never reveal
    // that a specific person has applied), and no notification is sent.
    const { data: existing, error: selectError } = await dependencies.service
      .from("founder_access_requests")
      .select("id")
      .eq("normalized_email", data.email)
      .eq("status", "pending")
      .maybeSingle();

    if (selectError) {
      dependencies.log(`founder-access duplicate check failed: ${selectError.message ?? "unknown"}`);
      return errorResponse("Unable to submit request right now. Please try again.", 500);
    }
    if (existing) {
      return json(SUCCESS_RESPONSE);
    }

    // status is hardcoded — a client-supplied status is never read
    // (validateAndNormalize ignores unknown fields entirely).
    const { data: inserted, error: insertError } = await dependencies.service
      .from("founder_access_requests")
      .insert({
        applicant_name: data.applicantName,
        email: data.email,
        normalized_email: data.email,
        organization_name: data.organizationName,
        normalized_org_name: data.normalizedOrgName,
        instagram: data.instagram ?? null,
        normalized_instagram: data.instagram ?? null,
        website: data.website ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        description: data.description ?? null,
        message: data.message ?? null,
        status: "pending",
      })
      .select("id,created_at")
      .single();

    if (insertError || !inserted) {
      if (insertError && isDuplicateInsertError(insertError)) {
        // Lost a concurrent-submission race to the partial unique index —
        // the same enumeration-safe success as an ordinary duplicate. The
        // caller that actually won the race is the only one that notifies.
        return json(SUCCESS_RESPONSE);
      }
      dependencies.log(`founder-access insert failed: ${insertError?.message ?? "unknown"}`);
      return errorResponse("Unable to submit request right now. Please try again.", 500);
    }

    // Insert committed. The public response is already decided — a
    // notification failure below can never change it or roll the request
    // back (spec §4/§12).
    try {
      await attemptFounderRequestAdminNotification(dependencies.notify, {
        requestId: inserted.id,
        applicantName: data.applicantName,
        email: data.email,
        organizationName: data.organizationName,
        instagram: data.instagram ?? null,
        website: data.website ?? null,
        city: data.city ?? null,
        region: data.region ?? null,
        submittedAt: inserted.created_at,
      });
    } catch (err) {
      dependencies.log(
        `founder-access notification threw: ${err instanceof Error ? err.message : "unknown"}`
      );
    }

    return json(SUCCESS_RESPONSE);
  };
}

// --- Runtime wiring --------------------------------------------------------

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

/** `${base}/admin/founder-requests/`, or null when base is missing/unparseable. */
function buildReviewUrlBase(): string | null {
  const raw = Deno.env.get("AUTH_EXTERNAL_URL");
  if (!raw) return null;
  try {
    return new URL("/admin/founder-requests/", new URL(raw)).toString();
  } catch {
    return null;
  }
}

function runtimeDependencies(): FounderAccessDependencies {
  const client = createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );

  // Notification configuration is intentionally read with Deno.env.get
  // (never requiredEnvironment) — a missing Resend key or external URL
  // must not stop the function from booting or from accepting the
  // public submission it exists to serve.
  const resendKey = Deno.env.get("RESEND_API_KEY");

  return {
    // Structural seam over the supabase-js client: the handler touches only
    // select/eq/maybeSingle and insert/select/single on this one table.
    service: client as unknown as FounderAccessDependencies["service"],
    notify: {
      readSettings: async () => {
        const result = await client
          .from("platform_settings")
          .select("platform_name,support_email")
          .eq("singleton", true)
          .maybeSingle();
        return result as unknown as QueryResult<SettingsRow>;
      },
      claimAttempt: async (requestId) => {
        const result = await client.rpc("claim_founder_request_notification_attempt", {
          p_request_id: requestId,
        });
        if (result.error) {
          return { attemptId: null, error: result.error as unknown as PostgrestError };
        }
        const attemptId =
          typeof result.data === "string" && result.data.length > 0 ? result.data : null;
        return { attemptId, error: null };
      },
      completeAttempt: async (attempt) => {
        const result = await client.rpc("complete_founder_request_notification_attempt", {
          p_attempt_id: attempt.attemptId,
          p_status: attempt.status,
          p_provider_message_id: attempt.providerMessageId,
          p_error_code: attempt.errorCode,
        });
        return { error: (result.error as unknown as PostgrestError | null) ?? null };
      },
      resend: resendKey ? new Resend(resendKey) : null,
      from: Deno.env.get("AUTH_EMAIL_FROM") ?? "SalsaSegura <onboarding@resend.dev>",
      reviewUrlBase: buildReviewUrlBase(),
      log: (message, details) => console.error(message, details),
    },
    log: (message: string) => console.log(message),
  };
}

if (import.meta.main) {
  serve((req) => createRequestFounderAccessHandler(runtimeDependencies())(req));
}
