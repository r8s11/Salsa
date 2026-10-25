import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createSendFounderWelcomeEmailHandler,
  type SendFounderWelcomeEmailDependencies,
} from "./index.ts";

type SentMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

type Completion = { authorization: string; status: "sent" | "failed"; errorCode: string | null };

type Harness = {
  handler: (request: Request) => Promise<Response>;
  sent: SentMessage[];
  completions: Completion[];
  claimCalls: number;
};

function harness(
  overrides: Partial<SendFounderWelcomeEmailDependencies> & {
    claimResult?: { claimed: boolean; organizerId?: string; organizationName?: string; recipientEmail?: string };
    claimError?: { code?: string };
    authError?: { message?: string } | null;
    sendResult?: { data: { id?: string } | null; error: { message?: string; name?: string } | null };
    sendThrows?: Error;
  } = {}
): Harness {
  const sent: SentMessage[] = [];
  const completions: Completion[] = [];
  let claimCalls = 0;
  let claimed = false;

  const claimResult = overrides.claimResult ?? {
    claimed: true,
    organizerId: "org-1",
    organizationName: "Riverside Salsa Co",
    recipientEmail: "founder@example.com",
  };

  const dependencies: SendFounderWelcomeEmailDependencies = {
    authenticateCaller: () => Promise.resolve({ error: overrides.authError ?? null }),

    claim: (authorization) => {
      claimCalls += 1;
      if (overrides.claimError) {
        return Promise.resolve({ data: null, error: overrides.claimError });
      }
      // Simulate the DB's own one-time-claim semantics for the harness's
      // default fixture: the SECOND call within one test never re-claims.
      if (claimed && overrides.claimResult === undefined) {
        return Promise.resolve({ data: { claimed: false }, error: null });
      }
      claimed = true;
      void authorization;
      return Promise.resolve({ data: claimResult, error: null });
    },

    complete: (authorization, status, errorCode) => {
      completions.push({ authorization, status, errorCode });
      return Promise.resolve({ data: true, error: null });
    },

    resend: {
      emails: {
        send: (message, options) => {
          if (overrides.sendThrows) throw overrides.sendThrows;
          sent.push({ ...message, idempotencyKey: options?.idempotencyKey });
          return Promise.resolve(
            overrides.sendResult ?? { data: { id: `resend-${sent.length}` }, error: null }
          );
        },
      },
    },

    from: "Salsa Segura Team <team@contact.salsasegura.com>",
    platformName: "Salsa Segura",
    supportEmail: "info@salsasegura.com",
    hostDashboardUrl: "https://www.salsasegura.com/host",
    log: () => {},

    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([key]) => !["claimResult", "claimError", "authError", "sendResult", "sendThrows"].includes(key)
      )
    ),
  };

  return {
    handler: createSendFounderWelcomeEmailHandler(dependencies),
    sent,
    completions,
    get claimCalls() {
      return claimCalls;
    },
  };
}

function request(body: unknown = {}, options: { method?: string; authorization?: string | null } = {}): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.authorization !== null) headers.authorization = options.authorization ?? "Bearer founder-token";
  return new Request("http://localhost/send-founder-welcome-email", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" ? undefined : JSON.stringify(body),
  });
}

// ── Transport ────────────────────────────────────────────────────────────

Deno.test("rejects a non-POST request", async () => {
  const { handler } = harness();
  const response = await handler(request({}, { method: "GET" }));
  assertEquals(response.status, 405);
});

Deno.test("rejects a request with no bearer token", async () => {
  const { handler, sent } = harness();
  const response = await handler(request({}, { authorization: null }));
  assertEquals(response.status, 401);
  assertEquals(sent.length, 0);
});

Deno.test("rejects a malformed authorization header", async () => {
  const { handler } = harness();
  const response = await handler(request({}, { authorization: "not-a-bearer-token" }));
  assertEquals(response.status, 401);
});

Deno.test("rejects when auth.getUser() fails", async () => {
  const { handler, sent } = harness({ authError: { message: "invalid token" } });
  const response = await handler(request());
  assertEquals(response.status, 401);
  assertEquals(sent.length, 0);
});

// ── ANTI-RELAY INVARIANT ────────────────────────────────────────────────

Deno.test("ignores every field in the request body — there is no recipient/subject/html parameter", async () => {
  const { handler, sent } = harness();
  const response = await handler(
    request({
      to: "attacker@evil.example.com",
      from: "spoofed@evil.example.com",
      subject: "Free crypto",
      html: "<p>spam</p>",
      organizerId: "org-attacker-supplied",
    })
  );

  assertEquals(response.status, 200);
  assertEquals(sent.length, 1);
  // The claim's own recipient/org, not the body's.
  assertEquals(sent[0].to, "founder@example.com");
  assertEquals(sent[0].from, "Salsa Segura Team <team@contact.salsasegura.com>");
  assertEquals(sent[0].html.includes("Free crypto"), false);
  assertEquals(sent[0].html.includes("spam"), false);
  assertEquals(sent[0].html.includes("org-attacker-supplied"), false);
});

Deno.test("works identically with an empty or missing body", async () => {
  const { handler, sent } = harness();
  const response = await handler(
    new Request("http://localhost/send-founder-welcome-email", {
      method: "POST",
      headers: { authorization: "Bearer founder-token" },
    })
  );
  assertEquals(response.status, 200);
  assertEquals(sent.length, 1);
});

// ── Idempotency: claim before send ─────────────────────────────────────────

