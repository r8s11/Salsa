import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@4.0.1";
import { Webhook } from "npm:standardwebhooks@1.0.0";

export interface SendAuthEmailDependencies {
  webhook: { verify(rawPayload: string, headers: Record<string, string>): unknown };
  resend: { emails: { send(message: AuthEmail): Promise<{ data: unknown; error: unknown }> } };
  authExternalUrl: string;
  from: string;
}

type AuthEmail = { from: string; to: string; subject: string; html: string };
type EmailActionType = "invite" | "signup" | "magiclink" | "recovery";
type AuthHookPayload = {
  user: { email: string };
  email_data: { token_hash: string; redirect_to: string; email_action_type: EmailActionType };
};

const unauthorized = () => Response.json({ error: { http_code: 401, message: "Unauthorized" } }, { status: 401 });

function stringField(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parsePayload(value: unknown): AuthHookPayload | null {
  let payload = value;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!payload || typeof payload !== "object" || !("user" in payload) || !("email_data" in payload)) return null;
  const user = payload.user;
  const emailData = payload.email_data;
  if (!user || typeof user !== "object" || !emailData || typeof emailData !== "object") return null;
  const email = "email" in user ? stringField(user.email) : null;
  const tokenHash = "token_hash" in emailData ? stringField(emailData.token_hash) : null;
  const redirectTo = "redirect_to" in emailData ? stringField(emailData.redirect_to) : null;
  const action = "email_action_type" in emailData ? stringField(emailData.email_action_type) : null;
  if (!email || !tokenHash || !redirectTo || !isActionType(action)) return null;
  return { user: { email }, email_data: { token_hash: tokenHash, redirect_to: redirectTo, email_action_type: action } };
}

function isActionType(value: string | null): value is EmailActionType {
  return value === "invite" || value === "signup" || value === "magiclink" || value === "recovery";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function verificationUrl(authExternalUrl: string, emailData: AuthHookPayload["email_data"]): string {
  const base = authExternalUrl.replace(/\/$/, "");
  return `${base}/auth/v1/verify?token=${encodeURIComponent(emailData.token_hash)}&type=${encodeURIComponent(emailData.email_action_type)}&redirect_to=${encodeURIComponent(emailData.redirect_to)}`;
}

function template(action: EmailActionType, url: string): Pick<AuthEmail, "subject" | "html"> {
  const safeUrl = escapeHtml(url);
  switch (action) {
    case "invite":
      return {
        subject: "You have an invitation to SalsaSegura",
        html: `<p>You have been invited to SalsaSegura.</p><p><a href="${safeUrl}">Accept invitation</a></p><p>This invitation is single-use and expires. After accepting it, you will set a password.</p>`,
      };
    case "signup":
      return { subject: "Confirm your SalsaSegura email", html: `<p><a href="${safeUrl}">Confirm your email</a></p>` };
    case "magiclink":
      return { subject: "Sign in to SalsaSegura", html: `<p><a href="${safeUrl}">Sign in to SalsaSegura</a></p>` };
    case "recovery":
      return { subject: "Reset your SalsaSegura password", html: `<p><a href="${safeUrl}">Reset your password</a></p>` };
  }
}

export function createSendAuthEmailHandler(deps: SendAuthEmailDependencies) {
  return async (req: Request): Promise<Response> => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });

    const rawPayload = await req.text();
    let verified: unknown;
    try {
      verified = deps.webhook.verify(rawPayload, Object.fromEntries(req.headers));
    } catch {
      return unauthorized();
    }

    const payload = parsePayload(verified);
    if (!payload) return unauthorized();

    const url = verificationUrl(deps.authExternalUrl, payload.email_data);
    const content = template(payload.email_data.email_action_type, url);
    try {
      const result = await deps.resend.emails.send({ from: deps.from, to: payload.user.email, ...content });
      if (result.error) return unauthorized();
    } catch {
      return unauthorized();
    }
    return Response.json({});
  };
}

function requiredEnvironment(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function configuredHandler() {
  const secret = requiredEnvironment("SEND_EMAIL_HOOK_SECRET").replace(/^v1,whsec_/, "");
  const resendKey = requiredEnvironment("RESEND_API_KEY");
  return createSendAuthEmailHandler({
    webhook: new Webhook(secret),
    resend: new Resend(resendKey),
    authExternalUrl: requiredEnvironment("SUPABASE_URL"),
    from: Deno.env.get("AUTH_EMAIL_FROM") ?? "SalsaSegura <onboarding@resend.dev>",
  });
}

serve(async (req) => {
  if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
  try {
    return await configuredHandler()(req);
  } catch {
    return unauthorized();
  }
});
