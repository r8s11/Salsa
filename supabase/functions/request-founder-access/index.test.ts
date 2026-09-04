import { assertEquals, assertExists } from "https://deno.land/std/testing/asserts.ts";
import { createRequestFounderAccessHandler } from "./index.ts";
import type { FounderAccessDependencies, FounderRequestNotifyDependencies } from "./index.ts";

const INSERTED_ROW = { id: "new-request-id", created_at: "2026-09-04T12:00:00.000Z" };

// Test seam: records every insert and returns configurable select/insert results.
function makeService(opts: {
  existing?: { id: string } | null;
  insertError?: { code?: string; message?: string } | null;
  insertedRow?: { id: string; created_at: string } | null;
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
          return {
            select: (_columns: string) => ({
              single: () =>
                Promise.resolve({
                  data: opts.insertError ? null : opts.insertedRow ?? INSERTED_ROW,
                  error: opts.insertError ?? null,
                }),
            }),
          };
        },
      }),
    },
    notify: makeNotify().dependencies,
    log: () => {},
  };
  return { dependencies, inserts };
}

// Test seam for the internal admin-notification path: records every claim/
// complete/send call so tests can assert exactly what was attempted.
function makeNotify(opts: {
  settings?: { platform_name: string; support_email: string } | null;
  settingsError?: { code?: string; message?: string } | null;
  claimAttemptId?: string | null;
  claimError?: { code?: string; message?: string } | null;
  resendConfigured?: boolean;
  sendResult?: { data: { id?: string } | null; error: { message?: string; name?: string } | null };
  sendThrows?: unknown;
  reviewUrlBase?: string | null;
} = {}) {
  const claims: string[] = [];
  const completions: Array<{
    attemptId: string;
    status: "sent" | "failed";
    providerMessageId: string | null;
    errorCode: string | null;
  }> = [];
  const sends: Array<{ message: Record<string, unknown>; options?: { idempotencyKey: string } }> = [];

  const claimAttemptId = opts.claimAttemptId === undefined ? "attempt-1" : opts.claimAttemptId;
  const resendConfigured = opts.resendConfigured ?? true;
  const sendResult = opts.sendResult ?? { data: { id: "resend-message-id" }, error: null };

  const dependencies: FounderRequestNotifyDependencies = {
    readSettings: () =>
      Promise.resolve({
        data: opts.settings === undefined
          ? { platform_name: "SalsaSegura", support_email: "moderators@salsasegura.example" }
          : opts.settings,
        error: opts.settingsError ?? null,
      }),
    claimAttempt: (requestId: string) => {
      claims.push(requestId);
      return Promise.resolve({ attemptId: claimAttemptId, error: opts.claimError ?? null });
    },
    completeAttempt: (attempt) => {
      completions.push(attempt);
      return Promise.resolve({ error: null });
    },
    resend: resendConfigured
      ? {
          emails: {
            send: (message, options) => {
              sends.push({ message: message as unknown as Record<string, unknown>, options });
              if (opts.sendThrows) return Promise.reject(opts.sendThrows);
              return Promise.resolve(sendResult);
            },
          },
        }
      : null,
    from: "SalsaSegura <team@contact.salsasegura.com>",
    reviewUrlBase: opts.reviewUrlBase === undefined ? "https://salsasegura.example/admin/founder-requests/" : opts.reviewUrlBase,
    log: () => {},
  };

  return { dependencies, claims, completions, sends };
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

// --- Automatic admin notification ------------------------------------------

Deno.test("a fresh insert claims and sends exactly one admin notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);

  assertEquals(notify.claims, [INSERTED_ROW.id]);
  assertEquals(notify.sends.length, 1);
  assertEquals(notify.completions, [
    { attemptId: "attempt-1", status: "sent", providerMessageId: "resend-message-id", errorCode: null },
  ]);
});

Deno.test("the notification recipient is read server-side, never from the request body", async () => {
  const notify = makeNotify({
    settings: { platform_name: "SalsaSegura", support_email: "trusted-mods@salsasegura.example" },
  });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post({ ...validPayload, to: "attacker@evil.example", from: "attacker@evil.example" }));

  assertEquals(notify.sends.length, 1);
  assertEquals(notify.sends[0].message.to, "trusted-mods@salsasegura.example");
  // No client-suppliable field influenced the recipient, subject, or body.
  assertEquals(typeof notify.sends[0].message.subject, "string");
  assertExists(notify.sends[0].message.html);
});

