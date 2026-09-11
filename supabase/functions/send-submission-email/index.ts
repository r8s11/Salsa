import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@6.26.0";
import {
  submissionReceivedEmail,
  submissionAwaitingReviewEmail,
  submissionApprovedEmail,
  submissionRejectedEmail,
  type SubmissionEmailContent,
  type SubmissionEventFacts,
} from "../_shared/submissionEmail.ts";
import { classifyResendFailure } from "../_shared/emailLayout.ts";

/**
 * POST /functions/v1/send-submission-email
 * Body: { submissionId: uuid, event: "received"|"awaiting_review"|"approved"|"rejected" }
 *
 * The four transactional emails for the existing anonymous Event Submission
 * workflow. This function replaces the previous `send-email` function, which
 * accepted caller-supplied `from`/`to`/`subject`/`html` and was therefore an
 * open relay reachable by anyone holding the publishable key.
 *
 * THE ANTI-RELAY INVARIANT: the caller supplies a submission id and an event
 * name. Nothing else. Every recipient address is read server-side —
 * submitter mail from `event_submissions.submitter_email`, moderator mail from
 * `platform_settings.support_email`. There is no code path by which a caller
 * can influence who receives mail.
 *
 * Authorization is per event:
 *   received / awaiting_review — no user session required (the submitter is
 *     anonymous by design). Abuse is bounded instead by: the submission must
 *     exist, must still be `pending`, must have been created inside
 *     SUBMISSION_FRESHNESS_MS, and each (submission, event) pair can only
 *     succeed once (unique index on the attempts table). Replaying an old or
 *     invented id sends nothing.
 *   approved / rejected — requires a Bearer JWT whose `app_metadata.role` is
 *     admin or moderator, AND the submission must actually already be in that
 *     terminal state. The email can never claim an outcome the database
 *     does not agree with, and it is only sent after the state change
 *     committed.
 *
 * RELIABILITY: the database is the source of truth. This function never
 * mutates a submission and never rolls anything back. A send failure is
 * recorded in `event_submission_email_attempts` and returned as a non-2xx,
 * but the submission/approval/rejection stands. Callers treat it as
 * fire-and-forget.
 */

const SUBMISSION_FRESHNESS_MS = 15 * 60 * 1000;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 2_048;

const EMAIL_EVENTS = ["received", "awaiting_review", "approved", "rejected"] as const;
export type SubmissionEmailEvent = (typeof EMAIL_EVENTS)[number];

const MODERATOR_ROLES: Record<string, true> = { admin: true, moderator: true };

// Browser-invoked via supabase.functions.invoke from the Vite origin, so the
// preflight must be answered. Same headers as delete-account/index.ts.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status: number): Response {
  return json({ error: message }, status);
}

type User = { id: string; app_metadata?: Record<string, unknown> | null };
type AuthError = { message?: string };
type PostgrestError = { code?: string; message?: string };
type AuthResult = { data: { user: User | null }; error: AuthError | null };
type QueryResult<T> = { data: T | null; error: PostgrestError | null };

type SubmissionRow = {
  id: string;
  status: string;
  submitter_email: string | null;
  submitter_name: string | null;
  submitted_data: Record<string, unknown> | null;
  edited_data: Record<string, unknown> | null;
  rejection_message: string | null;
  approved_event_id: string | null;
  submitted_at: string;
};

type SettingsRow = {
  platform_name: string;
  public_site_url: string;
  support_email: string;
};

type ResendMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};
type ResendSendOptions = { idempotencyKey: string };
type ResendResult = {
  data: { id?: string } | null;
  error: { message?: string; name?: string } | null;
};

