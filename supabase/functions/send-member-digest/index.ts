import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  createMemberDigestWorker,
  type DigestClaim,
  type DigestMessage,
  type DigestSourceEvent,
  type DigestWorkerDependencies,
} from "../_shared/memberDigestWorker.ts";
function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw Error("Digest configuration unavailable");
  return value;
}
export function runtimeDependencies(): DigestWorkerDependencies {
  const base = required("SUPABASE_URL");
  const service = createClient(base, required("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  async function rpc<T>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    const { data, error } = await service.rpc(name, args);
    if (error) throw Error("Digest database operation unavailable");
    return data as T;
  }
  const identity = (id: string, week: string, token: string) => ({
    p_profile_id: id,
    p_week_start: week,
    p_token: token,
  });
  return {
    secret: required("MEMBER_DIGEST_SCHEDULER_SECRET"),
    siteUrl: required("AUTH_EXTERNAL_URL"),
    from: required("AUTH_EMAIL_FROM"),
    unsubscribeBase: base + "/functions/v1/member-email-unsubscribe",
    now: () => new Date(),
    due: (now, after) =>
      rpc<string[]>("member_digest_due", { p_now: now, p_after: after }),
    claim: (id, week) =>
      rpc<DigestClaim | null>("member_digest_claim", {
        p_profile_id: id,
        p_week_start: week,
      }),
    events: (city, from, to) =>
      rpc<DigestSourceEvent[]>("member_digest_events", {
        p_city: city,
        p_from: from,
        p_to: to,
      }),
    prepare: (id, week, token, message) =>
      rpc<DigestMessage | null>("member_digest_prepare", {
        ...identity(id, week, token),
        p_message: message,
      }),
    allowed: (id, week, token) =>
      rpc<boolean>("member_digest_allowed", identity(id, week, token)),
    finish: (id, week, token, status, error) =>
      rpc<boolean>("member_digest_finish", {
        ...identity(id, week, token),
        p_status: status,
        p_error: error,
      }),
    send: async (email, key) => {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: "Bearer " + required("RESEND_API_KEY"),
          "Content-Type": "application/json",
          "Idempotency-Key": key,
        },
        body: JSON.stringify(email),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) {
        await response.body?.cancel();
        return {
          data: null,
          error: {
            name: response.status === 429 ? "rate_limited" : "provider_error",
          },
        };
      }
      const data = await response.json();
      return {
        data: typeof data.id === "string" ? { id: data.id } : null,
        error: null,
      };
    },
    log: (message, details) => console.error(message, details),
  };
}
if (import.meta.main) {
  Deno.serve(async (request) => {
    try {
      return await createMemberDigestWorker(runtimeDependencies())(request);
    } catch {
      return Response.json({ error: "Member digest unavailable" }, {
        status: 503,
      });
    }
  });
}
