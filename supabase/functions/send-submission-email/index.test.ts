import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createSendSubmissionEmailHandler,
  type SendSubmissionEmailDependencies,
  type SubmissionEmailEvent,
} from "./index.ts";

const SUBMISSION_ID = "3f1c8d9e-4b2a-4c7d-9e8f-1a2b3c4d5e6f";
const NOW = Date.parse("2026-09-01T12:00:00.000Z");
const FRESH = "2026-09-01T11:58:00.000Z";
const STALE = "2026-09-01T11:00:00.000Z";

type SentMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  idempotencyKey?: string;
};

type Completion = {
  attemptId: string;
  status: "sent" | "failed";
  providerMessageId: string | null;
  errorCode: string | null;
};

type Claim = {
  submissionId: string;
  emailEvent: SubmissionEmailEvent;
  recipientKind: "submitter" | "moderator";
};

type Harness = {
  handler: (request: Request) => Promise<Response>;
  sent: SentMessage[];
  claims: Claim[];
  completions: Completion[];
  /** Simulates the DB unique index: one live claim/success per (id, event). */
  activeClaims: Set<string>;
};

function submissionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: SUBMISSION_ID,
    status: "pending",
    submitter_email: "submitter@example.com",
    submitter_name: "Anon Dancer",
    submitted_data: {
      title: "Salsa Social at The Anchor",
      event_date: "2026-09-06T23:30:00.000Z",
      event_time: "19:30",
      city: "boston",
      location: "The Anchor",
    },
    edited_data: null,
    rejection_message: null,
    approved_event_id: null,
    submitted_at: FRESH,
    ...overrides,
  };
}

function harness(
  overrides: Partial<SendSubmissionEmailDependencies> & {
    row?: Record<string, unknown> | null;
    settings?: Record<string, unknown> | null;
    role?: string | null;
    sendResult?: { data: { id?: string } | null; error: { message?: string; name?: string } | null };
    sendThrows?: Error;
  } = {}
): Harness {
  const sent: SentMessage[] = [];
  const claims: Claim[] = [];
  const completions: Completion[] = [];
  const activeClaims = new Set<string>();

  const row = overrides.row === undefined ? submissionRow() : overrides.row;
  const settings =
    overrides.settings === undefined
      ? {
          platform_name: "SalsaSegura",
          public_site_url: "https://www.salsasegura.com",
          support_email: "info@salsasegura.com",
        }
      : overrides.settings;

  const dependencies: SendSubmissionEmailDependencies = {
    readSubmission: () => Promise.resolve({ data: row as never, error: null }),
    readSettings: () => Promise.resolve({ data: settings as never, error: null }),

    claimAttempt: (submissionId, emailEvent, recipientKind) => {
      claims.push({ submissionId, emailEvent, recipientKind });
      const key = `${submissionId}:${emailEvent}`;
      if (activeClaims.has(key)) return Promise.resolve({ attemptId: null, error: null });
      activeClaims.add(key);
      return Promise.resolve({ attemptId: `attempt-${claims.length}`, error: null });
    },

    completeAttempt: (attempt) => {
      completions.push(attempt);
      // A failed attempt drops out of the unique index, mirroring the partial
      // index's `where status in ('pending','sent')`.
      if (attempt.status === "failed") {
        for (const key of activeClaims) {
          if (key.startsWith(SUBMISSION_ID)) activeClaims.delete(key);
        }
      }
      return Promise.resolve({ error: null });
    },

    authenticateCaller: () =>
      Promise.resolve({
        data: {
          user:
            overrides.role === null
              ? null
              : { id: "caller-id", app_metadata: { role: overrides.role ?? "admin" } },
        },
        error: null,
      }),

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
    now: () => NOW,
    log: () => {},
    ...Object.fromEntries(
      Object.entries(overrides).filter(
        ([key]) =>
          !["row", "settings", "role", "sendResult", "sendThrows"].includes(key)
      )
    ),
  };

  return {
    handler: createSendSubmissionEmailHandler(dependencies),
    sent,
    claims,
    completions,
    activeClaims,
  };
}

function request(
  body: unknown,
  options: { method?: string; authorization?: string | null } = {}
): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (options.authorization !== null) {
    headers.authorization = options.authorization ?? "Bearer caller-token";
  }
  return new Request("http://localhost/send-submission-email", {
    method: options.method ?? "POST",
    headers,
    body: options.method === "GET" ? undefined : JSON.stringify(body),
  });
}

// ── Transport & request validation ─────────────────────────────────────────

