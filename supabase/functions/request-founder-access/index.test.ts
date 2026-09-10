import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { createRequestFounderAccessHandler } from "./index.ts";
import type { FounderAccessDependencies, FounderRequestNotifyDependencies } from "./index.ts";

const INSERTED_ROW = {
  id: "new-request-id",
  created_at: "2026-09-04T12:00:00.000Z",
  normalized_email: "john@example.com",
  applicant_name: "John Doe",
  organization_name: "Salsa Nights Boston",
};

// Test seam: records every insert and returns configurable select/insert results.
function makeService(opts: {
  existing?: { id: string } | null;
  insertError?: { code?: string; message?: string } | null;
  insertedRow?: {
    id: string;
    created_at: string;
    normalized_email: string;
    applicant_name: string;
    organization_name: string;
  } | null;
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
interface NotifySeam {
  dependencies: FounderRequestNotifyDependencies;
  claims: Array<{ requestId: string; emailEvent: string }>;
  completions: Array<{
    attemptId: string;
    requestId: string;
    emailEvent: string;
    status: "sent" | "failed";
    providerMessageId: string | null;
    errorCode: string | null;
  }>;
  sends: Array<{ message: Record<string, unknown>; options?: { idempotencyKey: string } }>;
}


// Test seam for both notification paths (admin + applicant): records every
// claim/complete/send call so tests can assert exactly what was attempted,
// per (requestId, emailEvent).
function makeNotify(opts: {
  settings?: { platform_name: string; support_email: string } | null;
  settingsError?: { code?: string; message?: string } | null;
  claimAttemptId?: string | null;
  claimError?: { code?: string; message?: string } | null;
  resendConfigured?: boolean;
  sendResult?: { data: { id?: string } | null; error: { message?: string; name?: string } | null };
  sendThrows?: unknown;
  reviewUrlBase?: string | null;
} = {}): NotifySeam {
  const claims: Array<{ requestId: string; emailEvent: string }> = [];
  const completions: Array<{
    attemptId: string;
    requestId: string;
    emailEvent: string;
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
    claimAttempt: (requestId, emailEvent) => {
      claims.push({ requestId, emailEvent });
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

// --- Automatic notifications (admin + applicant confirmation) -------------

function sendsFor(notify: NotifySeam, marker: string) {
  return notify.sends.filter((s) => (s.options?.idempotencyKey ?? "").includes(marker));
}
function claimsFor(notify: NotifySeam, emailEvent: string) {
  return notify.claims.filter((c) => c.emailEvent === emailEvent);
}
function completionsFor(notify: NotifySeam, emailEvent: string) {
  return notify.completions.filter((c) => c.emailEvent === emailEvent);
}

Deno.test("the admin notification recipient is read server-side, never from the request body", async () => {
  const notify = makeNotify({
    settings: { platform_name: "SalsaSegura", support_email: "trusted-mods@salsasegura.example" },
  });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post({
    ...validPayload,
    to: "attacker@evil.example",
    recipient: "attacker@evil.example",
    from: "attacker@evil.example",
    subject: "UNTRUSTED_SUBJECT",
    html: "<b>UNTRUSTED_BODY</b>",
    text: "UNTRUSTED_BODY",
    reviewed_by: "UNTRUSTED_REVIEWER",
    rejection_message: "UNTRUSTED_REJECTION",
  }));

  const adminSends = sendsFor(notify, "admin_request_notification");
  assertEquals(adminSends.length, 1);
  assertEquals(adminSends[0].message.to, "trusted-mods@salsasegura.example");
  for (const send of notify.sends) {
    assertEquals(send.message.from, "SalsaSegura <team@contact.salsasegura.com>");
    assertEquals(send.message.to === "attacker@evil.example", false);
    assertEquals(JSON.stringify(send.message).includes("UNTRUSTED_"), false);
  }
});

Deno.test("the applicant confirmation recipient is the persisted row's normalized_email, not the raw request body", async () => {
  // The persisted row disagrees with the raw request body's email — proves
  // the confirmation recipient is sourced from the DB row, not re-derived
  // from client input.
  const { dependencies } = makeService({
    insertedRow: { ...INSERTED_ROW, normalized_email: "persisted-only@salsasegura.example" },
  });
  const notify = makeNotify();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  const applicantSends = sendsFor(notify, "founder-request-confirmation");
  assertEquals(applicantSends.length, 1);
  assertEquals(applicantSends[0].message.to, "persisted-only@salsasegura.example");
  assertEquals(applicantSends[0].message.to !== validPayload.email, true);
});

Deno.test("the applicant confirmation copy is built from the persisted applicant_name/organization_name", async () => {
  const { dependencies } = makeService({
    insertedRow: {
      ...INSERTED_ROW,
      applicant_name: "Persisted Name",
      organization_name: "Persisted Org",
    },
  });
  const notify = makeNotify();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  const applicantSends = sendsFor(notify, "founder-request-confirmation");
  const html = applicantSends[0].message.html as string;
  assertEquals(html.includes("Persisted Name"), true);
  assertEquals(html.includes("Persisted Org"), true);
});

Deno.test("the review link points at the canonical admin founder-request route", async () => {
  const notify = makeNotify({ reviewUrlBase: "https://salsasegura.example/admin/founder-requests/" });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  const adminHtml = sendsFor(notify, "admin_request_notification")[0].message.html as string;
  assertEquals(
    adminHtml.includes(`https://salsasegura.example/admin/founder-requests/${INSERTED_ROW.id}`),
    true
  );
});

Deno.test("the applicant confirmation carries no admin URL, review link, or token", async () => {
  const notify = makeNotify({ reviewUrlBase: "https://salsasegura.example/admin/founder-requests/" });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  const applicantHtml = sendsFor(notify, "founder-request-confirmation")[0].message.html as string;
  for (const forbidden of ["/admin/founder-requests/", "http://", "https://", "token"]) {
    assertEquals(applicantHtml.toLowerCase().includes(forbidden.toLowerCase()), false);
  }
});

Deno.test("a duplicate request does not claim or send either notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService({ existing: { id: "existing-id" } });
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(notify.claims.length, 0);
  assertEquals(notify.sends.length, 0);
});

Deno.test("a concurrent-race duplicate does not claim or send either notification", async () => {
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

Deno.test("a honeypot submission does not claim or send either notification", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post({ ...validPayload, companyWebsite: "http://spam.bot" }));

  assertEquals(notify.claims.length, 0);
  assertEquals(notify.sends.length, 0);
});

Deno.test("an already-claimed/sent notification is not resent for either event (dedup)", async () => {
  const notify = makeNotify({ claimAttemptId: null });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(claimsFor(notify, "admin_request_notification").length, 1);
  assertEquals(claimsFor(notify, "applicant_confirmation").length, 1);
  assertEquals(notify.sends.length, 0);
  assertEquals(notify.completions.length, 0);
});

for (const adminSucceeds of [true, false]) {
  for (const applicantSucceeds of [true, false]) {
    Deno.test(`independent delivery: admin=${adminSucceeds}, applicant=${applicantSucceeds}`, async () => {
      const notify = makeNotify();
      notify.dependencies.resend = {
        emails: {
          send: (message, options) => {
            notify.sends.push({ message, options });
            const isAdmin = options?.idempotencyKey.includes("admin_request_notification");
            return Promise.resolve((isAdmin ? adminSucceeds : applicantSucceeds)
              ? { data: { id: isAdmin ? "admin-provider-id" : "applicant-provider-id" }, error: null }
              : { data: null, error: { name: "application_error", message: "private provider details" } });
          },
        },
      };
      const { dependencies, inserts } = makeService();
      dependencies.notify = notify.dependencies;
      const res = await createRequestFounderAccessHandler(dependencies)(post(validPayload));
      assertEquals(res.status, 200);
      assertEquals(await res.json(), { success: true });
      assertEquals(inserts.length, 1);
      assertEquals(inserts[0].status, "pending");
      assertEquals(notify.sends.length, 2);
      for (const [event, succeeded, providerId] of [
        ["admin_request_notification", adminSucceeds, "admin-provider-id"],
        ["applicant_confirmation", applicantSucceeds, "applicant-provider-id"],
      ] as const) {
        const completions = completionsFor(notify, event);
        assertEquals(completions.length, 1);
        assertEquals(completions[0].status, succeeded ? "sent" : "failed");
        assertEquals(completions[0].providerMessageId, succeeded ? providerId : null);
        assertEquals(completions[0].errorCode, succeeded ? null : "provider_error");
      }
    });
  }
}

Deno.test("a thrown Resend error does not fail the public submission (either event)", async () => {
  const notify = makeNotify({ sendThrows: new Error("network unreachable") });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(completionsFor(notify, "admin_request_notification")[0].status, "failed");
  assertEquals(completionsFor(notify, "admin_request_notification")[0].errorCode, "network_error");
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].status, "failed");
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].errorCode, "network_error");
});