Deno.test("claims before calling the provider", async () => {
  const order: string[] = [];
  const { handler } = harness({
    claim: () => {
      order.push("claim");
      return Promise.resolve({
        data: { claimed: true, organizerId: "org-1", organizationName: "Co", recipientEmail: "f@example.com" },
        error: null,
      });
    },
    complete: () => {
      order.push("complete");
      return Promise.resolve({ data: true, error: null });
    },
    resend: {
      emails: {
        send: () => {
          order.push("send");
          return Promise.resolve({ data: { id: "resend-1" }, error: null });
        },
      },
    },
  });
  await handler(request());
  assertEquals(order, ["claim", "send", "complete"]);
});

Deno.test("a second call after a successful send is deduplicated and sends nothing", async () => {
  const h = harness();
  const first = await h.handler(request());
  const second = await h.handler(request());

  assertEquals(first.status, 200);
  assertEquals(second.status, 200);
  assertEquals(await second.json(), { success: true, deduplicated: true });
  assertEquals(h.sent.length, 1);
  assertEquals(h.claimCalls, 2);
});

Deno.test("claimed:false (not yet provisioned) sends nothing", async () => {
  const { handler, sent } = harness({ claimResult: { claimed: false } });
  const response = await handler(request());
  assertEquals(response.status, 200);
  assertEquals(await response.json(), { success: true, deduplicated: true });
  assertEquals(sent.length, 0);
});

Deno.test("passes a deterministic per-organizer provider idempotency key", async () => {
  const { handler, sent } = harness({
    claimResult: { claimed: true, organizerId: "org-xyz", organizationName: "Co", recipientEmail: "f@example.com" },
  });
  await handler(request());
  assertEquals(sent[0].idempotencyKey, "founder-welcome-org-xyz");
});

// ── Failure handling ────────────────────────────────────────────────────

Deno.test("returns 503 when the claim RPC itself fails", async () => {
  const { handler, sent } = harness({ claimError: { code: "57014" } });
  const response = await handler(request());
  assertEquals(response.status, 503);
  assertEquals(sent.length, 0);
});

Deno.test("records a failed completion and returns 502 when Resend errors", async () => {
  const { handler, completions } = harness({
    sendResult: { data: null, error: { message: "rate limit exceeded", name: "rate_limit" } },
  });
  const response = await handler(request());
  assertEquals(response.status, 502);
  assertEquals(completions.length, 1);
  assertEquals(completions[0].status, "failed");
  assertEquals(completions[0].errorCode, "rate_limited");
});

Deno.test("records a failed completion when the provider call throws", async () => {
  const { handler, completions } = harness({ sendThrows: new Error("network timeout") });
  const response = await handler(request());
  assertEquals(response.status, 502);
  assertEquals(completions[0].status, "failed");
  assertEquals(completions[0].errorCode, "network_error");
});

Deno.test("a failed send never leaks the raw provider message", async () => {
  const { handler } = harness({
    sendResult: { data: null, error: { message: "API key re_live_secret is invalid" } },
  });
  const response = await handler(request());
  const text = await response.text();
  assertEquals(text.includes("re_live_secret"), false);
});

Deno.test("skips with no_recipient when the claim has no usable email", async () => {
  const { handler, sent, completions } = harness({
    claimResult: { claimed: true, organizerId: "org-1", organizationName: "Co", recipientEmail: undefined },
  });
  const response = await handler(request());
  assertEquals(sent.length, 0);
  assertEquals(completions[0].status, "failed");
  assertEquals(completions[0].errorCode, "no_recipient");
  assertEquals((await response.json()).skipped, "no_recipient");
});

Deno.test("reports success even when the completion write fails after a real send", async () => {
  const { handler, sent } = harness({
    complete: () => Promise.resolve({ data: null, error: { code: "08006" } }),
  });
  const response = await handler(request());
  assertEquals(response.status, 200);
  assertEquals(sent.length, 1);
});

// ── Content correctness ─────────────────────────────────────────────────

Deno.test("subject, body, and CTA reflect the platform + claimed organization", async () => {
  const { handler, sent } = harness({
    claimResult: {
      claimed: true,
      organizerId: "org-1",
      organizationName: "Riverside Salsa Co",
      recipientEmail: "founder@example.com",
    },
  });
  await handler(request());

  assertStringIncludes(sent[0].subject, "Salsa Segura Host access is ready");
  assertStringIncludes(sent[0].html, "Riverside Salsa Co");
  assertStringIncludes(sent[0].html, "https://www.salsasegura.com/host");
  assertStringIncludes(sent[0].html, "Go to Host Dashboard");
  assertStringIncludes(sent[0].text, "https://www.salsasegura.com/host");
});

Deno.test("never includes a token, token hash, or acceptance URL anywhere in the email", async () => {
  const { handler, sent } = harness();
  await handler(request());
  for (const field of [sent[0].html, sent[0].text, sent[0].subject]) {
    assertEquals(/[0-9a-f]{64}/.test(field), false);
    assertEquals(field.toLowerCase().includes("token"), false);
    assertEquals(field.includes("/founders/accept"), false);
    assertEquals(field.includes("?code="), false);
  }
});

Deno.test("the Host Dashboard link carries no query parameters", async () => {
  const { handler, sent } = harness();
  await handler(request());
  const match = /href="([^"]+)"/.exec(sent[0].html);
  assertEquals(match !== null, true);
  assertEquals(match![1].includes("?"), false);
});

Deno.test("escapes HTML in a hostile organization name", async () => {
  const { handler, sent } = harness({
    claimResult: {
      claimed: true,
      organizerId: "org-1",
      organizationName: '<script>alert("xss")</script>',
      recipientEmail: "founder@example.com",
    },
  });
  await handler(request());
  assertEquals(sent[0].html.includes("<script>"), false);
  assertStringIncludes(sent[0].html, "&lt;script&gt;");
});
