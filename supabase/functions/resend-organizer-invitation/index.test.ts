import {
  assertEquals,
  assertExists,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createResendOrganizerInvitationHandler,
  type ResendOrganizerInvitationDependencies,
  type ServiceClient,
} from "./index.ts";

type Call = { name: string; value: unknown };

const ACCEPT_URL =
  "https://project.supabase.co/auth/v1/verify?token=hashed-credential&type=invite&redirect_to=https%3A%2F%2Fwww.salsasegura.com%2Fauth%2Finvite";
const IDEMPOTENCY_KEY = "123e4567-e89b-42d3-a456-426614174000";
const TARGET_ID = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

function dependencies(
  overrides: Partial<ResendOrganizerInvitationDependencies> = {},
  targetOverrides: Record<string, unknown> = {}
) {
  const calls: Call[] = [];
  const logs: Call[] = [];
  const service = {
    auth: {
      admin: {
        getUserById: async (id: string) => {
          calls.push({ name: "getUserById", value: id });
          return {
            data: {
              user: {
                id: TARGET_ID,
                email: "organizer@example.com",
                email_confirmed_at: null,
                app_metadata: { role: "organizer" },
                ...targetOverrides,
              },
            },
            error: null,
          };
        },
        generateLink: async (params: unknown) => {
          calls.push({ name: "generateLink", value: params });
          return { data: { properties: { action_link: ACCEPT_URL } }, error: null };
        },
      },
    },
    from: (table: string) => ({
      insert: async (value: unknown) => {
        calls.push({ name: `insert:${table}`, value });
        return { error: null };
      },
    }),
  };

  const deps: ResendOrganizerInvitationDependencies = {
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "admin-id", app_metadata: { role: "admin" } } },
          error: null,
        }),
      },
    }),
    createServiceClient: () => service as unknown as ServiceClient,
    resend: {
      emails: {
        send: async (message, options) => {
          calls.push({ name: "resend:send", value: { message, options } });
          return { data: { id: "resend-msg-1" }, error: null };
        },
      },
    },
    from: "SalsaSegura <invites@salsasegura.com>",
    redirectUrl: "https://www.salsasegura.com/auth/invite",
    log: (message, details) => logs.push({ name: message, value: details }),
    ...overrides,
  };
  return { deps, calls, logs };
}

function request(
  body: unknown = { userId: TARGET_ID, idempotencyKey: IDEMPOTENCY_KEY },
  authorization = "Bearer caller-token"
) {
  return new Request("http://localhost/resend-organizer-invitation", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body),
  });
}

Deno.test("answers browser preflight with CORS headers", async () => {
  const { deps } = dependencies();
  const response = await createResendOrganizerInvitationHandler(deps)(
    new Request("http://localhost/resend-organizer-invitation", { method: "OPTIONS" })
  );
  assertEquals(response.status, 204);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects a non-POST request", async () => {
  const { deps } = dependencies();
  const response = await createResendOrganizerInvitationHandler(deps)(
    new Request("http://localhost", { method: "GET" })
  );
  assertEquals(response.status, 405);
});

Deno.test("rejects missing or malformed authorization", async () => {
  const { deps } = dependencies();
  const handler = createResendOrganizerInvitationHandler(deps);
  assertEquals((await handler(request(undefined, ""))).status, 401);
  assertEquals((await handler(request(undefined, "Basic abc"))).status, 401);
});

Deno.test("rejects authenticated callers without the admin role", async () => {
  const { deps, calls } = dependencies({
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: { id: "mod-id", app_metadata: { role: "moderator" } } },
          error: null,
        }),
      },
    }),
  });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 403);
  assertEquals(calls, []);
});

Deno.test("fails closed when the trusted redirect configuration is missing or invalid", async () => {
  for (const redirectUrl of [null, "javascript:alert(1)"]) {
    const { deps, calls } = dependencies({ redirectUrl });
    const response = await createResendOrganizerInvitationHandler(deps)(request());
    assertEquals(response.status, 500);
    assertEquals(calls, []);
  }
});

Deno.test("requires a uuid user id and idempotency key", async () => {
  const { deps, calls } = dependencies();
  const handler = createResendOrganizerInvitationHandler(deps);

  for (const body of [{}, { userId: "not-a-uuid", idempotencyKey: IDEMPOTENCY_KEY }, [], null]) {
    assertEquals((await handler(request(body))).status, 400);
  }
  assertEquals((await handler(request({ userId: TARGET_ID }))).status, 400);
  assertEquals(calls, []);
});

Deno.test("resends with a freshly minted credential and the trusted redirect", async () => {
  const { deps, calls } = dependencies();
  const response = await createResendOrganizerInvitationHandler(deps)(request());

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    delivery: "email_invitation",
    userId: TARGET_ID,
    email: "organizer@example.com",
  });

  assertEquals(calls.find((call) => call.name === "generateLink")?.value, {
    type: "invite",
    email: "organizer@example.com",
    options: { redirectTo: "https://www.salsasegura.com/auth/invite" },
  });

  const send = calls.find((call) => call.name === "resend:send");
  assertExists(send);
  const { message, options } = send.value as {
    message: { to: string; from: string; subject: string; html: string; text: string };
    options: { idempotencyKey: string };
  };
  assertEquals(message.to, "organizer@example.com");
  assertEquals(message.from, "SalsaSegura <invites@salsasegura.com>");
  assertStringIncludes(message.subject, "invitation");
  assertStringIncludes(message.html, "Accept invitation");
  assertStringIncludes(message.text, ACCEPT_URL);
  assertEquals(options.idempotencyKey, IDEMPOTENCY_KEY);
});