export type SendSubmissionEmailDependencies = {
  /** Service-role reader. Used ONLY to read trusted rows, never to write submissions. */
  readSubmission: (id: string) => Promise<QueryResult<SubmissionRow>>;
  readSettings: () => Promise<QueryResult<SettingsRow>>;
  /**
   * Atomically claims the right to send one (submission, event) email BEFORE
   * the provider is called. Resolves to an attempt id on a successful claim,
   * or null when the email already sent or another caller holds the claim.
   * This — not a preceding read — is what makes concurrent retries safe.
   */
  claimAttempt: (
    submissionId: string,
    emailEvent: SubmissionEmailEvent,
    recipientKind: "submitter" | "moderator"
  ) => Promise<{ attemptId: string | null; error: PostgrestError | null }>;
  /** Closes a claim opened by claimAttempt as sent or failed. */
  completeAttempt: (attempt: {
    attemptId: string;
    status: "sent" | "failed";
    providerMessageId: string | null;
    errorCode: string | null;
  }) => Promise<{ error: PostgrestError | null }>;
  /** Caller-JWT client, used only for the moderator role check on approved/rejected. */
  authenticateCaller: (authorization: string) => Promise<AuthResult>;
  resend: {
    emails: {
      send: (message: ResendMessage, options?: ResendSendOptions) => Promise<ResendResult>;
    };
  };
  from: string;
  now: () => number;
  log: (message: string, details?: Record<string, unknown>) => void;
};

// ── Field bounds ────────────────────────────────────────────────────────────
// Every string that reaches a template is trimmed and capped here. The values
// come from the database rather than the request body, but they originated as
// free text typed by an anonymous member of the public (or, for
// rejection_message, by a moderator), so they are treated as untrusted
// presentation input all the same. Escaping happens in the template module;
// bounding happens here so a 100 KB title cannot become a 100 KB email.
const MAX_TITLE = 200;
const MAX_LOCATION = 200;
const MAX_NAME = 300;
const MAX_CITY = 100;
const MAX_REJECTION_MESSAGE = 2_000;
// RFC 5321 caps a forward-path at 320 characters.
const MAX_EMAIL = 320;

// Same shape as the database rule in
// sql/submission-emails/002_anon_submitter_contact_required.sql and
// _shared/invitation.ts normalizeEmail(), so all three layers agree.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Trims, drops empties, and caps. Returns null when unusable. */
function boundedString(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, max);
}

function stringField(
  source: Record<string, unknown> | null,
  key: string,
  max: number
): string | null {
  if (!source) return null;
  return boundedString(source[key], max);
}

/**
 * Validates a stored recipient address before it is handed to the provider.
 * A bad address is a real failure mode here: the column is nullable, and
 * rows predating the anon-contact rule can hold anything a direct REST
 * insert put there.
 */
function normalizedRecipient(value: string | null): string | null {
  const trimmed = boundedString(value, MAX_EMAIL);
  if (!trimmed) return null;
  return EMAIL_PATTERN.test(trimmed) ? trimmed : null;
}

/**
 * The effective event payload: `edited_data` overlays the immutable
 * `submitted_data`, matching `approve_event_submission`'s own coalesce rule so
 * the email describes exactly what a moderator approved.
 */
function eventFacts(row: SubmissionRow): SubmissionEventFacts | null {
  const effective = { ...(row.submitted_data ?? {}), ...(row.edited_data ?? {}) };
  const title = stringField(effective, "title", MAX_TITLE);
  if (!title) return null;
  return {
    title,
    // Date/time are only ever fed to Intl formatters, which return null for
    // anything unparseable — no length cap is meaningful, but a sane one
    // keeps a hostile value out of the formatter entirely.
    eventDateIso: stringField(effective, "event_date", 64),
    eventTime: stringField(effective, "event_time", 16),
    city: stringField(effective, "city", MAX_CITY),
    location: stringField(effective, "location", MAX_LOCATION),
  };
}

