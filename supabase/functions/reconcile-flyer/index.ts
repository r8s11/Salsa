// Edge Function: Phase 4 entity reconciliation for a flyer extraction.
//
// The AI extracts free text (see extract-flyer). This function decides whether
// that text corresponds to EXISTING canonical SalsaSegura data — venues,
// organizers, and taxonomy — using deterministic, candidate-set matching.
//
// Why server-side?
//  - The `venues` and `organizers` tables are admin-only under RLS
//    ("Admins manage venues/organizers"). The browser cannot read them, so it
//    cannot safely perform matching without weakening RLS. This function uses
//    the service role (server secret) to read the candidate set and returns
//    ONLY the reconciliation result — never raw privileged rows to an
//    unprivileged caller beyond what matching needs.
//  - Application/DB owns identity; the AI only extracts. Matching stays here.
//
// It never creates entities, never fabricates ids, and never writes anything.
// On any failure it returns a benign "no matches" result so the manual
// submission flow is never blocked.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { reconcileExtraction } from "./matching.ts";
import type {
  ExtractedEvent,
} from "./extractionTypes.ts";
import {
  validateExtractedEvent,
} from "./extractionTypes.ts";

interface ReconcileRequest {
  extraction: unknown;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// Require a valid caller JWT so anonymous callers cannot spend the read budget.
async function readCallerUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !anonKey) return null;
  const caller = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await caller.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405);
  }

  const callerId = await readCallerUserId(req);
  if (!callerId) {
    return errorResponse("Authentication required", 401);
  }

  let body: ReconcileRequest;
  try {
    body = (await req.json()) as ReconcileRequest;
  } catch {
    return errorResponse("Invalid JSON body");
  }

  const extraction: ExtractedEvent = validateExtractedEvent(body.extraction);

  // Read canonical candidates with the service role (bypasses admin-only RLS).
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !supabaseUrl) {
    // Degrade gracefully: matching is an enhancement, never a hard dependency.
    return json({ venue: { status: "none" }, organizer: { status: "none" }, dance_styles: [], event_type: { raw: extraction.event_type, slug: null } });
  }

  const service = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  try {
    const [{ data: venues, error: venueErr }, { data: organizers, error: orgErr }, { data: terms, error: termErr }] =
      await Promise.all([
        service.from("venues").select("id,name,normalized_name,address_line1,city,status").eq("status", "active"),
        service.from("organizers").select("id,name,slug,instagram,website,status").eq("status", "active"),
        service
          .from("taxonomy_terms")
          .select("slug,category,status")
          .eq("status", "active")
          .in("category", ["dance_style", "event_attribute"]),
      ]);

    if (venueErr || orgErr || termErr) {
      return json({ venue: { status: "none" }, organizer: { status: "none" }, dance_styles: [], event_type: { raw: extraction.event_type, slug: null } });
    }

    const knownDanceStyleSlugs = (terms ?? [])
      .filter((t) => t.category === "dance_style")
      .map((t) => t.slug as string);
    const knownEventTypes = ["social", "class", "workshop"];

    const result = reconcileExtraction(extraction, {
      venueCandidates: (venues ?? []) as never,
      organizerCandidates: (organizers ?? []) as never,
      knownDanceStyleSlugs,
      knownEventTypes,
    });

    return json(result);
  } catch {
    // Never block submission on a matching failure.
    return json({ venue: { status: "none" }, organizer: { status: "none" }, dance_styles: [], event_type: { raw: extraction.event_type, slug: null } });
  }
});