Deno.test("answers the CORS preflight with 204", async () => {
  const { handler } = harness();
  const response = await handler(
    new Request("http://localhost/send-submission-email", { method: "OPTIONS" })
  );
  assertEquals(response.status, 204);
  assertEquals(response.headers.get("Access-Control-Allow-Origin"), "*");
});

Deno.test("rejects a non-POST request", async () => {
  const { handler } = harness();
  const response = await handler(request({}, { method: "GET" }));
  assertEquals(response.status, 405);
});

Deno.test("rejects malformed JSON", async () => {
  const { handler } = harness();
  const response = await handler(
    new Request("http://localhost/send-submission-email", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{not json",
    })
  );
  assertEquals(response.status, 400);
});

Deno.test("rejects an oversized body before parsing", async () => {
  const { handler } = harness();
  const response = await handler(
    new Request("http://localhost/send-submission-email", {
      method: "POST",
      headers: { "content-type": "application/json", "content-length": "999999" },
      body: JSON.stringify({ submissionId: SUBMISSION_ID, event: "received" }),
    })
  );
  assertEquals(response.status, 413);
});

Deno.test("rejects a non-UUID submissionId", async () => {
  const { handler, sent } = harness();
  const response = await handler(request({ submissionId: "not-a-uuid", event: "received" }));
  assertEquals(response.status, 400);
  assertEquals(sent.length, 0);
});

Deno.test("rejects an unknown event name", async () => {
  const { handler, sent } = harness();
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "whatever" }));
  assertEquals(response.status, 400);
  assertEquals(sent.length, 0);
});

// ── THE ANTI-RELAY INVARIANT ───────────────────────────────────────────────

Deno.test("ignores a caller-supplied recipient — the address comes from the row", async () => {
  const { handler, sent } = harness();
  const response = await handler(
    request({
      submissionId: SUBMISSION_ID,
      event: "received",
      // Everything below is an attempt to hijack the send. All ignored.
      to: "attacker@evil.example.com",
      from: "spoofed@evil.example.com",
      replyTo: "attacker@evil.example.com",
      subject: "Free crypto",
      html: "<p>spam</p>",
      recipient: "attacker@evil.example.com",
    })
  );

  assertEquals(response.status, 200);
  assertEquals(sent.length, 1);
  // The row's address, not the body's.
  assertEquals(sent[0].to, "submitter@example.com");
  // The env-configured sender, not the body's.
  assertEquals(sent[0].from, "Salsa Segura Team <team@contact.salsasegura.com>");
  assertStringIncludes(sent[0].subject, "We received your event");
  assertEquals(sent[0].html.includes("Free crypto"), false);
  assertEquals(sent[0].html.includes("spam"), false);
});

Deno.test("moderator notification goes to platform support_email, never a caller value", async () => {
  const { handler, sent } = harness();
  await handler(
    request({
      submissionId: SUBMISSION_ID,
      event: "awaiting_review",
      to: "attacker@evil.example.com",
    })
  );

  assertEquals(sent.length, 1);
  assertEquals(sent[0].to, "info@salsasegura.com");
});

// ── Authorization ──────────────────────────────────────────────────────────

Deno.test("anonymous caller may trigger received/awaiting_review", async () => {
  for (const event of ["received", "awaiting_review"] as const) {
    const { handler, sent } = harness();
    const response = await handler(
      request({ submissionId: SUBMISSION_ID, event }, { authorization: null })
    );
    assertEquals(response.status, 200);
    assertEquals(sent.length, 1);
  }
});

Deno.test("approved/rejected require a bearer token", async () => {
  for (const event of ["approved", "rejected"] as const) {
    const { handler, sent } = harness({
      row: submissionRow({ status: event === "approved" ? "approved" : "rejected" }),
    });
    const response = await handler(
      request({ submissionId: SUBMISSION_ID, event }, { authorization: null })
    );
    assertEquals(response.status, 401);
    assertEquals(sent.length, 0);
  }
});

Deno.test("approved/rejected reject a regular authenticated user", async () => {
  const { handler, sent } = harness({
    row: submissionRow({ status: "approved" }),
    role: "user",
  });
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));
  assertEquals(response.status, 403);
  assertEquals(sent.length, 0);
});

Deno.test("approved/rejected reject an organizer", async () => {
  const { handler, sent } = harness({
    row: submissionRow({ status: "rejected" }),
    role: "organizer",
  });
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "rejected" }));
  assertEquals(response.status, 403);
  assertEquals(sent.length, 0);
});

