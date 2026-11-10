import assert from "node:assert/strict";
import {
  createMemberDigestWorker,
  type DigestWorkerDependencies,
} from "./memberDigestWorker.ts";
const secret = "a".repeat(32), id = "00000000-0000-4000-8000-000000000001";
function setup(overrides: Partial<DigestWorkerDependencies> = {}) {
  const sent: unknown[] = [];
  const finished: string[] = [];
  const deps: DigestWorkerDependencies = {
    secret,
    siteUrl: "https://www.salsasegura.com",
    unsubscribeBase:
      "https://db.example.test/functions/v1/member-email-unsubscribe",
    from: "Salsa <hello@example.test>",
    now: () => new Date("2026-11-12T14:00Z"),
    due: async () => [id],
    claim: async () => ({
      token: id,
      email: "member@example.test",
      city: "chicago",
      metro_name: "Chicago",
      unsubscribe_token: id,
      from: "2026-11-12T14:00Z",
      to: "2026-11-19T14:00Z",
      message: null,
      idempotency_key: "digest:member:2026-11-09",
    }),
    events: async () => [{
      title: "Dance",
      startsAt: "2026-11-13T01:00Z",
      venueTimeZone: "America/Los_Angeles",
      city: "chicago",
      venueName: null,
      path: "/events/dance",
    }],
    prepare: async (_id, _week, _token, email) => email,
    allowed: async () => true,
    send: async (email, key) => {
      sent.push({ email, key });
      return { data: { id: "sent" }, error: null };
    },
    finish: async (_id, _week, _token, status) => {
      finished.push(status);
      return true;
    },
    log: () => {},
    ...overrides,
  };
  return {
    deps,
    sent,
    finished,
    run: (request?: Request) =>
      createMemberDigestWorker(deps)(
        request ??
          new Request("https://worker.test", {
            method: "POST",
            headers: { "x-member-digest-scheduler-secret": secret },
            body: JSON.stringify({ to: "attacker@evil.test" }),
          }),
      ),
  };
}
Deno.test("scheduler rejects unauthenticated requests without loading recipients", async () => {
  const t = setup({
    due: () => {
      throw Error("must not query");
    },
  });
  assert.equal(
    (await t.run(new Request("https://worker.test", { method: "POST" })))
      .status,
    401,
  );
  t.deps.secret = "short";
  assert.equal((await t.run()).status, 401);
  assert.equal(t.sent.length, 0);
});
Deno.test("scheduler ignores relay input and uses event zone and deterministic provider key", async () => {
  const t = setup();
  const response = await t.run();
  assert.equal(response.status, 200);
  const delivery = t.sent[0] as {
    email: { to: string; text: string };
    key: string;
  };
  assert.equal(delivery.email.to, "member@example.test");
  assert.match(delivery.email.text, /5:00 PM PST/);
  assert.equal(delivery.key, "digest:member:2026-11-09");
  assert.deepEqual(t.finished, ["sent"]);
});
Deno.test("empty selection and a last-moment opt-out suppress instead of sending", async () => {
  for (
    const overrides of [{ events: async () => [] }, {
      allowed: async () => false,
    }]
  ) {
    const t = setup(overrides);
    await t.run();
    assert.equal(t.sent.length, 0);
    assert.deepEqual(t.finished, ["suppressed"]);
  }
});
Deno.test("scheduler bounds a page and returns a cursor rather than dropping remaining members", async () => {
  const ids = Array.from(
    { length: 51 },
    (_, i) => "00000000-0000-4000-8000-" + String(i + 1).padStart(12, "0"),
  );
  const t = setup({ due: async () => ids });
  const response = await t.run();
  const body = await response.json();
  assert.equal(t.sent.length, 50);
  assert.equal(body.next_cursor, ids[49]);
});
Deno.test("provider failure continues through the page and exposes a safe failure outcome", async () => {
  let sends = 0;
  const t = setup({
    due: async () => [id, "00000000-0000-4000-8000-000000000002"],
    send: async () =>
      ++sends === 1
        ? { data: null, error: { message: "rate limit" } }
        : { data: { id: "ok" }, error: null },
  });
  const response = await t.run();
  assert.equal(response.status, 503);
  assert.equal(sends, 2);
  assert.deepEqual(t.finished, ["failed", "sent"]);
});
Deno.test("retry reuses the stored provider message without rebuilding changed content", async () => {
  const t = setup();
  const original = await t.deps.claim(id, "2026-11-09");
  const message = {
    from: t.deps.from,
    to: "member@example.test",
    subject: "Original",
    html: "Original",
    text: "Original",
    headers: {},
  };
  t.deps.claim = async () => ({ ...original!, message });
  t.deps.events = () => {
    throw Error("must retain snapshot");
  };
  await t.run();
  assert.equal((t.sent[0] as { email: unknown }).email, message);
});
