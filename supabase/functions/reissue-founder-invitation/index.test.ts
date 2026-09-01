import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createReissueFounderInvitationHandler,
  type ReissueFounderInvitationDependencies,
} from "./index.ts";

type Call = { name: string; value: unknown };

const TOKEN = "b".repeat(64);
const ACCEPT_URL_BASE = "http://localhost:5173/founders/accept";
const REISSUED_INVITATION = {
  id: "inv-fresh",
  token: TOKEN,
  email: "founder@example.com",
  organizationName: "Riverside Salsa",
  expiresAt: "2026-09-04T00:00:00.000Z",
  revokedCount: 1,
};

function dependencies(overrides: Partial<ReissueFounderInvitationDependencies> = {}) {
  const calls: Call[] = [];
  const logs: Array<{ message: string; details?: unknown }> = [];
  const rpcResponses: Record<string, { data: unknown; error: { code?: string; message?: string } | null }> = {
    admin_reissue_founder_invitation: { data: REISSUED_INVITATION, error: null },
    admin_record_founder_invitation_delivery_attempt: {
      data: { id: "attempt-2", attemptNumber: 1, status: "sent" },
      error: null,
    },
    admin_revoke_founder_invitation: { data: { success: true, status: "revoked" }, error: null },
  };

  const deps: ReissueFounderInvitationDependencies = {
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
          return { data: { id: "resend-msg-fresh" }, error: null };
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

function request(body: unknown = { founderRequestId: "req-1" }, authorization = "Bearer caller-token") {
  return new Request("http://localhost/reissue-founder-invitation", {
    method: "POST",
    headers: { "content-type": "application/json", authorization },
    body: JSON.stringify(body),
  });
}

Deno.test("reissues a Founder invitation with a fresh credential, records delivery, and never returns or logs its token", async () => {
  const { deps, calls, logs } = dependencies();
  const response = await createReissueFounderInvitationHandler(deps)(request());

  assertEquals(response.status, 200);
  assertEquals(calls[0], {
    name: "rpc:admin_reissue_founder_invitation",
    value: { p_founder_request_id: "req-1" },
  });

  const sendCall = calls.find((call) => call.name === "resend:send");
  assertExists(sendCall);
  const message = sendCall.value as { to: string; html: string; text: string };
  assertEquals(message.to, REISSUED_INVITATION.email);
  assertStringIncludes(message.html, `${ACCEPT_URL_BASE}?token=${TOKEN}`);
  assertStringIncludes(message.text, `${ACCEPT_URL_BASE}?token=${TOKEN}`);

  const deliveryCall = calls.find((call) => call.name === "rpc:admin_record_founder_invitation_delivery_attempt");
  assertEquals(deliveryCall?.value, {
    p_invitation_id: REISSUED_INVITATION.id,
    p_status: "sent",
    p_provider_message_id: "resend-msg-fresh",
    p_provider: "resend",
  });
  const body = await response.text();
  assertEquals(body.includes(TOKEN), false);
  for (const entry of logs) assertEquals(JSON.stringify(entry).includes(TOKEN), false);
});
