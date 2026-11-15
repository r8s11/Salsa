import { createArtistRsvpWorker, type ArtistRsvpClaim, type ArtistRsvpWorkerDependencies } from "../_shared/artistRsvpWorker.ts";
function required(name: string): string { const value = Deno.env.get(name); if (!value) throw Error("RSVP configuration unavailable"); return value; }
export function runtimeDependencies(): ArtistRsvpWorkerDependencies {
  const base = required("SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const resendKey = required("RESEND_API_KEY");
  const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
    const response = await fetch(`${base}/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, body: JSON.stringify(args), signal: AbortSignal.timeout(20000) });
    if (!response.ok) { await response.body?.cancel(); throw Error("RSVP database operation unavailable"); }
    return await response.json() as T;
  };
  return {
    secret: required("RSVP_SCHEDULER_SECRET"), siteUrl: required("AUTH_EXTERNAL_URL"), from: required("AUTH_EMAIL_FROM"),
    due: (limit) => rpc<string[]>("artist_rsvp_notifications_due", { p_limit: limit }),
    claim: (id) => rpc<ArtistRsvpClaim | null>("artist_rsvp_notification_claim", { p_id: id }),
    allowed: (id) => rpc<boolean>("artist_rsvp_notification_allowed", { p_id: id }),
    finish: (id, token, status, providerId, failure) => rpc<boolean>("artist_rsvp_notification_finish", { p_id: id, p_token: token, p_status: status, p_provider_id: providerId, p_failure: failure }),
    send: async (email, key) => {
      const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(email), signal: AbortSignal.timeout(20000) });
      if (!response.ok) { await response.body?.cancel(); return { data: null, error: { name: response.status === 429 ? "rate_limited" : response.status === 422 ? "validation_error" : "provider_error" }, httpStatus: response.status }; }
      const data = await response.json();
      return { data: typeof data.id === "string" ? { id: data.id } : null, error: null, httpStatus: response.status };
    },
    now: () => performance.now(), sleep: (ms) => { const { promise, resolve } = Promise.withResolvers<void>(); setTimeout(resolve, ms); return promise; },
    log: (id, category) => console.error("artist_rsvp_delivery", { id, category }),
  };
}
if (import.meta.main) Deno.serve(async (request) => {
  try { return await createArtistRsvpWorker(runtimeDependencies())(request); }
  catch { return Response.json({ error: "RSVP worker unavailable" }, { status: 503 }); }
});
