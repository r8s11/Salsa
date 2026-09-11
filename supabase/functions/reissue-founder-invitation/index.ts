import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@6.26.0";
import {
  createFounderInvitationDeliveryHandler,
  type FounderInvitationDeliveryDependencies,
} from "../send-founder-invitation/index.ts";

/**
 * POST /functions/v1/reissue-founder-invitation
 *
 * Admin-only delivery endpoint for the explicit Phase 9 Reissue action.
 * The server-side RPC revokes every still-pending invitation for the approved
 * request, mints a new credential, and returns its plaintext token only into
 * this closure. This endpoint then sends, audits, and compensates exactly like
 * the initial-send endpoint; the browser never receives the token.
 */
export type ReissueFounderInvitationDependencies = FounderInvitationDeliveryDependencies;

export function createReissueFounderInvitationHandler(
  dependencies: ReissueFounderInvitationDependencies
) {
  return createFounderInvitationDeliveryHandler(dependencies, {
    verb: "reissue",
    logPrefix: "reissue-founder-invitation",
  });
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function runtimeDependencies(): ReissueFounderInvitationDependencies {
  const supabaseUrl = requiredEnvironment("SUPABASE_URL");
  const anonKey = requiredEnvironment("SUPABASE_ANON_KEY");
  const resendKey = requiredEnvironment("RESEND_API_KEY");
  const from = requiredEnvironment("AUTH_EMAIL_FROM");
  const externalUrl = new URL(requiredEnvironment("AUTH_EXTERNAL_URL"));
  const acceptUrlBase = new URL("/founders/accept", externalUrl).toString();

  return {
    createCallerClient: (authorization) => {
      const client = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false },
      });
      return {
        auth: { getUser: () => client.auth.getUser() },
        rpc: (fn: string, args: Record<string, unknown>) =>
          client.rpc(fn, args) as unknown as Promise<{ data: unknown; error: { code?: string; message?: string } | null }>,
      };
    },
    resend: new Resend(resendKey),
    from,
    acceptUrlBase,
    log: (message, details) => console.error(message, details),
  };
}

if (import.meta.main) {
  serve(async (request) => {
    try {
      return await createReissueFounderInvitationHandler(runtimeDependencies())(request);
    } catch (error) {
      console.error("reissue-founder-invitation: configuration error", error);
      return new Response(JSON.stringify({ error: "Invitation service is unavailable" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
