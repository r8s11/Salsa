import { timeZoneForDisplay } from "../../../src/shared/utils/timezone.ts";
import { memberDigestEmail } from "./memberDigestEmail.ts";
import {
  classifyResendFailure,
  type EmailContent,
  type ResendResult,
} from "./emailLayout.ts";
import { matchesSecret } from "./schedulerSecret.ts";

export type DigestMessage = EmailContent & {
  to: string;
  from: string;
  headers: Record<string, string>;
};
export interface DigestClaim {
  token: string;
  email: string;
  city: string;
  metro_name: string;
  unsubscribe_token: string;
  from: string;
  to: string;
  message: DigestMessage | null;
  idempotency_key: string;
}
export interface DigestSourceEvent {
  title: string;
  startsAt: string;
  venueTimeZone: string | null;
  city: string;
  venueName: string | null;
  path: string;
}
export interface DigestWorkerDependencies {
  secret: string;
  siteUrl: string;
  unsubscribeBase: string;
  from: string;
  now: () => Date;
  due: (now: string, after: string | null) => Promise<string[]>;
  claim: (id: string, week: string) => Promise<DigestClaim | null>;
  events: (
    city: string,
    from: string,
    to: string,
  ) => Promise<DigestSourceEvent[]>;
  prepare: (
    id: string,
    week: string,
    token: string,
    message: DigestMessage,
  ) => Promise<DigestMessage | null>;
  allowed: (id: string, week: string, token: string) => Promise<boolean>;
  send: (email: DigestMessage, key: string) => Promise<ResendResult>;
  finish: (
    id: string,
    week: string,
    token: string,
    status: "sent" | "failed" | "suppressed",
    error: string | null,
  ) => Promise<boolean>;
  log: (message: string, details: Record<string, unknown>) => void;
}

export function createMemberDigestWorker(deps: DigestWorkerDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Method not allowed" }, { status: 405 });
    }
    if (
      !await matchesSecret(
        request.headers.get("x-member-digest-scheduler-secret") ?? "",
        deps.secret,
      )
    ) return Response.json({ error: "Unauthorized" }, { status: 401 });
    // Body deliberately ignored: only the server chooses recipients and windows.
    const after = new URL(request.url).searchParams.get("after");
    if (
      after &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        after,
      )
    ) return Response.json({ error: "Invalid cursor" }, { status: 400 });
    const now = deps.now();
    const monday = new Date(now);
    monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
    const week = monday.toISOString().slice(0, 10);
    let failed = false,
      sent = 0,
      processed = 0,
      nextCursor: string | null = null;
    try {
      const site = new URL(deps.siteUrl),
        unsubscribe = new URL(deps.unsubscribeBase);
      if (
        site.protocol !== "https:" || site.username || site.password ||
        unsubscribe.protocol !== "https:" || unsubscribe.username ||
        unsubscribe.password || !deps.from.trim()
      ) throw Error("Invalid configuration");
      const candidates = await deps.due(now.toISOString(), after);
      const page = candidates.slice(0, 50);
      nextCursor = candidates.length > 50 ? page.at(-1) ?? null : null;
      for (const id of page) {
        let claim: DigestClaim | null = null;
        try {
          processed++;
          claim = await deps.claim(id, week);
          if (!claim) continue;
          let message = claim.message;
          if (!message) {
            const events = await deps.events(claim.city, claim.from, claim.to);
            if (events.length === 0) {
              if (
                !await deps.finish(id, week, claim.token, "suppressed", null)
              ) failed = true;
              continue;
            }
            unsubscribe.searchParams.set("t", claim.unsubscribe_token);
            const content = memberDigestEmail({
              siteUrl: site.origin,
              metroName: claim.metro_name,
              unsubscribeUrl: unsubscribe.href,
              events: events.map((event) => ({
                ...event,
                timeZone: timeZoneForDisplay({
                  venue: event.venueTimeZone,
                  metro: event.city,
                }),
              })),
            });
            message = await deps.prepare(id, week, claim.token, {
              ...content,
              to: claim.email,
              from: deps.from,
            });
          }
          // Last possible pre-send check: revoke for new opt-out, ban/deletion,
          // changed recipient, expired claim or expired provider dedup window.
          if (!message || !await deps.allowed(id, week, claim.token)) {
            if (!await deps.finish(id, week, claim.token, "suppressed", null)) {
              failed = true;
            }
            continue;
          }
          const result = await deps.send(message, claim.idempotency_key);
          if (result.error || !result.data?.id) {
            failed = true;
            await deps.finish(
              id,
              week,
              claim.token,
              "failed",
              classifyResendFailure(result, null),
            );
          } else if (await deps.finish(id, week, claim.token, "sent", null)) {
            sent++;
          } else failed = true;
        } catch (cause) {
          failed = true;
          deps.log("Member digest delivery unavailable", {
            category: "delivery_error",
          });
          if (claim) {
            try {
              await deps.finish(
                id,
                week,
                claim.token,
                "failed",
                classifyResendFailure(null, cause),
              );
            } catch {
              deps.log("Member digest completion unavailable", {
                category: "database_error",
              });
            }
          }
        }
      }
    } catch {
      failed = true;
      deps.log("Member digest scheduler unavailable", {
        category: "scheduler_error",
      });
    }
    return Response.json({
      status: failed ? "error" : "success",
      sent,
      processed,
      next_cursor: nextCursor,
    }, { status: failed ? 503 : 200 });
  };
}
