import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createInviteOrganizerHandler,
  type InviteOrganizerDependencies,
  type ServiceClient,
} from "./index.ts";

type Call = { name: string; value: unknown };

function dependencies(overrides: Partial<InviteOrganizerDependencies> = {}) {
  const calls: Call[] = [];
  const service = {
    auth: {
      admin: {
        inviteUserByEmail: async (email: string, options: unknown) => {
          calls.push({ name: "invite", value: { email, options } });
          return { data: { user: { id: "organizer-id", app_metadata: { provider: "email" } } }, error: null };
        },
        updateUserById: async (id: string, update: unknown) => {
          calls.push({ name: "update", value: { id, update } });
          return { data: { user: { id } }, error: null };
        },
        deleteUser: async (id: string) => {
          calls.push({ name: "delete-user", value: id });
          return { error: null };
        },
      },
    },
    from: (table: string) => ({
      upsert: async (value: unknown) => {
        calls.push({ name: `upsert:${table}`, value });
        return { error: null };
      },
      insert: async (value: unknown) => {
        calls.push({ name: `insert:${table}`, value });
        return { error: null };
      },
      delete: () => ({
        eq: async (_column: string, value: unknown) => {
          calls.push({ name: `delete:${table}`, value });
          return { error: null };
        },
      }),
    }),
  };
  const deps: InviteOrganizerDependencies = {
    createCallerClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "admin-id", app_metadata: { role: "admin" } } }, error: null }) },
    }),
    createServiceClient: () => service as unknown as ServiceClient,
    redirectUrl: "http://localhost:5173/auth/invite",
    log: () => undefined,
    ...overrides,
  };
  return { deps, calls };
}

function request(body: unknown, authorization = "Bearer caller-token") {
  return new Request("http://localhost/invite-organizer", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body),
  });
}

Deno.test("rejects a non-POST request", async () => {
  const { deps } = dependencies();
  const response = await createInviteOrganizerHandler(deps)(new Request("http://localhost", { method: "GET" }));
  assertEquals(response.status, 405);
});

Deno.test("rejects missing or malformed authorization", async () => {
  const { deps } = dependencies();
  const handler = createInviteOrganizerHandler(deps);
  assertEquals((await handler(request({ email: "person@example.com" }, ""))).status, 401);
  assertEquals((await handler(request({ email: "person@example.com" }, "Basic abc"))).status, 401);
});

Deno.test("rejects authenticated callers without the admin app-metadata role", async () => {
  const { deps } = dependencies({
    createCallerClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: "organizer-id", app_metadata: { role: "organizer" } } }, error: null }) },
    }),
  });
  assertEquals((await createInviteOrganizerHandler(deps)(request({ email: "person@example.com" }))).status, 403);
});

Deno.test("rejects malformed email addresses", async () => {
  const { deps } = dependencies();
  assertEquals((await createInviteOrganizerHandler(deps)(request({ email: "not-an-email" }))).status, 400);
});

Deno.test("invites organizers with only trusted role and redirect values", async () => {
  const { deps, calls } = dependencies();
  const response = await createInviteOrganizerHandler(deps)(request({
    email: " Person@Example.COM ",
    displayName: " Person ",
    role: "admin",
    redirectTo: "https://attacker.example",
  }));
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { delivery: "email_invitation", userId: "organizer-id", email: "person@example.com" });
  assertEquals(calls, [
    { name: "invite", value: { email: "person@example.com", options: { redirectTo: "http://localhost:5173/auth/invite", data: { display_name: "Person" } } } },
    { name: "update", value: { id: "organizer-id", update: { app_metadata: { provider: "email", role: "organizer" } } } },
    { name: "upsert:profiles", value: { id: "organizer-id", display_name: "Person", role: "organizer", status: "active" } },
    { name: "insert:audit_logs", value: { actor_id: "admin-id", action: "user.invited", entity_type: "profile", entity_id: "organizer-id", metadata: { email: "person@example.com", role: "organizer" } } },
  ]);
});

Deno.test("returns a safe conflict for duplicate Auth users", async () => {
  const { deps } = dependencies({
    createServiceClient: () => ({ auth: { admin: { inviteUserByEmail: async () => ({ data: { user: null }, error: { message: "User already registered" } }) } } }) as unknown as ServiceClient,
  });
  const response = await createInviteOrganizerHandler(deps)(request({ email: "person@example.com" }));
  assertEquals(response.status, 409);
  assertEquals(await response.json(), { error: "An account already exists for this email" });
});

Deno.test("rolls back profile and Auth user after post-create failure without leaking secrets", async () => {
  const secret = "service-role-secret";
  const { deps, calls } = dependencies({
    createServiceClient: () => ({
      auth: { admin: {
        inviteUserByEmail: async () => ({ data: { user: { id: "organizer-id", app_metadata: {} } }, error: null }),
        updateUserById: async () => ({ data: { user: null }, error: { message: "update failed" } }),
        deleteUser: async (id: string) => { calls.push({ name: "delete-user", value: id }); return { error: null }; },
      } },
      from: (table: string) => ({ delete: () => ({ eq: async (_column: string, value: unknown) => { calls.push({ name: `delete:${table}`, value }); return { error: null }; } }) }),
    }) as unknown as ServiceClient,
  });
  const response = await createInviteOrganizerHandler(deps)(request({ email: "person@example.com" }));
  const payload = await response.text();
  assertEquals(response.status, 500);
  assertEquals(calls, [{ name: "delete:profiles", value: "organizer-id" }, { name: "delete-user", value: "organizer-id" }]);
  assertStringIncludes(payload, "Unable to send invitation; please try again");
  assertEquals(payload.includes(secret), false);
});

Deno.test("rolls back when profile or audit provisioning fails", async () => {
  for (const failedStep of ["profile", "audit"]) {
    const { deps, calls } = dependencies({
      createServiceClient: () => ({
        auth: { admin: {
          inviteUserByEmail: async () => ({ data: { user: { id: "organizer-id", app_metadata: {} } }, error: null }),
          updateUserById: async () => ({ data: { user: { id: "organizer-id" }, error: null }),
          deleteUser: async (id: string) => { calls.push({ name: "delete-user", value: id }); return { error: null }; },
        } },
        from: (table: string) => ({
          upsert: async () => ({ error: failedStep === "profile" ? { message: "profile failed" } : null }),
          insert: async () => ({ error: failedStep === "audit" ? { message: "audit failed" } : null }),
          delete: () => ({ eq: async (_column: string, value: unknown) => { calls.push({ name: `delete:${table}`, value }); return { error: null }; } }),
        }),
      }) as unknown as ServiceClient,
    });
    const response = await createInviteOrganizerHandler(deps)(request({ email: "person@example.com" }));
    assertEquals(response.status, 500);
    assertEquals(calls.slice(-2), [{ name: "delete:profiles", value: "organizer-id" }, { name: "delete-user", value: "organizer-id" }]);
  }
});
