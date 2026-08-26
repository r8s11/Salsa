import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSendAuthEmailHandler, type SendAuthEmailDependencies } from "./index.ts";

type EmailData = {
  token_hash?: string;
  token?: string;
  redirect_to?: string;
  email_action_type?: string;
};

type SentEmail = { from: string; to: string; subject: string; html: string };

function signedRequest(emailData: EmailData, email = "organizer@example.com") {
  return new Request("http://localhost/send-auth-email", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "webhook-id": "msg_123",
      "webhook-timestamp": "1710000000",
      "webhook-signature": "v1,test-signature",
    },
    body: JSON.stringify({ user: { email }, email_data: emailData }),
  });
}

function dependencies(overrides: Partial<SendAuthEmailDependencies> = {}) {
  const sent: SentEmail[] = [];
  const verified: string[] = [];
  const deps: SendAuthEmailDependencies = {
    webhook: { verify: (rawPayload: string) => { verified.push(rawPayload); return rawPayload; } },
    resend: { emails: { send: async (message) => { sent.push(message); return { data: { id: "email_123" }, error: null }; } } },
    authExternalUrl: "https://project.supabase.co",
    from: "SalsaSegura <invites@salsasegura.com>",
    ...overrides,
  };
  return { deps, sent, verified };
}

async function error(response: Response) {
  assertEquals(response.status, 401);
  assertEquals(await response.json(), { error: { http_code: 401, message: "Unauthorized" } });
}

Deno.test("rejects non-POST requests before verification", async () => {
  const { deps, verified } = dependencies();
  const response = await createSendAuthEmailHandler(deps)(new Request("http://localhost", { method: "GET" }));
  assertEquals(response.status, 405);
  assertEquals(verified, []);
});

Deno.test("rejects malformed JSON after a valid signature", async () => {
  const { deps } = dependencies({ webhook: { verify: () => "not-json" } });
  await error(await createSendAuthEmailHandler(deps)(new Request("http://localhost", { method: "POST", body: "not-json" })));
});

Deno.test("rejects an invalid signature before parsing or sending", async () => {
  const { deps, sent } = dependencies({ webhook: { verify: () => { throw new Error("invalid signature"); } } });
  await error(await createSendAuthEmailHandler(deps)(signedRequest({ token_hash: "hash", redirect_to: "https://app.example/auth/invite", email_action_type: "invite" })));
  assertEquals(sent, []);
});

Deno.test("rejects payloads missing the recipient email or verification fields", async () => {
  const cases = [
    { user: {}, email_data: { token_hash: "hash", redirect_to: "https://app.example/auth/invite", email_action_type: "invite" } },
    { user: { email: "person@example.com" }, email_data: { redirect_to: "https://app.example/auth/invite", email_action_type: "invite" } },
    { user: { email: "person@example.com" }, email_data: { token_hash: "hash", email_action_type: "invite" } },
    { user: { email: "person@example.com" }, email_data: { token_hash: "hash", redirect_to: "https://app.example/auth/invite" } },
  ];
  for (const payload of cases) {
    const { deps, sent } = dependencies();
    const response = await createSendAuthEmailHandler(deps)(new Request("http://localhost", { method: "POST", body: JSON.stringify(payload) }));
    await error(response);
    assertEquals(sent, []);
  }
});

Deno.test("sends invite mail using token_hash and the exact redirect URL", async () => {
  const rawToken = "raw-otp-must-never-appear";
  const redirectTo = "http://localhost:5173/auth/invite?source=email";
  const { deps, sent, verified } = dependencies();
  const response = await createSendAuthEmailHandler(deps)(signedRequest({ token_hash: "hash+/=", token: rawToken, redirect_to: redirectTo, email_action_type: "invite" }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), {});
  assertEquals(verified.length, 1);
  const message = sent[0];
  assertEquals(message.to, "organizer@example.com");
  assertStringIncludes(message.subject, "invitation");
  assertStringIncludes(message.html, "Accept invitation");
  assertStringIncludes(message.html, "single-use");
  assertStringIncludes(message.html, "set a password");
  assertStringIncludes(message.html, "https://project.supabase.co/auth/v1/verify?token=hash%2B%2F%3D&type=invite&redirect_to=http%3A%2F%2Flocalhost%3A5173%2Fauth%2Finvite%3Fsource%3Demail");
  assertEquals(message.html.includes(rawToken), false);
});

for (const [action, subjectFragment] of [["signup", "Confirm"], ["magiclink", "Sign in"], ["recovery", "Reset"]] as const) {
  Deno.test(`sends the ${action} email template`, async () => {
    const { deps, sent } = dependencies();
    const response = await createSendAuthEmailHandler(deps)(signedRequest({ token_hash: "hash", redirect_to: "https://app.example/auth/callback", email_action_type: action }));
    assertEquals(response.status, 200);
    assertStringIncludes(sent[0].subject, subjectFragment);
  });
}

Deno.test("rejects unsupported action types and Resend failures", async () => {
  const unsupported = dependencies();
  await error(await createSendAuthEmailHandler(unsupported.deps)(signedRequest({ token_hash: "hash", redirect_to: "https://app.example", email_action_type: "email_change" })));
  assertEquals(unsupported.sent, []);

  const failed = dependencies({ resend: { emails: { send: async () => ({ data: null, error: { message: "provider failed" } }) } } });
  await error(await createSendAuthEmailHandler(failed.deps)(signedRequest({ token_hash: "hash", redirect_to: "https://app.example", email_action_type: "invite" })));
});
