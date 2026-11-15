import { createArtistRsvpSubmit, type ArtistRsvpSubmitDependencies, type GuestSubmitResult } from "../_shared/artistRsvpSubmit.ts";

export function runtimeDependencies(): ArtistRsvpSubmitDependencies {
  const base = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const secret = Deno.env.get("RSVP_RATE_LIMIT_SECRET");
  const origins = (Deno.env.get("RSVP_ALLOWED_ORIGINS") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!base || !serviceKey || !secret || !origins.length || origins.some((origin) => { try { const url = new URL(origin); return !["http:", "https:"].includes(url.protocol) || url.origin !== origin; } catch { return true; } })) throw Error("RSVP configuration unavailable");
  return {
    secret, origins,
    submit: async (input, ipKey, emailKey) => {
      const response = await fetch(`${base}/rest/v1/rpc/artist_rsvp_submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({ p_event_id: input.event_id, p_name: input.name, p_email: input.email, p_role: input.role, p_ip_key: ipKey, p_email_key: emailKey }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) { await response.body?.cancel(); throw Error("RSVP operation unavailable"); }
      return await response.json() as GuestSubmitResult;
    },
  };
}
if (import.meta.main) Deno.serve(async (request) => {
  try { return await createArtistRsvpSubmit(runtimeDependencies())(request); }
  catch { return Response.json({ error: "RSVP service unavailable" }, { status: 503, headers: { "Cache-Control": "no-store" } }); }
});
