import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@6.26.0";
import { Webhook } from "https://esm.sh/standardwebhooks@1.0.0";
import { organizerInvitationEmailContent } from "../_shared/organizerInvitationEmail.ts";

export interface SendAuthEmailDependencies {
  webhook: { verify(rawPayload: string, headers: Record<string, string>): unknown };
  resend: { emails: { send(message: AuthEmail): Promise<{ data: unknown; error: unknown }> } };
  authExternalUrl: string;
  from: string;
}

type AuthEmail = { from: string; to: string; subject: string; html: string };
type EmailActionType = "invite" | "signup" | "magiclink" | "recovery" | "email_change";
type AuthHookPayload = {
  user: { email: string; new_email: string | null };
  email_data: {
    token_hash: string;
    token_hash_new: string | null;
    redirect_to: string;
    email_action_type: EmailActionType;
  };
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
  const newEmail = "new_email" in user ? stringField(user.new_email) : null;
  const tokenHash = "token_hash" in emailData ? stringField(emailData.token_hash) : null;
  const tokenHashNew = "token_hash_new" in emailData ? stringField(emailData.token_hash_new) : null;
  const redirectTo = "redirect_to" in emailData ? stringField(emailData.redirect_to) : null;
  const action = "email_action_type" in emailData ? stringField(emailData.email_action_type) : null;
  if (!email || !tokenHash || !redirectTo || !isActionType(action)) return null;
  return {
    user: { email, new_email: newEmail },
    email_data: { token_hash: tokenHash, token_hash_new: tokenHashNew, redirect_to: redirectTo, email_action_type: action },
  };
}

function isActionType(value: string | null): value is EmailActionType {
  return value === "invite" || value === "signup" || value === "magiclink" || value === "recovery" || value === "email_change";
}

function escapeHtml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function verifyLink(authExternalUrl: string, tokenHash: string, actionType: EmailActionType, redirectTo: string): string {
  const base = authExternalUrl.replace(/\/$/, "");
  return `${base}/auth/v1/verify?token=${encodeURIComponent(tokenHash)}&type=${encodeURIComponent(actionType)}&redirect_to=${encodeURIComponent(redirectTo)}`;
}

function template(action: Exclude<EmailActionType, "email_change">, url: string): Pick<AuthEmail, "subject" | "html"> {
  const safeUrl = escapeHtml(url);
  switch (action) {
    case "invite": {
      // One shared builder with resend-organizer-invitation: both triggers
      // must produce the same email, differing only in the credential URL.
      const { subject, html } = organizerInvitationEmailContent({ acceptUrl: url });
      return { subject, html };
    }
    case "signup":
      return { subject: "Confirm your SalsaSegura email", html: `<p><a href="${safeUrl}">Confirm your email</a></p>` };
    case "magiclink":
      return { subject: "Sign in to SalsaSegura", html: `<p><a href="${safeUrl}">Sign in to SalsaSegura</a></p>` };
    case "recovery":
      return { subject: "Reset your SalsaSegura password", html: `<p><a href="${safeUrl}">Reset your password</a></p>` };
  }
}

// Secure Email Change (enabled on this project) sends one OTP per address
// and the hook payload's token hash field names are swapped for backward
// compatibility: `token_hash_new` verifies the CURRENT address and
// `token_hash` verifies the NEW address. See Supabase's Send Email Hook
// docs, "Email change behavior and token hash mapping".
function emailChangeCurrentAddressTemplate(url: string, newEmail: string | null): Pick<AuthEmail, "subject" | "html"> {
  const safeUrl = escapeHtml(url);
  const context = newEmail
    ? `<p>The requested new address is ${escapeHtml(newEmail)}.</p>`
    : "";
  return {
    subject: "Confirm your SalsaSegura email change",
    html: `<p>We received a request to change the email address on your SalsaSegura account.</p>${context}<p>If this was you, confirm the change:</p><p><a href="${safeUrl}">Confirm email change</a></p><p>If you didn't request this, you can ignore this email — your account is unaffected.</p>`,
  };
}

function emailChangeNewAddressTemplate(url: string): Pick<AuthEmail, "subject" | "html"> {
  const safeUrl = escapeHtml(url);
  return {
    subject: "Confirm your new SalsaSegura email",
    html: `<p>Confirm this email address for your SalsaSegura account:</p><p><a href="${safeUrl}">Confirm new email</a></p>`,
  };
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

    const messages: AuthEmail[] = [];
    if (payload.email_data.email_action_type === "email_change") {
      if (payload.email_data.token_hash_new) {
        const url = verifyLink(deps.authExternalUrl, payload.email_data.token_hash_new, "email_change", payload.email_data.redirect_to);
        messages.push({ from: deps.from, to: payload.user.email, ...emailChangeCurrentAddressTemplate(url, payload.user.new_email) });
      }
      if (payload.user.new_email) {
        const url = verifyLink(deps.authExternalUrl, payload.email_data.token_hash, "email_change", payload.email_data.redirect_to);
        messages.push({ from: deps.from, to: payload.user.new_email, ...emailChangeNewAddressTemplate(url) });
      }
      if (messages.length === 0) return unauthorized();
    } else {
      const url = verifyLink(deps.authExternalUrl, payload.email_data.token_hash, payload.email_data.email_action_type, payload.email_data.redirect_to);
      messages.push({ from: deps.from, to: payload.user.email, ...template(payload.email_data.email_action_type, url) });
    }

    try {
      for (const message of messages) {
        const result = await deps.resend.emails.send(message);
        if (result.error || result.data == null) return unauthorized();
      }
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
    from: requiredEnvironment("AUTH_EMAIL_FROM"),
  });
}

if (import.meta.main) {
  serve(async (req) => {
    if (req.method !== "POST") return Response.json({ error: "Method not allowed" }, { status: 405 });
    try {
      return await configuredHandler()(req);
    } catch {
      return unauthorized();
    }
  });
}
