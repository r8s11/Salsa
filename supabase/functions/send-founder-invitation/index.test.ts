import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { createSendFounderInvitationHandler, type SendFounderInvitationDependencies } from "./index.ts";

type Call = { name: string; value: unknown };

const TOKEN = "a".repeat(64);
const ACCEPT_URL_BASE = "http://localhost:5173/founders/accept";

const DEFAULT_INVITATION = {
  id: "inv-1",
  token: TOKEN,
  email: "founder@example.com",
  organizationName: "Salsa Riverside",
  expiresAt: "2026-09-03T00:00:00.000Z",
};

function dependencies(overrides: Partial<SendFounderInvitationDependencies> = {}) {
  const calls: Call[] = [];
  const logs: Array<{ message: string; details?: unknown }> = [];

  const rpcResponses: Record<string, { data: unknown; error: { code?: string; message?: string } | null }> = {
    admin_create_founder_invitation: { data: DEFAULT_INVITATION, error: null },
    admin_record_founder_invitation_delivery_attempt: {
      data: { id: "attempt-1", attemptNumber: 1, status: "sent" },
      error: null,
    },
    admin_revoke_founder_invitation: { data: { success: true, status: "revoked" }, error: null },
  };

  const deps: SendFounderInvitationDependencies = {
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "admin-id", app_metadata: { role: "admin" } } },
          error: null,
        }),
      },
      rpc: async (fn: string, args: Record<string, unknown>) => {
        calls.push({ name: `rpc:${fn}`, value: args });
        return rpcResponses[fn] ?? { data: null, error: { message: `no mock for ${fn}` } };
      },
    }),
    resend: {
      emails: {
        send: async (message) => {
          calls.push({ name: "resend:send", value: message });
          return { data: { id: "resend-msg-1" }, error: null };
        },
      },
    },
    from: "SalsaSegura <onboarding@resend.dev>",
    acceptUrlBase: ACCEPT_URL_BASE,
    log: (message, details) => logs.push({ message, details }),
    ...overrides,
  };

  return { deps, calls, logs, rpcResponses };
}

function request(body: unknown, authorization = "Bearer caller-token") {
  return new Request("http://localhost/send-founder-invitation", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body),
  });
}

// --- Authorization -----------------------------------------------------

Deno.test("rejects a non-POST request", async () => {
  const { deps } = dependencies();
  const response = await createSendFounderInvitationHandler(deps)(
    new Request("http://localhost/send-founder-invitation", { method: "GET" })
  );
  assertEquals(response.status, 405);
});

Deno.test("rejects missing or malformed authorization", async () => {
  const { deps } = dependencies();
  const response = await createSendFounderInvitationHandler(deps)(
    request({ founderRequestId: "req-1" }, "")
  );
  assertEquals(response.status, 401);
});

Deno.test("rejects moderators", async () => {
  const { deps, calls } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "mod-id", app_metadata: { role: "moderator" } } },
          error: null,
        }),
      },
      rpc: async () => ({ data: null, error: { message: "should not be called" } }),
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 403);
  assertEquals(calls.length, 0);
});

Deno.test("rejects regular users", async () => {
  const { deps } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "user-id", app_metadata: { role: "user" } } },
          error: null,
        }),
      },
      rpc: async () => ({ data: null, error: { message: "should not be called" } }),
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 403);
});

Deno.test("rejects anonymous callers (auth.getUser returns no user)", async () => {
  const { deps } = dependencies({
    createCallerClient: () => ({
      auth: { getUser: async () => ({ data: { user: null }, error: null }) },
      rpc: async () => ({ data: null, error: { message: "should not be called" } }),
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 401);
});

Deno.test("rejects a body without founderRequestId", async () => {
  const { deps } = dependencies();
  const response = await createSendFounderInvitationHandler(deps)(request({}));
  assertEquals(response.status, 400);
});

// --- Eligibility (pass-through from the Phase 4 RPC) --------------------

Deno.test("maps pending/rejected-request RPC error to 400", async () => {
  const { deps } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-id", app_metadata: { role: "admin" } } }, error: null }),
      },
      rpc: async () => ({
        data: null,
        error: { code: "22023", message: "founder request must be approved before an invitation can be created (current status: pending)" },
      }),
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 400);
});

Deno.test("maps nonexistent-request RPC error to 404", async () => {
  const { deps } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-id", app_metadata: { role: "admin" } } }, error: null }),
      },
      rpc: async () => ({ data: null, error: { code: "P0002", message: "founder request not found" } }),
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "missing" }));
  assertEquals(response.status, 404);
});

Deno.test("maps an already-active invitation RPC error to 409 without sending email", async () => {
  const { deps, calls } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({ data: { user: { id: "admin-id", app_metadata: { role: "admin" } } }, error: null }),
      },
      rpc: async (fn: string) => {
        calls.push({ name: `rpc:${fn}`, value: {} });
        return { data: null, error: { code: "23505", message: "an active invitation already exists for this request" } };
      },
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 409);
  assertEquals(calls.filter((c) => c.name === "resend:send").length, 0);
});

// --- Success path: email content + delivery recording -------------------