Deno.test("reads the recipient server-side — a caller-supplied email is ignored", async () => {
  const { deps, calls } = dependencies();
  await createResendOrganizerInvitationHandler(deps)(
    request({
      userId: TARGET_ID,
      idempotencyKey: IDEMPOTENCY_KEY,
      email: "attacker@evil.example",
      redirectTo: "https://evil.example",
    })
  );

  const send = calls.find((call) => call.name === "resend:send")!;
  const { message } = send.value as { message: { to: string } };
  assertEquals(message.to, "organizer@example.com");
  assertEquals(calls.find((call) => call.name === "generateLink")?.value, {
    type: "invite",
    email: "organizer@example.com",
    options: { redirectTo: "https://www.salsasegura.com/auth/invite" },
  });
});

Deno.test("refuses to resend an invitation that was already accepted", async () => {
  const { deps, calls } = dependencies({}, { email_confirmed_at: "2026-02-01T00:00:00Z" });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 409);
  assertEquals(calls.some((call) => call.name === "resend:send"), false);
  assertEquals(calls.some((call) => call.name === "generateLink"), false);
});

Deno.test("refuses accounts that hold no organizer invitation", async () => {
  const { deps, calls } = dependencies({}, { app_metadata: { role: "user" } });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 409);
  assertEquals(calls.some((call) => call.name === "resend:send"), false);
});

Deno.test("returns 404 for an unknown account without sending", async () => {
  const { deps, calls } = dependencies({
    createServiceClient: () =>
      ({
        auth: {
          admin: {
            getUserById: async () => ({ data: { user: null }, error: null }),
            generateLink: async () => {
              throw new Error("must not be called");
            },
          },
        },
        from: () => ({ insert: async () => ({ error: null }) }),
      }) as unknown as ServiceClient,
  });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 404);
  assertEquals(calls.some((call) => call.name === "resend:send"), false);
});

Deno.test("writes an audit record carrying the message id but never the credential", async () => {
  const { deps, calls } = dependencies();
  await createResendOrganizerInvitationHandler(deps)(request());

  const audit = calls.find((call) => call.name === "insert:audit_logs");
  assertExists(audit);
  assertEquals(audit.value, {
    actor_id: "admin-id",
    action: "user.invitation_resent",
    entity_type: "profile",
    entity_id: TARGET_ID,
    metadata: {
      email: "organizer@example.com",
      role: "organizer",
      provider_message_id: "resend-msg-1",
    },
  });
  assertEquals(JSON.stringify(audit.value).includes("hashed-credential"), false);
});

Deno.test("never leaks the credential in the response body or the logs", async () => {
  const { deps, logs } = dependencies({
    resend: { emails: { send: async () => ({ data: null, error: { message: "boom" } }) } },
  });
  const response = await createResendOrganizerInvitationHandler(deps)(request());

  assertEquals(response.status, 500);
  const body = await response.text();
  assertEquals(body.includes("hashed-credential"), false);
  assertEquals(JSON.stringify(logs).includes("hashed-credential"), false);
  assertStringIncludes(JSON.stringify(logs), "provider_error");
});

Deno.test("a thrown provider error is reported as a retryable failure, not a crash", async () => {
  const { deps, logs } = dependencies({
    resend: {
      emails: {
        send: async () => {
          throw new Error("fetch failed");
        },
      },
    },
  });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 500);
  assertStringIncludes(JSON.stringify(logs), "network_error");
});

Deno.test("a link-generation failure sends nothing", async () => {
  const { deps, calls } = dependencies({
    createServiceClient: () =>
      ({
        auth: {
          admin: {
            getUserById: async () => ({
              data: {
                user: {
                  id: TARGET_ID,
                  email: "organizer@example.com",
                  email_confirmed_at: null,
                  app_metadata: { role: "organizer" },
                },
              },
              error: null,
            }),
            generateLink: async () => ({
              data: { properties: null },
              error: { message: "email_exists" },
            }),
          },
        },
        from: () => ({ insert: async () => ({ error: null }) }),
      }) as unknown as ServiceClient,
  });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 500);
  assertEquals(calls.some((call) => call.name === "resend:send"), false);
});

Deno.test("an audit-write failure does not resend the already-delivered email", async () => {
  const { deps, logs } = dependencies({
    createServiceClient: () =>
      ({
        auth: {
          admin: {
            getUserById: async () => ({
              data: {
                user: {
                  id: TARGET_ID,
                  email: "organizer@example.com",
                  email_confirmed_at: null,
                  app_metadata: { role: "organizer" },
                },
              },
              error: null,
            }),
            generateLink: async () => ({
              data: { properties: { action_link: ACCEPT_URL } },
              error: null,
            }),
          },
        },
        from: () => ({ insert: async () => ({ error: { message: "denied" } }) }),
      }) as unknown as ServiceClient,
  });
  const response = await createResendOrganizerInvitationHandler(deps)(request());
  assertEquals(response.status, 200);
  assertStringIncludes(JSON.stringify(logs), "audit write failed");
});
