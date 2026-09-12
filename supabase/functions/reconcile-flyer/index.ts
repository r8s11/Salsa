/* eslint-disable */
// @ts-nocheck - Deno Edge Function; Vite build excludes supabase directory

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { matchVenue } from "./matching.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ALLOWED_TOP_KEYS = new Set(["venue"]);
const VENUE_KEYS = new Set(["name", "address", "city"]);

interface VenueRequest {
  venue: {
    name: string | null;
    address: string | null;
    city: string | null;
  };
}

interface VenueResponse {
  venue: {
    status: "exact" | "strong" | "ambiguous" | "none";
    match: { id: string; name: string; address: string | null; city: string | null } | null;
  };
}

export interface ReconcileFlyerDependencies {
  getUser: (request: Request) => Promise<{ userId: string | null }>;
  findVenueCandidates: (name: string) => Promise<CandidateVenue[]>;
}

interface CandidateVenue {
  id: string;
  name: string;
  address_line1: string | null;
  city: string | null;
  normalized_name: string | null;
  normalized_address: string | null;
}

interface ConfigError extends Error {
  readonly code: "CONFIG_ERROR";
}

function isConfigError(err: unknown): err is ConfigError {
  return err instanceof Error && (err as ConfigError).code === "CONFIG_ERROR";
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(message: string, status: number): Response {
  return json({ error: message }, status);
}

function validateRequest(body: unknown): VenueRequest | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const obj = body as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_KEYS.has(key)) return null;
  }
  const venue = obj.venue;
  if (!venue || typeof venue !== "object" || Array.isArray(venue)) return null;
  const v = venue as Record<string, unknown>;
  for (const key of Object.keys(v)) {
    if (!VENUE_KEYS.has(key)) return null;
  }
  const name = v.name;
  const address = v.address;
  const city = v.city;
  if (name !== undefined && name !== null && typeof name !== "string") return null;
  if (address !== undefined && address !== null && typeof address !== "string") return null;
  if (city !== undefined && city !== null && typeof city !== "string") return null;
  return {
    venue: {
      name: typeof name === "string" ? name : null,
      address: typeof address === "string" ? address : null,
      city: typeof city === "string" ? city : null,
    },
  };
}

export function createReconcileFlyerHandler(dependencies: ReconcileFlyerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }
    if (request.method !== "POST") {
      return error("Method not allowed", 405);
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader) {
      return error("Unauthorized", 401);
    }

    const user = await dependencies.getUser(request);
    if (!user.userId) {
      return error("Unauthorized", 401);
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return error("Malformed request body", 400);
    }

    const validated = validateRequest(body);
    if (!validated) {
      return error("Invalid request payload", 400);
    }

    const { venue } = validated;
    const name = venue.name?.trim() ?? "";
    if (!name) {
      return json<VenueResponse>({
        venue: { status: "none", match: null },
      });
    }

    let candidates;
    try {
      candidates = await dependencies.findVenueCandidates(name);
    } catch (err) {
      if (isConfigError(err)) {
        return error("Server configuration error", 500);
      }
      return error("Venue lookup failed", 500);
    }

    const result = matchVenue(venue.name, venue.address, venue.city, candidates);

    return json<VenueResponse>({ venue: result });
  };
}

function createConfigError(message: string): ConfigError {
  const err = new Error(message) as ConfigError;
  err.code = "CONFIG_ERROR";
  return err;
}

function runtimeDependencies(): ReconcileFlyerDependencies {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabasePublishableKey =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const getUser = async (request: Request): Promise<{ userId: string | null }> => {
    if (!supabaseUrl || !supabasePublishableKey) {
      throw createConfigError("Missing Supabase caller configuration");
    }
    const callerClient = createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: false },
    });
    const { data, error } = await callerClient.auth.getUser(
      request.headers.get("Authorization") ?? undefined
    );
    if (error || !data.user) return { userId: null };
    return { userId: data.user.id };
  };

  const findVenueCandidates = async (name: string): Promise<CandidateVenue[]> => {
    if (!supabaseUrl || !serviceRoleKey) {
      throw createConfigError("SUPABASE_SERVICE_ROLE_KEY is not configured");
    }
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data, error } = await adminClient
      .from("venues")
      .select("id, name, address_line1, city, normalized_name, normalized_address, status")
      .eq("status", "active")
      .eq("normalized_name", name.trim().toLowerCase());

    if (error) throw error;
    return (data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      address_line1: row.address_line1,
      city: row.city,
      normalized_name: row.normalized_name,
      normalized_address: row.normalized_address,
    }));
  };

  return { getUser, findVenueCandidates };
}

if (import.meta.main) {
  serve((request) => createReconcileFlyerHandler(runtimeDependencies())(request));
}