Deno.test("sends the email to the invitation's email, with subject/accept-URL/expiry copy", async () => {
  const { deps, calls } = dependencies();
  await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));

  const sendCall = calls.find((c) => c.name === "resend:send");
  assertExists(sendCall);
  const message = sendCall!.value as { to: string; subject: string; html: string; text: string };
  assertEquals(message.to, DEFAULT_INVITATION.email);
  assertEquals(message.subject, "You're invited to manage your events on SalsaSegura");
  assertStringIncludes(message.html, `${ACCEPT_URL_BASE}?token=${TOKEN}`);
  assertStringIncludes(message.text, `${ACCEPT_URL_BASE}?token=${TOKEN}`);
  assertStringIncludes(message.html, "Salsa Riverside");
  assertStringIncludes(message.text, "expires");
});

Deno.test("does not encode role/status/organization-owner metadata into the accept URL", async () => {
  const { deps, calls } = dependencies();
  await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  const sendCall = calls.find((c) => c.name === "resend:send")!;
  const message = sendCall.value as { html: string };
  const urlMatch = message.html.match(/href="([^"]+)"/);
  assertExists(urlMatch);
  const url = new URL(urlMatch![1]);
  assertEquals([...url.searchParams.keys()], ["token"]);
});

Deno.test("records a sent delivery attempt with the provider message id on success", async () => {
  const { deps, calls } = dependencies();
  await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));

  const recordCall = calls.find((c) => c.name === "rpc:admin_record_founder_invitation_delivery_attempt");
  assertExists(recordCall);
  const args = recordCall!.value as Record<string, unknown>;
  assertEquals(args.p_status, "sent");
  assertEquals(args.p_provider_message_id, "resend-msg-1");
  assertEquals(args.p_invitation_id, DEFAULT_INVITATION.id);
});

Deno.test("returns a safe success payload without the plaintext token", async () => {
  const { deps } = dependencies();
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 200);
  const bodyText = await response.text();
  assertEquals(bodyText.includes(TOKEN), false);
  const body = JSON.parse(bodyText);
  assertEquals(body, {
    success: true,
    invitationId: DEFAULT_INVITATION.id,
    email: DEFAULT_INVITATION.email,
    expiresAt: DEFAULT_INVITATION.expiresAt,
  });
});

Deno.test("never logs the plaintext token", async () => {
  const { deps, logs } = dependencies();
  await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  for (const entry of logs) {
    assertEquals(JSON.stringify(entry).includes(TOKEN), false);
  }
});

// --- Failure + compensation ----------------------------------------------

Deno.test("records a failed delivery attempt and revokes the invitation when Resend returns an error", async () => {
  const { deps, calls } = dependencies({
    resend: {
      emails: {
        send: async () => ({ data: null, error: { message: "Rate limit exceeded", name: "rate_limit_exceeded" } }),
      },
    },
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));

  assertEquals(response.status, 502);
  const body = await response.json();
  assertEquals(body.error, "Invitation created, but the email could not be sent. Please try again.");

  const recordCall = calls.find((c) => c.name === "rpc:admin_record_founder_invitation_delivery_attempt");
  const args = recordCall!.value as Record<string, unknown>;
  assertEquals(args.p_status, "failed");
  assertEquals(args.p_error_code, "rate_limited");

  const revokeCall = calls.find((c) => c.name === "rpc:admin_revoke_founder_invitation");
  assertExists(revokeCall);
  assertEquals((revokeCall!.value as Record<string, unknown>).p_invitation_id, DEFAULT_INVITATION.id);
});

Deno.test("classifies a thrown network error and still compensates", async () => {
  const { deps, calls } = dependencies({
    resend: {
      emails: {
        send: async () => {
          throw new Error("fetch failed");
        },
      },
    },
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 502);

  const recordCall = calls.find((c) => c.name === "rpc:admin_record_founder_invitation_delivery_attempt");
  assertEquals((recordCall!.value as Record<string, unknown>).p_error_code, "network_error");
  assertExists(calls.find((c) => c.name === "rpc:admin_revoke_founder_invitation"));
});

Deno.test("does not report success when the provider returns no message id", async () => {
  const { deps, calls } = dependencies({
    resend: {
      emails: {
        send: async () => ({ data: {}, error: null }),
      },
    },
  });
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 502);
  assertExists(calls.find((c) => c.name === "rpc:admin_revoke_founder_invitation"));
});

Deno.test("a compensating-revoke failure does not change the reported outcome", async () => {
  const { deps } = dependencies({
    resend: {
      emails: {
        send: async () => ({ data: null, error: { message: "boom" } }),
      },
    },
  });
  const originalCreateCallerClient = deps.createCallerClient;
  deps.createCallerClient = (authorization: string) => {
    const client = originalCreateCallerClient(authorization);
    return {
      ...client,
      rpc: async (fn: string, args: Record<string, unknown>) => {
        if (fn === "admin_revoke_founder_invitation") {
          return { data: null, error: { code: "P0002", message: "invitation not found" } };
        }
        return client.rpc(fn, args);
      },
    };
  };
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 502);
});