Deno.test("the review link points at the canonical admin founder-request route", async () => {
  const notify = makeNotify({ reviewUrlBase: "https://salsasegura.example/admin/founder-requests/" });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  const html = notify.sends[0].message.html as string;
  assertEquals(
    html.includes(`https://salsasegura.example/admin/founder-requests/${INSERTED_ROW.id}`),
    true
  );
});

Deno.test("a duplicate request does not claim or send a notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService({ existing: { id: "existing-id" } });
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(notify.claims.length, 0);
  assertEquals(notify.sends.length, 0);
});

Deno.test("a concurrent-race duplicate does not claim or send a notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService({
    insertError: { code: "23505", message: "duplicate key value violates unique constraint" },
  });
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(notify.claims.length, 0);
  assertEquals(notify.sends.length, 0);
});

Deno.test("a honeypot submission does not claim or send a notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post({ ...validPayload, companyWebsite: "http://spam.bot" }));

  assertEquals(notify.claims.length, 0);
  assertEquals(notify.sends.length, 0);
});

Deno.test("an already-claimed/sent notification is not resent (dedup)", async () => {
  const notify = makeNotify({ claimAttemptId: null });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.claims, [INSERTED_ROW.id]);
  assertEquals(notify.sends.length, 0);
  assertEquals(notify.completions.length, 0);
});

Deno.test("a Resend failure does not fail the public submission, and is recorded", async () => {
  const notify = makeNotify({
    sendResult: { data: null, error: { name: "validation_error", message: "domain not verified" } },
  });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });

  assertEquals(notify.completions.length, 1);
  assertEquals(notify.completions[0].status, "failed");
  assertExists(notify.completions[0].errorCode);
});

Deno.test("a thrown Resend error does not fail the public submission", async () => {
  const notify = makeNotify({ sendThrows: new Error("network unreachable") });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.completions[0].status, "failed");
  assertEquals(notify.completions[0].errorCode, "network_error");
});

Deno.test("a missing recipient configuration does not fail the public submission", async () => {
  const notify = makeNotify({ settings: { platform_name: "SalsaSegura", support_email: "" } });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(notify.sends.length, 0);
  assertEquals(notify.completions[0].status, "failed");
  assertEquals(notify.completions[0].errorCode, "no_recipient");
});

Deno.test("an unreadable settings row does not fail the public submission", async () => {
  const notify = makeNotify({ settingsError: { code: "500", message: "connection refused" } });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.sends.length, 0);
  assertEquals(notify.completions[0].errorCode, "configuration_error");
});

Deno.test("a missing Resend configuration does not fail the public submission", async () => {
  const notify = makeNotify({ resendConfigured: false });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.sends.length, 0);
  assertEquals(notify.completions[0].errorCode, "configuration_error");
});

Deno.test("a claim-read failure does not fail the public submission", async () => {
  const notify = makeNotify({ claimError: { code: "500", message: "connection refused" } });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.sends.length, 0);
});

Deno.test("internal fields (reviewed_by, reviewed_at, rejection state) never reach the email", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  const html = notify.sends[0].message.html as string;
  for (const forbidden of ["reviewed_by", "reviewed_at", "rejection_reason", "rejection_message"]) {
    assertEquals(html.includes(forbidden), false);
  }
});

Deno.test("applicant-supplied HTML in name/organization is escaped in the notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(
    post({
      applicantName: '<img src=x onerror=alert(1)>',
      email: "attacker@example.com",
      organizationName: "<script>alert(2)</script>",
    })
  );

  const html = notify.sends[0].message.html as string;
  assertEquals(html.includes("<img"), false);
  assertEquals(html.includes("<script>"), false);
  assertEquals(html.includes("&lt;img"), true);
  assertEquals(html.includes("&lt;script&gt;"), true);
});

Deno.test("the notification reply-to is the applicant's own address", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(notify.sends[0].message.replyTo, "john@example.com");
});

Deno.test("the notification carries a per-request idempotency key", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(
    notify.sends[0].options?.idempotencyKey,
    `founder-request-${INSERTED_ROW.id}-admin_request_notification`
  );
});