/** Only https origins from the trusted settings row are ever turned into links. */
function safeSiteOrigin(publicSiteUrl: string): string | null {
  try {
    const url = new URL(publicSiteUrl);
    if (url.protocol !== "https:") return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function createSendSubmissionEmailHandler(dependencies: SendSubmissionEmailDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
    if (request.method !== "POST") return errorResponse("Method not allowed", 405);

    // Body-size guard before parsing — mirrors request-founder-access.
    const declaredLength = Number(request.headers.get("content-length") ?? "0");
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      return errorResponse("Request body too large", 413);
    }

    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) return errorResponse("Request body too large", 413);

    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return errorResponse("Invalid JSON body", 400);
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return errorResponse("submissionId and event are required", 400);
    }

    const submissionId = (body as { submissionId?: unknown }).submissionId;
    const emailEventValue = (body as { event?: unknown }).event;

    if (typeof submissionId !== "string" || !UUID_PATTERN.test(submissionId)) {
      return errorResponse("submissionId must be a UUID", 400);
    }
    if (
      typeof emailEventValue !== "string" ||
      !(EMAIL_EVENTS as readonly string[]).includes(emailEventValue)
    ) {
      return errorResponse("event must be one of: received, awaiting_review, approved, rejected", 400);
    }
    const emailEvent = emailEventValue as SubmissionEmailEvent;
    const isModeratorEvent = emailEvent === "approved" || emailEvent === "rejected";

    // Moderator gate — enforced before any read, for the two events a
    // moderator triggers. The anonymous events are gated by row state below.
    if (isModeratorEvent) {
      const authorization = request.headers.get("authorization");
      if (!authorization || !/^Bearer\s+\S+$/i.test(authorization)) {
        return errorResponse("Unauthorized", 401);
      }
      let callerResult: AuthResult;
      try {
        callerResult = await dependencies.authenticateCaller(authorization);
      } catch {
        return errorResponse("Unauthorized", 401);
      }
      const user = callerResult.data.user;
      if (callerResult.error || !user) return errorResponse("Unauthorized", 401);
      const role = user.app_metadata?.role;
      if (typeof role !== "string" || MODERATOR_ROLES[role] !== true) {
        return errorResponse("Forbidden", 403);
      }
    }

    // NOTE: idempotency is NOT a read-then-send check — two concurrent
    // callers would both pass it and both email. The exclusive claim is
    // taken below, after the row/state reads that determine the recipient
    // kind, and strictly BEFORE the provider call.

    const submissionResult = await dependencies.readSubmission(submissionId);
    if (submissionResult.error) {
      dependencies.log("send-submission-email: submission read failed", {
        submissionId,
        code: submissionResult.error.code,
      });
      return errorResponse("Email service is unavailable", 503);
    }
    const submission = submissionResult.data;
    // A non-existent id is not an error the caller gets to distinguish — the
    // generic 404 keeps the endpoint from confirming which ids exist.
    if (!submission) return errorResponse("Submission not found", 404);

    // State gate. The email must describe reality, and for the anonymous
    // events it also bounds replay: only a still-pending, freshly created
    // submission can trigger mail.
    if (emailEvent === "received" || emailEvent === "awaiting_review") {
      if (submission.status !== "pending") {
        return errorResponse("Submission is no longer pending", 409);
      }
      const submittedAt = Date.parse(submission.submitted_at);
      if (
        !Number.isFinite(submittedAt) ||
        dependencies.now() - submittedAt > SUBMISSION_FRESHNESS_MS
      ) {
        return errorResponse("Submission is not eligible for this notification", 409);
      }
    } else if (emailEvent === "approved") {
      if (submission.status !== "approved") {
        return errorResponse("Submission is not approved", 409);
      }
    } else if (submission.status !== "rejected") {
      return errorResponse("Submission is not rejected", 409);
    }

    const facts = eventFacts(submission);
    if (!facts) {
      dependencies.log("send-submission-email: submission has no usable title", { submissionId });
      return errorResponse("Submission is missing an event title", 422);
    }

    const settingsResult = await dependencies.readSettings();
    if (settingsResult.error || !settingsResult.data) {
      dependencies.log("send-submission-email: settings read failed", {
        code: settingsResult.error?.code,
      });
      return errorResponse("Email service is unavailable", 503);
    }
    const settings = settingsResult.data;
    const origin = safeSiteOrigin(settings.public_site_url);

    // ── Recipient resolution. Server-side only, and validated. ──
    // The submitter address is nullable free text that a direct REST insert
    // could have set to anything, so it is regex-validated and length-capped
    // here rather than assumed deliverable.
    const recipientKind: "submitter" | "moderator" =
      emailEvent === "awaiting_review" ? "moderator" : "submitter";

    const submitterEmail = normalizedRecipient(submission.submitter_email);
    const submitterName = boundedString(submission.submitter_name, MAX_NAME);

    const recipient =
      recipientKind === "moderator"
        ? normalizedRecipient(settings.support_email)
        : submitterEmail;

    // ── Exclusive claim. MUST precede the provider call. ──
    // A read-then-send check would let two concurrent retries both pass and
    // both email. The claim is a single atomic INSERT guarded by a unique
    // partial index on (submission_id, email_event) for status in
    // ('pending','sent'), so exactly one caller proceeds. A null attemptId
    // means the email already sent or is in flight — this caller sends
    // nothing at all.
    const claim = await dependencies.claimAttempt(submissionId, emailEvent, recipientKind);
    if (claim.error) {
      dependencies.log("send-submission-email: claim failed", {
        submissionId,
        emailEvent,
        code: claim.error.code,
      });
      return errorResponse("Email service is unavailable", 503);
    }
    if (!claim.attemptId) {
      return json({ success: true, deduplicated: true, event: emailEvent });
    }
    const attemptId = claim.attemptId;

    if (!recipient) {
      // Either the submission genuinely has no address (legal for rows
      // predating the anon-contact rule) or the stored value is not a
      // plausible address. Close the claim as failed so the gap is
      // diagnosable and a later retry is still permitted.
      const errorCode = submission.submitter_email ? "invalid_recipient" : "no_recipient";
      await dependencies.completeAttempt({
        attemptId,
        status: "failed",
        providerMessageId: null,
        errorCode: recipientKind === "moderator" ? "invalid_sender" : errorCode,
      });
      dependencies.log("send-submission-email: unusable recipient", {
        submissionId,
        emailEvent,
        recipientKind,
        errorCode,
      });
      return json({ success: false, skipped: errorCode, event: emailEvent }, 200);
    }

    let content: SubmissionEmailContent;
    let replyTo: string | undefined;

    if (emailEvent === "received") {
      content = submissionReceivedEmail({
        platformName: settings.platform_name,
        supportEmail: settings.support_email,
        facts,
      });
      replyTo = settings.support_email;
    } else if (emailEvent === "awaiting_review") {
      content = submissionAwaitingReviewEmail({
        platformName: settings.platform_name,
        facts,
        submitterName,
        submitterEmail,
        submissionId: submission.id,
        reviewUrl: origin ? `${origin}/admin/submissions/${submission.id}` : null,
      });
      // Replying to the moderator notification reaches the submitter, which is
      // the useful default for a review queue.
      if (submitterEmail) replyTo = submitterEmail;
    } else if (emailEvent === "approved") {
      content = submissionApprovedEmail({
        platformName: settings.platform_name,
        supportEmail: settings.support_email,
        facts,
        eventUrl:
          origin && submission.approved_event_id
            ? `${origin}/events/${submission.approved_event_id}`
            : null,
      });
      replyTo = settings.support_email;
    } else {
      content = submissionRejectedEmail({
        platformName: settings.platform_name,
        supportEmail: settings.support_email,
        facts,
        // The public-facing message only, trimmed and capped.
        // `internal_note` is not selected by readSubmission and is not a
        // parameter of submissionRejectedEmail, so it cannot leak here.
        rejectionMessage: boundedString(submission.rejection_message, MAX_REJECTION_MESSAGE),
      });
      replyTo = settings.support_email;
    }

    let sendResult: ResendResult | null = null;
    let thrown: unknown = null;
    try {
      sendResult = await dependencies.resend.emails.send(
        {
          from: dependencies.from,
          to: recipient,
          subject: content.subject,
          html: content.html,
          text: content.text,
          ...(replyTo ? { replyTo } : {}),
        },
        // Deterministic per (submission, event): covers the one case the DB
        // claim cannot — a crash after Resend accepted the message but before
        // the claim was closed. On a later retry Resend returns the original
        // message instead of sending a second copy.
        { idempotencyKey: `submission-${submissionId}-${emailEvent}` }
      );
    } catch (err) {
      thrown = err;
    }

    const providerMessageId = sendResult?.data?.id ?? null;
    const succeeded = !thrown && sendResult && !sendResult.error && providerMessageId;

    if (succeeded) {
      const completion = await dependencies.completeAttempt({
        attemptId,
        status: "sent",
        providerMessageId,
        errorCode: null,
      });
      if (completion.error) {
        // The email genuinely sent. A bookkeeping failure is a diagnostics
        // gap, never a reason to report the send as failed.
        dependencies.log("send-submission-email: completion write failed after successful send", {
          submissionId,
          emailEvent,
          code: completion.error.code,
        });
      }
      return json({ success: true, event: emailEvent, id: providerMessageId });
    }

    // Send failed. Close the claim as failed — which also drops the row out
    // of the unique index, so a deliberate retry may claim again. NOTHING is
    // rolled back: the submission, approval, or rejection already committed
    // and stands.
    const errorCode = classifyResendFailure(sendResult, thrown);
    const completion = await dependencies.completeAttempt({
      attemptId,
      status: "failed",
      providerMessageId: null,
      errorCode,
    });
    if (completion.error) {
      dependencies.log("send-submission-email: failed-completion write also failed", {
        submissionId,
        emailEvent,
        code: completion.error.code,
      });
    }

    dependencies.log("send-submission-email: send failed", {
      submissionId,
      emailEvent,
      errorCode,
    });

    return json({ success: false, error: "The notification email could not be sent.", errorCode }, 502);
  };
}