Deno.test("approved/rejected accept a moderator as well as an admin", async () => {
  for (const role of ["admin", "moderator"]) {
    const { handler, sent } = harness({ row: submissionRow({ status: "approved" }), role });
    const response = await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));
    assertEquals(response.status, 200);
    assertEquals(sent.length, 1);
  }
});

Deno.test("approved/rejected reject a null user with a well-formed token", async () => {
  const { handler, sent } = harness({ row: submissionRow({ status: "approved" }), role: null });
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));
  assertEquals(response.status, 401);
  assertEquals(sent.length, 0);
});

// ── State gating ───────────────────────────────────────────────────────────

Deno.test("returns 404 for a submission that does not exist", async () => {
  const { handler, sent } = harness({ row: null });
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "received" }));
  assertEquals(response.status, 404);
  assertEquals(sent.length, 0);
});

Deno.test("refuses received/awaiting_review for a non-pending submission", async () => {
  const { handler, sent } = harness({ row: submissionRow({ status: "approved" }) });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(response.status, 409);
  assertEquals(sent.length, 0);
});

Deno.test("refuses received/awaiting_review outside the freshness window", async () => {
  // Bounds replay of an old submission id by an anonymous caller.
  const { handler, sent } = harness({ row: submissionRow({ submitted_at: STALE }) });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(response.status, 409);
  assertEquals(sent.length, 0);
});

Deno.test("refuses to claim a submission is approved when the row says otherwise", async () => {
  // The email can never assert an outcome the database disagrees with.
  const { handler, sent } = harness({ row: submissionRow({ status: "pending" }) });
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));
  assertEquals(response.status, 409);
  assertEquals(sent.length, 0);
});

Deno.test("refuses to claim a submission is rejected when the row says otherwise", async () => {
  const { handler, sent } = harness({ row: submissionRow({ status: "approved" }) });
  const response = await handler(request({ submissionId: SUBMISSION_ID, event: "rejected" }));
  assertEquals(response.status, 409);
  assertEquals(sent.length, 0);
});

Deno.test("refuses a submission with no usable title", async () => {
  const { handler, sent } = harness({ row: submissionRow({ submitted_data: { title: "   " } }) });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(response.status, 422);
  assertEquals(sent.length, 0);
});

// ── Idempotency: claim BEFORE send ─────────────────────────────────────────

Deno.test("claims the attempt before calling the provider", async () => {
  // Ordering is the whole point: a read-then-send check would let two
  // concurrent callers both email.
  const order: string[] = [];
  const { handler } = harness({
    claimAttempt: () => {
      order.push("claim");
      return Promise.resolve({ attemptId: "attempt-1", error: null });
    },
    completeAttempt: () => {
      order.push("complete");
      return Promise.resolve({ error: null });
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

  await handler(request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null }));
  assertEquals(order, ["claim", "send", "complete"]);
});

Deno.test("a second call for the same (submission, event) sends nothing", async () => {
  const h = harness();
  const first = await h.handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  const second = await h.handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );

  assertEquals(first.status, 200);
  assertEquals(second.status, 200);
  assertEquals(await second.json(), {
    success: true,
    deduplicated: true,
    event: "received",
  });
  // Exactly one provider call across both requests.
  assertEquals(h.sent.length, 1);
});

Deno.test("concurrent duplicate calls produce exactly one email", async () => {
  const h = harness();
  const responses = await Promise.all([
    h.handler(request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })),
    h.handler(request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })),
    h.handler(request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })),
  ]);

  for (const response of responses) assertEquals(response.status, 200);
  assertEquals(h.sent.length, 1);
});

Deno.test("passes a deterministic provider idempotency key", async () => {
  // Covers the one gap the DB claim cannot: a crash after the provider
  // accepted the message but before the claim was closed.
  const { handler, sent } = harness();
  await handler(request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null }));
  assertEquals(sent[0].idempotencyKey, `submission-${SUBMISSION_ID}-received`);
});

Deno.test("different events for the same submission are not deduplicated against each other", async () => {
  const h = harness();
  await h.handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  await h.handler(
    request({ submissionId: SUBMISSION_ID, event: "awaiting_review" }, { authorization: null })
  );
  assertEquals(h.sent.length, 2);
});

// ── Failure handling: database state is never rolled back ──────────────────

Deno.test("records a failed attempt and returns 502 when the provider errors", async () => {
  const { handler, completions } = harness({
    sendResult: { data: null, error: { message: "rate limit exceeded", name: "rate_limit" } },
  });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );

  assertEquals(response.status, 502);
  assertEquals(completions.length, 1);
  assertEquals(completions[0].status, "failed");
  assertEquals(completions[0].errorCode, "rate_limited");
});

