import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  validateAndNormalize,
  isHoneypotTripped,
} from "../_shared/founderRequest.ts";

/**
 * POST /functions/v1/request-founder-access
 *
 * Public, unauthenticated Founder/Host access request intake — the ONLY
 * write path for public submissions into founder_access_requests.
 *
 * Pipeline: body-size guard → JSON parse → honeypot → authoritative
 * validation/normalization (shared module) → duplicate check → insert
 * with status forced to 'pending'.
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
 */
export interface FounderAccessResponse {
  success: boolean;
}

const MAX_BODY_BYTES = 10_000;

// Every successful path returns this exact body. A response that varied
// with applicant state would let anyone probe arbitrary emails to learn
// who has applied (spec §11/§13 — enumeration-safe).
const SUCCESS_RESPONSE: FounderAccessResponse = { success: true };

// --- Dependency seam (mirrors invite-organizer's ServiceClient pattern) ---

type MaybeSingleResult = Promise<{ data: { id: string } | null; error: { message?: string } | null }>;
type InsertResult = Promise<{ error: { code?: string; message?: string } | null }>;

export type FounderAccessTable = {
  select: (columns: string) => {
    eq: (column: string, value: string) => {
      eq: (column: string, value: string) => {
        maybeSingle: () => MaybeSingleResult;
      };
    };
  };
  insert: (values: Record<string, unknown>) => InsertResult;
};

export type FounderAccessDependencies = {
  service: { from: (table: "founder_access_requests") => FounderAccessTable };
  log: (message: string) => void;
};

// --- Handler --------------------------------------------------------------

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
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

export function createRequestFounderAccessHandler(dependencies: FounderAccessDependencies) {
  return async (req: Request): Promise<Response> => {
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
    // success body and insert nothing.
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
    // that a specific person has applied).
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
    const { error: insertError } = await dependencies.service
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
      });

    if (insertError) {
      if (isDuplicateInsertError(insertError)) {
        // Lost a concurrent-submission race to the partial unique index —
        // the same enumeration-safe success as an ordinary duplicate.
        return json(SUCCESS_RESPONSE);
      }
      dependencies.log(`founder-access insert failed: ${insertError.message ?? "unknown"}`);
      return errorResponse("Unable to submit request right now. Please try again.", 500);
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

function runtimeDependencies(): FounderAccessDependencies {
  const client = createClient(
    requiredEnvironment("SUPABASE_URL"),
    requiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } }
  );
  return {
    // Structural seam over the supabase-js client: the handler touches only
    // select/eq/maybeSingle and insert on this one table.
    service: client as unknown as FounderAccessDependencies["service"],
    log: (message: string) => console.log(message),
  };
}

if (import.meta.main) {
  serve((req) => createRequestFounderAccessHandler(runtimeDependencies())(req));
}