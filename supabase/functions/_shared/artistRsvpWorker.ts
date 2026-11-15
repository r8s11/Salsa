import { artistRsvpEmail, type ArtistRsvpFacts, type ArtistRsvpNotificationKind } from "./artistRsvpEmail.ts";
import { classifyResendFailure, type EmailContent, type ResendResult } from "./emailLayout.ts";
import { matchesSecret } from "./schedulerSecret.ts";

export interface ArtistRsvpClaim {
  id: string; token: string; kind: ArtistRsvpNotificationKind; event_id: string;
  rsvp_id: string | null; recipient_email: string; recipient_user_id: string | null;
  artist_id: string; facts: ArtistRsvpFacts; idempotency_key: string;
}
export type ArtistRsvpMail = EmailContent & { to: string; from: string };
export type ArtistRsvpFailure = "transient" | "ambiguous" | "permanent" | "configuration" | "exhausted" | "superseded";
export interface ArtistRsvpWorkerDependencies {
  secret: string; siteUrl: string; from: string;
  due: (limit: number) => Promise<string[]>;
  claim: (id: string) => Promise<ArtistRsvpClaim | null>;
  allowed: (id: string) => Promise<boolean>;
  finish: (id: string, token: string, status: "sent" | "failed" | "suppressed", providerId: string | null, failure: ArtistRsvpFailure | null) => Promise<boolean>;
  send: (email: ArtistRsvpMail, key: string) => Promise<ResendResult & { httpStatus?: number }>;
  now: () => number; sleep: (milliseconds: number) => Promise<void>;
  log: (id: string, category: string) => void;
}
export function createArtistRsvpWorker(deps: ArtistRsvpWorkerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return Response.json({ error: "Use POST" }, { status: 405, headers: { Allow: "POST" } });
    if (!deps.secret || deps.secret.length < 32) return Response.json({ error: "RSVP worker unavailable" }, { status: 503 });
    if (!await matchesSecret(request.headers.get("x-rsvp-scheduler-secret") ?? "", deps.secret)) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!deps.siteUrl || !deps.from) return Response.json({ error: "RSVP worker unavailable" }, { status: 503 });
    // Request bodies never select recipients, events, facts or templates.
    const totals = { sent: 0, failed: 0, suppressed: 0 };
    let nextSendAt = 0;
    let ids: string[];
    try { ids = (await deps.due(20)).slice(0, 20); }
    catch { return Response.json({ error: "RSVP worker unavailable" }, { status: 503 }); }
    for (const id of ids) {
      let claim: ArtistRsvpClaim | null = null;
      try {
        claim = await deps.claim(id);
        if (!claim) continue;
        let email: ArtistRsvpMail;
        try { email = { ...artistRsvpEmail(claim.kind, claim.facts, claim.event_id, claim.artist_id, deps.siteUrl), to: claim.recipient_email, from: deps.from }; }
        catch { await deps.finish(id, claim.token, "failed", null, "configuration"); totals.failed++; deps.log(id, "configuration"); continue; }
        const delay = nextSendAt - deps.now();
        if (delay > 0) await deps.sleep(delay);
        if (!await deps.allowed(id)) { await deps.finish(id, claim.token, "suppressed", null, "superseded"); totals.suppressed++; continue; }
        nextSendAt = deps.now() + 1000;
        let result: (ResendResult & { httpStatus?: number }) | null = null;
        let thrown: unknown;
        try { result = await deps.send(email, claim.idempotency_key); }
        catch (error) { thrown = error; }
        if (result?.data?.id && !result.error) {
          const finished = await deps.finish(id, claim.token, "sent", result.data.id, null);
          if (finished) totals.sent++; else deps.log(id, "ambiguous");
        } else {
          const category = classifyResendFailure(result, thrown);
          const failure: ArtistRsvpFailure = thrown ? "ambiguous" : category === "rate_limited" || (result?.httpStatus ?? 0) >= 500 ? "transient" : category === "invalid_sender" ? "configuration" : category === "invalid_recipient" || ((result?.httpStatus ?? 0) >= 400 && (result?.httpStatus ?? 0) < 500) ? "permanent" : "ambiguous";
          await deps.finish(id, claim.token, "failed", null, failure);
          totals.failed++; deps.log(id, failure);
        }
      } catch { deps.log(claim?.id ?? id, "ambiguous"); }
    }
    return Response.json(totals, { headers: { "Cache-Control": "no-store" } });
  };
}