Deno.test("a missing admin recipient configuration does not fail the public submission", async () => {
  const notify = makeNotify({ settings: { platform_name: "SalsaSegura", support_email: "" } });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(sendsFor(notify, "admin_request_notification").length, 0);
  assertEquals(completionsFor(notify, "admin_request_notification")[0].status, "failed");
  assertEquals(completionsFor(notify, "admin_request_notification")[0].errorCode, "no_recipient");
  // The applicant confirmation is independent — a bad admin recipient
  // never prevents it from sending.
  assertEquals(sendsFor(notify, "founder-request-confirmation").length, 1);
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].status, "sent");
});

Deno.test("an invalid/unpersisted applicant recipient does not fail the public submission or block the admin notification", async () => {
  const { dependencies } = makeService({ insertedRow: { ...INSERTED_ROW, normalized_email: "" } });
  const notify = makeNotify();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(sendsFor(notify, "founder-request-confirmation").length, 0);
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].status, "failed");
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].errorCode, "no_recipient");
  assertEquals(completionsFor(notify, "admin_request_notification")[0].status, "sent");
});

Deno.test("an unreadable settings row does not fail the public submission, and does not block the applicant confirmation", async () => {
  const notify = makeNotify({ settingsError: { code: "500", message: "connection refused" } });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(sendsFor(notify, "admin_request_notification").length, 0);
  assertEquals(completionsFor(notify, "admin_request_notification")[0].errorCode, "configuration_error");
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].status, "sent");
});