Deno.test("records a failed attempt when the provider call throws", async () => {
  const { handler, completions } = harness({ sendThrows: new Error("network timeout") });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );

  assertEquals(response.status, 502);
  assertEquals(completions[0].status, "failed");
  assertEquals(completions[0].errorCode, "network_error");
});

Deno.test("a failed send never leaks the raw provider message", async () => {
  const { handler } = harness({
    sendResult: { data: null, error: { message: "API key re_live_secret is invalid" } },
  });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  const text = await response.text();
  assertEquals(text.includes("re_live_secret"), false);
  assertEquals(text.includes("API key"), false);
});

Deno.test("a failed attempt is retryable — it drops out of the dedup index", async () => {
  const h = harness({
    sendResult: { data: null, error: { message: "temporary provider outage" } },
  });
  const first = await h.handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(first.status, 502);

  // Same harness, but the provider now succeeds.
  const h2 = harness();
  const retry = await h2.handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(retry.status, 200);
  assertEquals(h2.sent.length, 1);
});

Deno.test("returns 503 when the claim itself fails", async () => {
  const { handler, sent } = harness({
    claimAttempt: () => Promise.resolve({ attemptId: null, error: { code: "57014" } }),
  });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(response.status, 503);
  assertEquals(sent.length, 0);
});

Deno.test("reports success even when the completion write fails after a real send", async () => {
  // The email genuinely went out. A bookkeeping failure must not be reported
  // as a send failure.
  const { handler, sent } = harness({
    completeAttempt: () => Promise.resolve({ error: { code: "08006" } }),
  });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(response.status, 200);
  assertEquals(sent.length, 1);
});

// ── Recipient validation ───────────────────────────────────────────────────

Deno.test("skips with no_recipient when the submission has no email", async () => {
  const { handler, sent, completions } = harness({
    row: submissionRow({ submitter_email: null }),
  });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );

  assertEquals(response.status, 200);
  assertEquals(await response.json(), {
    success: false,
    skipped: "no_recipient",
    event: "received",
  });
  assertEquals(sent.length, 0);
  assertEquals(completions[0].errorCode, "no_recipient");
});

Deno.test("skips with invalid_recipient for a stored value that is not an address", async () => {
  const { handler, sent, completions } = harness({
    row: submissionRow({ submitter_email: "definitely not an email" }),
  });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );

  assertEquals(sent.length, 0);
  assertEquals(completions[0].errorCode, "invalid_recipient");
  assertEquals((await response.json()).skipped, "invalid_recipient");
});

Deno.test("rejects a header-injection attempt in the stored address", async () => {
  const { handler, sent } = harness({
    row: submissionRow({ submitter_email: "ok@example.com\nBcc: victim@example.com" }),
  });
  await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  // The whitespace-rejecting pattern refuses it outright.
  assertEquals(sent.length, 0);
});

// ── Content correctness ────────────────────────────────────────────────────

Deno.test("internal_note can never reach the submitter", async () => {
  // The column is not selected by readSubmission and is not a parameter of
  // the rejection template. Even when present on the row object, it must not
  // appear in the email.
  const { handler, sent } = harness({
    row: submissionRow({
      status: "rejected",
      rejection_message: "Please add the venue address and resubmit.",
      internal_note: "SECRET-MODERATOR-NOTE do not disclose",
    }),
  });

  await handler(request({ submissionId: SUBMISSION_ID, event: "rejected" }));

  assertEquals(sent.length, 1);
  assertEquals(sent[0].html.includes("SECRET-MODERATOR-NOTE"), false);
  assertEquals(sent[0].text.includes("SECRET-MODERATOR-NOTE"), false);
  assertStringIncludes(sent[0].html, "Please add the venue address");
});

Deno.test("rejection without a public message still sends a usable email", async () => {
  const { handler, sent } = harness({
    row: submissionRow({ status: "rejected", rejection_message: null }),
  });
  await handler(request({ submissionId: SUBMISSION_ID, event: "rejected" }));

  assertEquals(sent.length, 1);
  assertStringIncludes(sent[0].subject, "Update on your");
  assertEquals(sent[0].html.includes("Note from the review team"), false);
});

Deno.test("approval email links to the canonical public event URL", async () => {
  const { handler, sent } = harness({
    row: submissionRow({
      status: "approved",
      approved_event_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    }),
  });
  await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));

  assertStringIncludes(
    sent[0].html,
    "https://www.salsasegura.com/events/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee"
  );
});

