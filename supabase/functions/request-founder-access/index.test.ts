import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { createRequestFounderAccessHandler } from "./index.ts";
import type { FounderAccessDependencies } from "./index.ts";

// Test seam: records every insert and returns configurable select/insert results.
function makeService(opts: {
  existing?: { id: string } | null;
  insertError?: { code?: string; message?: string } | null;
} = {}) {
  const inserts: Array<Record<string, unknown>> = [];
  const dependencies: FounderAccessDependencies = {
    service: {
      from: (_table: "founder_access_requests") => ({
        select: (_columns: string) => ({
          eq: (_column: string, _value: string) => ({
            eq: (_column2: string, _value2: string) => ({
              maybeSingle: () =>
                Promise.resolve({ data: opts.existing ?? null, error: null }),
            }),
          }),
        }),
        insert: (values: Record<string, unknown>) => {
          inserts.push(values);
          return Promise.resolve({ error: opts.insertError ?? null });
        },
      }),
    },
    log: () => {},
  };
  return { dependencies, inserts };
}

function post(payload: unknown): Request {
  return new Request("http://localhost/functions/v1/request-founder-access", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof payload === "string" ? payload : JSON.stringify(payload),
  });
}

const validPayload = {
  applicantName: "John Doe",
  email: "john@example.com",
  organizationName: "Salsa Nights Boston",
};

Deno.test("inserts a valid request with status forced to pending", async () => {
  const { dependencies, inserts } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });

  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].status, "pending");
  assertEquals(inserts[0].normalized_email, "john@example.com");
  assertEquals(inserts[0].normalized_org_name, "salsa nights boston");
});

Deno.test("ignores a client-supplied status — insert always gets pending", async () => {
  const { dependencies, inserts } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post({ ...validPayload, status: "approved", reviewed_by: "x" }));
  assertEquals(res.status, 200);
  assertEquals(inserts.length, 1);
  assertEquals(inserts[0].status, "pending");
});

Deno.test("rejects invalid payloads with 400", async () => {
  const { dependencies, inserts } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const missing = await handler(post({ applicantName: "A", email: "not-an-email", organizationName: "X" }));
  assertEquals(missing.status, 400);

  const empty = await handler(post({}));
  assertEquals(empty.status, 400);

  assertEquals(inserts.length, 0);
});

Deno.test("rejects oversized body with 413", async () => {
  const { dependencies } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post({ ...validPayload, description: "a".repeat(11_000) }));
  assertEquals(res.status, 413);
});

Deno.test("rejects invalid JSON with 400", async () => {
  const { dependencies } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post("not json"));
  assertEquals(res.status, 400);
});

Deno.test("rejects non-POST methods with 405", async () => {
  const { dependencies } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(new Request("http://localhost/functions/v1/request-founder-access"));
  assertEquals(res.status, 405);
});

Deno.test("suppresses duplicates with the identical success body and no insert", async () => {
  const { dependencies, inserts } = makeService({ existing: { id: "existing-id" } });
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  // Enumeration-safe: byte-identical to a fresh submission's response.
  assertEquals(await res.json(), { success: true });
  assertEquals(inserts.length, 0);
});

Deno.test("treats a unique-violation insert error as a duplicate (concurrent race)", async () => {
  const { dependencies, inserts } = makeService({
    insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
  });
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(inserts.length, 1); // attempted, rejected by the index
});

Deno.test("returns a generic 500 on unexpected insert errors", async () => {
  const { dependencies } = makeService({ insertError: { message: "connection refused" } });
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 500);
  const body = await res.json();
  assertEquals(typeof body.error, "string");
});

Deno.test("honeypot submissions get success without inserting", async () => {
  const { dependencies, inserts } = makeService();
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post({ ...validPayload, companyWebsite: "http://spam.bot" }));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(inserts.length, 0);
});