Deno.test("a missing Resend configuration fails both notifications with configuration_error", async () => {
  const notify = makeNotify({ resendConfigured: false });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.sends.length, 0);
  assertEquals(completionsFor(notify, "admin_request_notification")[0].errorCode, "configuration_error");
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].errorCode, "configuration_error");
});

Deno.test("a claim-read failure does not fail the public submission (either event)", async () => {
  const notify = makeNotify({ claimError: { code: "500", message: "connection refused" } });
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(notify.sends.length, 0);
});

Deno.test("a thrown admin-claim error is caught and never prevents the applicant confirmation from running", async () => {
  const notify = makeNotify();
  let adminClaimed = false;
  const wrapped: FounderRequestNotifyDependencies = {
    ...notify.dependencies,
    claimAttempt: (requestId, emailEvent) => {
      if (emailEvent === "admin_request_notification" && !adminClaimed) {
        adminClaimed = true;
        throw new Error("boom");
      }
      return notify.dependencies.claimAttempt(requestId, emailEvent);
    },
  };
  const { dependencies } = makeService();
  dependencies.notify = wrapped;
  const handler = createRequestFounderAccessHandler(dependencies);

  const res = await handler(post(validPayload));
  assertEquals(res.status, 200);
  assertEquals(await res.json(), { success: true });
  assertEquals(sendsFor(notify, "founder-request-confirmation").length, 1);
  assertEquals(completionsFor(notify, "applicant_confirmation")[0].status, "sent");
});

Deno.test("applicant-supplied HTML in name/organization is escaped in both notifications", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService({
    insertedRow: {
      ...INSERTED_ROW,
      applicant_name: "<img src=x onerror=alert(1)>",
      organization_name: "<script>alert(2)</script>",
    },
  });
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(
    post({
      applicantName: "<img src=x onerror=alert(1)>",
      email: "attacker@example.com",
      organizationName: "<script>alert(2)</script>",
    })
  );

  for (const send of notify.sends) {
    const html = send.message.html as string;
    assertEquals(html.includes("<img"), false);
    assertEquals(html.includes("<script>"), false);
    assertEquals(html.includes("&lt;img"), true);
    assertEquals(html.includes("&lt;script&gt;"), true);
  }
});

Deno.test("the admin notification reply-to is the applicant's own address", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(sendsFor(notify, "admin_request_notification")[0].message.replyTo, "john@example.com");
});

Deno.test("the applicant confirmation has no reply-to override", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(sendsFor(notify, "founder-request-confirmation")[0].message.replyTo, undefined);
});

Deno.test("the admin notification carries a per-request idempotency key", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(
    sendsFor(notify, "admin_request_notification")[0].options?.idempotencyKey,
    `founder-request-${INSERTED_ROW.id}-admin_request_notification`
  );
});

Deno.test("the applicant confirmation carries a stable per-request idempotency key", async () => {
  const notify = makeNotify();
  const { dependencies } = makeService();
  dependencies.notify = notify.dependencies;
  const handler = createRequestFounderAccessHandler(dependencies);

  await handler(post(validPayload));

  assertEquals(
    sendsFor(notify, "founder-request-confirmation")[0].options?.idempotencyKey,
    `founder-request-confirmation:${INSERTED_ROW.id}`
  );
});