// --- Runtime wiring ---------------------------------------------------

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function runtimeDependencies(): SendSubmissionEmailDependencies {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = requiredEnvironment("RESEND_API_KEY");

  const service = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return {
    readSubmission: async (id) => {
      const result = await service
        .from("event_submissions")
        .select(
          // internal_note is deliberately NOT selected. It never enters this
          // function's memory, so it cannot reach a submitter-facing template.
          "id,status,submitter_email,submitter_name,submitted_data,edited_data,rejection_message,approved_event_id,submitted_at"
        )
        .eq("id", id)
        .maybeSingle();
      return result as unknown as QueryResult<SubmissionRow>;
    },

    readSettings: async () => {
      const result = await service
        .from("platform_settings")
        .select("platform_name,public_site_url,support_email")
        .eq("singleton", true)
        .maybeSingle();
      return result as unknown as QueryResult<SettingsRow>;
    },

    claimAttempt: async (submissionId, emailEvent, recipientKind) => {
      const result = await service.rpc("claim_submission_email_attempt", {
        p_submission_id: submissionId,
        p_email_event: emailEvent,
        p_recipient_kind: recipientKind,
      });
      if (result.error) {
        return { attemptId: null, error: result.error as unknown as PostgrestError };
      }
      // The RPC returns the claimed attempt id, or NULL when the email
      // already sent / another caller holds the claim.
      const attemptId = typeof result.data === "string" && result.data.length > 0
        ? result.data
        : null;
      return { attemptId, error: null };
    },

    completeAttempt: async (attempt) => {
      const result = await service.rpc("complete_submission_email_attempt", {
        p_attempt_id: attempt.attemptId,
        p_status: attempt.status,
        p_provider_message_id: attempt.providerMessageId,
        p_error_code: attempt.errorCode,
      });
      return { error: (result.error as unknown as PostgrestError | null) ?? null };
    },

    authenticateCaller: async (authorization) => {
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return (await client.auth.getUser()) as unknown as AuthResult;
    },

    resend: new Resend(resendKey),
    from: Deno.env.get("AUTH_EMAIL_FROM") ?? "SalsaSegura <onboarding@resend.dev>",
    now: () => Date.now(),
    log: (message, details) => console.error(message, details),
  };
}

if (import.meta.main) {
  serve(async (request) => {
    try {
      return await createSendSubmissionEmailHandler(runtimeDependencies())(request);
    } catch (err) {
      console.error("send-submission-email: configuration error", err);
      return errorResponse("Email service is unavailable", 500);
    }
  });
}
