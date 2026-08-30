import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import {
  createDeleteAccountHandler,
  findAccountDeletionBlocker,
  type AccountDeletionDependencies,
  type DeletionBlocker,
} from "./index.ts";

type User = { id: string; email?: string | null; app_metadata?: Record<string, unknown> | null };

function request(body: unknown, authorization = "Bearer caller-token", method = "POST") {
  return new Request("http://localhost/delete-account", {
    method,
    headers: { "content-type": "application/json", authorization },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
}

function dependencies(options: {
  user?: User | null;
  blocker?: DeletionBlocker | null;
  deleteError?: { message?: string } | null;
  users?: Array<User | null>;
} = {}) {
  const deletedIds: string[] = [];
  const users = options.users ?? [
    options.user ?? { id: "caller-id", email: "maria@example.com", app_metadata: {} },
  ];
  let userIndex = 0;

  const deps: AccountDeletionDependencies = {
    createCallerClient: () => ({
      auth: {
        getUser: async () => ({
          data: { user: users[Math.min(userIndex++, users.length - 1)] },
          error: null,
        }),
      },
    }),
    createServiceClient: () => ({
      auth: {
        admin: {
          deleteUser: async (id: string) => {
            deletedIds.push(id);
            return { error: options.deleteError ?? null };
          },
        },
      },
      rpc: async () => ({ data: null, error: null }),
    }),
    findBlocker: async () => options.blocker ?? null,
    log: () => undefined,
  };

  return { deps, deletedIds };
}

Deno.test("rejects unsupported methods and malformed bearer authorization", async () => {
  const { deps } = dependencies();
  const handler = createDeleteAccountHandler(deps);

  assertEquals((await handler(request({}, "", "POST"))).status, 401);
  assertEquals((await handler(request({}, "Basic caller-token", "POST"))).status, 401);
  assertEquals((await handler(request({}, "Bearer caller-token", "GET"))).status, 405);
});

Deno.test("handles CORS preflight without authorizing a deletion", async () => {
  const { deps, deletedIds } = dependencies();
  const response = await createDeleteAccountHandler(deps)(new Request("http://localhost/delete-account", { method: "OPTIONS" }));

  assertEquals(response.status, 204);
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
  assertEquals(deletedIds, []);
});

Deno.test("derives the hard-delete target from the validated caller, never the request body", async () => {
  const { deps, deletedIds } = dependencies({
    user: { id: "validated-caller", email: "maria@example.com", app_metadata: {} },
  });

  const response = await createDeleteAccountHandler(deps)(
    request({ action: "delete", userId: "another-account" })
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), { outcome: "deleted" });
  assertEquals(deletedIds, ["validated-caller"]);
});

Deno.test("blocks every privileged scalar role before calling Auth Admin", async () => {
  for (const role of ["organizer", "moderator", "admin"] as const) {
    const { deps, deletedIds } = dependencies({
      user: { id: `${role}-id`, email: `${role}@example.com`, app_metadata: { role } },
    });

    const response = await createDeleteAccountHandler(deps)(request({ action: "delete" }));

    assertEquals(response.status, 409);
    assertEquals(await response.json(), { outcome: "blocked", blocker: "role" });
    assertEquals(deletedIds, []);
  }
});

Deno.test("blocks protected, Storage, and unknown dependencies at deletion time", async () => {
  for (const blocker of ["event_history", "organizer", "operational_history", "storage", "unknown"] as const) {
    const { deps, deletedIds } = dependencies({ blocker });
    const response = await createDeleteAccountHandler(deps)(request({ action: "delete" }));

    assertEquals(response.status, 409);
    assertEquals(await response.json(), { outcome: "blocked", blocker });
    assertEquals(deletedIds, []);
  }
});

Deno.test("gets the current user's deletion blocker from the service-only database RPC", async () => {
  const calls: Array<{
    name: string;
    args: { target_user_id: string; target_email: string | null };
  }> = [];
  const service = {
    auth: { admin: { deleteUser: async () => ({ error: null }) } },
    rpc: async (name: string, args: { target_user_id: string; target_email: string | null }) => {
      calls.push({ name, args });
      return { data: "storage", error: null };
    },
  };

  assertEquals(
    await findAccountDeletionBlocker(service, { id: "storage-owner", email: "maria@example.com" }),
    "storage"
  );
  assertEquals(calls, [
    {
      name: "account_deletion_blocker",
      args: { target_user_id: "storage-owner", target_email: "maria@example.com" },
    },
  ]);
});

Deno.test("fails closed when dependency inspection throws", async () => {
  const { deps, deletedIds } = dependencies();
  deps.findBlocker = async () => {
    throw new Error("unexpected database failure");
  };

  const response = await createDeleteAccountHandler(deps)(request({ action: "delete" }));

  assertEquals(response.status, 409);
  assertEquals(await response.json(), { outcome: "blocked", blocker: "unknown" });
  assertEquals(deletedIds, []);
});

Deno.test("rechecks eligibility immediately before deletion", async () => {
  const { deps, deletedIds } = dependencies();
  let checks = 0;
  deps.findBlocker = async () => (checks++ === 0 ? null : "event_history");
  const handler = createDeleteAccountHandler(deps);

  assertEquals((await handler(request({ action: "eligibility" }))).status, 200);
  const deletion = await handler(request({ action: "delete" }));

  assertEquals(deletion.status, 409);
  assertEquals(await deletion.json(), { outcome: "blocked", blocker: "event_history" });
  assertEquals(deletedIds, []);
});

Deno.test("sanitizes Auth Admin failures and preserves the caller account", async () => {
  const { deps, deletedIds } = dependencies({ deleteError: { message: "storage.objects owner conflict" } });
  const response = await createDeleteAccountHandler(deps)(request({ action: "delete" }));

  assertEquals(response.status, 503);
  assertEquals(await response.json(), {
    error: "Account deletion could not be completed. Please try again.",
  });
  assertEquals(deletedIds, ["caller-id"]);
});

Deno.test("a repeated request after Auth removal cannot delete a second account", async () => {
  const { deps, deletedIds } = dependencies({
    users: [
      { id: "caller-id", email: "maria@example.com", app_metadata: {} },
      null,
    ],
  });
  const handler = createDeleteAccountHandler(deps);

  assertEquals((await handler(request({ action: "delete" }))).status, 200);
  assertEquals((await handler(request({ action: "delete" }))).status, 401);
  assertEquals(deletedIds, ["caller-id"]);
});