Deno.test("approval email omits the CTA when no event id was linked", async () => {
  const { handler, sent } = harness({
    row: submissionRow({ status: "approved", approved_event_id: null }),
  });
  await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));

  assertEquals(sent[0].html.includes("View event"), false);
  assertStringIncludes(sent[0].subject, "was approved");
});

Deno.test("moderator email carries the review link, submitter details, and submission id", async () => {
  const { handler, sent } = harness();
  await handler(
    request({ submissionId: SUBMISSION_ID, event: "awaiting_review" }, { authorization: null })
  );

  assertStringIncludes(sent[0].html, `https://www.salsasegura.com/admin/submissions/${SUBMISSION_ID}`);
  assertStringIncludes(sent[0].html, "Anon Dancer");
  assertStringIncludes(sent[0].html, "submitter@example.com");
  assertStringIncludes(sent[0].html, SUBMISSION_ID);
  // Reply goes to the submitter, which is the useful default for a queue.
  assertEquals(sent[0].replyTo, "submitter@example.com");
});

Deno.test("confirmation email states pending review and never implies publication", async () => {
  const { handler, sent } = harness();
  await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );

  assertStringIncludes(sent[0].html, "review queue");
  assertStringIncludes(sent[0].html, "Salsa Social at The Anchor");
  assertEquals(sent[0].html.toLowerCase().includes("is now live"), false);
  assertEquals(sent[0].html.toLowerCase().includes("published"), false);
});

Deno.test("escapes HTML in stored event and submitter fields", async () => {
  const { handler, sent } = harness({
    row: submissionRow({
      submitter_name: '<script>alert("xss")</script>',
      submitted_data: {
        title: '<img src=x onerror=alert(1)>',
        event_date: "2026-09-06T23:30:00.000Z",
        city: "boston",
      },
    }),
  });

  await handler(
    request({ submissionId: SUBMISSION_ID, event: "awaiting_review" }, { authorization: null })
  );

  assertEquals(sent[0].html.includes("<script>"), false);
  assertEquals(sent[0].html.includes("<img src=x"), false);
  assertStringIncludes(sent[0].html, "&lt;script&gt;");
});

Deno.test("caps an oversized stored title", async () => {
  const { handler, sent } = harness({
    row: submissionRow({
      submitted_data: { title: "A".repeat(5_000), city: "boston" },
    }),
  });
  await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  // 200-char cap, so nothing near the original length survives.
  assertEquals(sent[0].html.includes("A".repeat(500)), false);
});

Deno.test("caps an oversized public rejection message", async () => {
  const { handler, sent } = harness({
    row: submissionRow({
      status: "rejected",
      rejection_message: "B".repeat(50_000),
    }),
  });
  await handler(request({ submissionId: SUBMISSION_ID, event: "rejected" }));
  assertEquals(sent[0].html.includes("B".repeat(3_000)), false);
});

Deno.test("edited_data overlays submitted_data, matching the approval RPC", async () => {
  const { handler, sent } = harness({
    row: submissionRow({
      status: "approved",
      edited_data: { title: "Corrected Title", location: "Corrected Venue" },
    }),
  });
  await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));

  assertStringIncludes(sent[0].html, "Corrected Title");
  assertStringIncludes(sent[0].html, "Corrected Venue");
  assertEquals(sent[0].html.includes("Salsa Social at The Anchor"), false);
});

Deno.test("never builds a link from a non-https public_site_url", async () => {
  const { handler, sent } = harness({
    row: submissionRow({ status: "approved", approved_event_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" }),
    settings: {
      platform_name: "SalsaSegura",
      public_site_url: "javascript:alert(1)",
      support_email: "info@salsasegura.com",
    },
  });
  await handler(request({ submissionId: SUBMISSION_ID, event: "approved" }));

  assertEquals(sent[0].html.includes("javascript:"), false);
  assertEquals(sent[0].html.includes("View event"), false);
});

Deno.test("returns 503 when platform settings cannot be read", async () => {
  const { handler, sent } = harness({ settings: null });
  const response = await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertEquals(response.status, 503);
  assertEquals(sent.length, 0);
});

Deno.test("renders the event date in the platform timezone", async () => {
  // 2026-09-06T23:30Z is 7:30 PM ET on Sep 6 — the date must not roll forward.
  const { handler, sent } = harness();
  await handler(
    request({ submissionId: SUBMISSION_ID, event: "received" }, { authorization: null })
  );
  assertStringIncludes(sent[0].html, "September 6, 2026");
  assertStringIncludes(sent[0].html, "7:30 PM ET");
});
