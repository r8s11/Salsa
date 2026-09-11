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
  attemptId: "attempt-1",
  claimed: true as const,
  deduplicated: false as const,
};

function dependencies(overrides: Partial<SendFounderInvitationDependencies> = {}) {
  const calls: Call[] = [];
  const logs: Array<{ message: string; details?: unknown }> = [];

  const rpcResponses: Record<string, { data: unknown; error: { code?: string; message?: string } | null }> = {
    admin_claim_founder_invitation_delivery: { data: DEFAULT_INVITATION, error: null },
    admin_complete_founder_invitation_delivery: {
      data: { success: true, deduplicated: false, status: "sent" },
      error: null,
    },
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
  const requestBody =
    typeof body === "object" && body !== null && !Array.isArray(body)
      ? { ...body, idempotencyKey: "123e4567-e89b-42d3-a456-426614174000" }
      : body;
  return new Request("http://localhost/send-founder-invitation", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(requestBody),
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

Deno.test("rejects a missing idempotency key", async () => {
  const { deps } = dependencies();
  const response = await createSendFounderInvitationHandler(deps)(
    new Request("http://localhost/send-founder-invitation", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer caller-token" },
      body: JSON.stringify({ founderRequestId: "req-1" }),
    })
  );
  assertEquals(response.status, 400);
});

Deno.test("answers CORS preflight without authenticating", async () => {
  const { deps, calls } = dependencies();
  const response = await createSendFounderInvitationHandler(deps)(
    new Request("http://localhost/send-founder-invitation", { method: "OPTIONS" })
  );
  assertEquals(response.status, 200);
  assertEquals(response.headers.get("access-control-allow-methods"), "POST, OPTIONS");
  assertEquals(calls.length, 0);
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

Deno.test("maps the server-side reissue cooldown to 429", async () => {
  const { deps } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "admin-id", app_metadata: { role: "admin" } } },
          error: null,
        }),
      },
      rpc: async () => ({
        data: null,
        error: { code: "55000", message: "please wait before reissuing this invitation" },
      }),
    }),
  });
  const response = await createSendFounderInvitationHandler(deps)(
    request({ founderRequestId: "req-1" })
  );
  assertEquals(response.status, 429);
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

Deno.test("deduplicates an attempting claim without contacting Resend", async () => {
  const { deps, calls, rpcResponses } = dependencies();
  rpcResponses.admin_claim_founder_invitation_delivery = {
    data: {
      claimed: false,
      deduplicated: true,
      status: "attempting",
      invitationId: DEFAULT_INVITATION.id,
      email: DEFAULT_INVITATION.email,
      expiresAt: DEFAULT_INVITATION.expiresAt,
    },
    error: null,
  };
  const response = await createSendFounderInvitationHandler(deps)(
    request({ founderRequestId: "req-1" })
  );
  assertEquals(response.status, 200);
  assertEquals(calls.some((call) => call.name === "resend:send"), false);
  assertEquals(await response.json(), {
    success: true,
    deduplicated: true,
    deliveryStatus: "attempting",
    invitationId: DEFAULT_INVITATION.id,
    email: DEFAULT_INVITATION.email,
    expiresAt: DEFAULT_INVITATION.expiresAt,
  });
});

Deno.test("claims before sending and completes the attempt with the provider message id", async () => {
  const { deps, calls } = dependencies();
  await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));

  assertEquals(calls[0]?.name, "rpc:admin_claim_founder_invitation_delivery");
  const recordCall = calls.find((c) => c.name === "rpc:admin_complete_founder_invitation_delivery");
  assertExists(recordCall);
  const args = recordCall!.value as Record<string, unknown>;
  assertEquals(args.p_status, "sent");
  assertEquals(args.p_provider_message_id, "resend-msg-1");
  assertEquals(args.p_attempt_id, DEFAULT_INVITATION.attemptId);
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

Deno.test("completes a failed delivery claim so the database revokes the invitation atomically", async () => {
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

  const recordCall = calls.find((c) => c.name === "rpc:admin_complete_founder_invitation_delivery");
  const args = recordCall!.value as Record<string, unknown>;
  assertEquals(args.p_status, "failed");
  assertEquals(args.p_error_code, "rate_limited");
  assertEquals(args.p_attempt_id, DEFAULT_INVITATION.attemptId);
});

Deno.test("classifies a thrown network error and completes the failed claim", async () => {
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

  const recordCall = calls.find((c) => c.name === "rpc:admin_complete_founder_invitation_delivery");
  assertEquals((recordCall!.value as Record<string, unknown>).p_error_code, "network_error");
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
  assertExists(calls.find((c) => c.name === "rpc:admin_complete_founder_invitation_delivery"));
});

Deno.test("a failed completion write does not misreport provider failure as success", async () => {
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
        if (fn === "admin_complete_founder_invitation_delivery") {
          return { data: null, error: { code: "P0002", message: "attempt not found" } };
        }
        return client.rpc(fn, args);
      },
    };
  };
  const response = await createSendFounderInvitationHandler(deps)(request({ founderRequestId: "req-1" }));
  assertEquals(response.status, 502);
});
