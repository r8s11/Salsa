import {
  inviteRedirectUrl,
  isAllowedInviteRedirect,
  normalizeDisplayName,
  normalizeEmail,
} from "./invitation.ts";
import type { EmailInviteSuccess, InviteOrganizerRequest } from "./invitation.ts";

function assertEquals<T>(actual: T, expected: T): void {
  if (!Object.is(actual, expected)) {
    throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

Deno.test("normalizeEmail trims and lowercases a valid address", () => {
  assertEquals(normalizeEmail("  Organizer@Example.COM "), "organizer@example.com");
});

Deno.test("normalizeEmail rejects empty, malformed, non-string, and overlong values", () => {
  assertEquals(normalizeEmail("   "), null);
  assertEquals(normalizeEmail("not-an-email"), null);
  assertEquals(normalizeEmail({ email: "organizer@example.com" }), null);
  assertEquals(normalizeEmail(`${"a".repeat(243)}@example.com`), null);
});

Deno.test("normalizeDisplayName trims optional names and rejects empty, non-string, and overlong values", () => {
  assertEquals(normalizeDisplayName("  Ana Organizer  "), "Ana Organizer");
  assertEquals(normalizeDisplayName(undefined), null);
  assertEquals(normalizeDisplayName("   "), null);
  assertEquals(normalizeDisplayName(42), null);
  assertEquals(normalizeDisplayName("a".repeat(101)), null);
});

Deno.test("invite redirects are exactly the local and production invite routes", () => {
  const local = "http://localhost:5173/auth/invite";
  const production = "https://www.salsasegura.com/auth/invite";

  assertEquals(inviteRedirectUrl("local"), local);
  assertEquals(inviteRedirectUrl("production"), production);
  assertEquals(isAllowedInviteRedirect(local), true);
  assertEquals(isAllowedInviteRedirect(production), true);
});

Deno.test("invite redirects reject all non-allowlisted paths and origins", () => {
  for (const value of [
    "/",
    "/auth/callback",
    "//www.salsasegura.com/auth/invite",
    "https://evil.example/auth/invite",
    "javascript:alert(1)",
    "https://www.salsasegura.com/auth/invite/",
  ]) {
    assertEquals(isAllowedInviteRedirect(value), false);
  }
});

Deno.test("invite request contract does not accept a caller-supplied role", () => {
  const request: InviteOrganizerRequest = { email: "organizer@example.com", displayName: "Ana" };
  const success: EmailInviteSuccess = {
    delivery: "email_invitation",
    userId: "user-id",
    email: request.email,
  };

  assertEquals(success.delivery, "email_invitation");

  // @ts-expect-error Roles are assigned only by trusted server-side code.
  const untrustedRequest: InviteOrganizerRequest = { email: "organizer@example.com", role: "admin" };
  void untrustedRequest;
});
