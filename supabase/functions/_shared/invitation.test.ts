import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
  normalizeEmail,
  normalizeDisplayName,
  inviteRedirectUrl,
  isAllowedInviteRedirect,
  isValidInviteRedirect,
  resolveInviteRedirectUrl,
} from "./invitation.ts";

Deno.test("normalizeEmail", () => {
  assertEquals(normalizeEmail("  USER@EXAMPLE.COM  "), "user@example.com");
  assertEquals(normalizeEmail(""), null);
  assertEquals(normalizeEmail(null), null);
  assertEquals(normalizeEmail("invalid"), null);
});

Deno.test("normalizeDisplayName", () => {
  assertEquals(normalizeDisplayName("  John Doe  "), "John Doe");
  assertEquals(normalizeDisplayName(""), null);
  assertEquals(normalizeDisplayName("A".repeat(256)), null); // Assuming 255 char limit
});

Deno.test("inviteRedirectUrl", () => {
  assertEquals(inviteRedirectUrl("local"), "http://localhost:5173/auth/invite");
  assertEquals(inviteRedirectUrl("production"), "https://www.salsasegura.com/auth/invite");
});

Deno.test("resolveInviteRedirectUrl prefers the explicit trusted URL", () => {
  assertEquals(
    resolveInviteRedirectUrl({
      ENVIRONMENT: "production",
      INVITE_REDIRECT_URL: "https://invites.example.com/auth/invite",
      AUTH_EXTERNAL_URL: "https://www.salsasegura.com",
    }),
    "https://invites.example.com/auth/invite",
  );
});

Deno.test("resolveInviteRedirectUrl constructs one invite path from the external origin", () => {
  assertEquals(
    resolveInviteRedirectUrl({
      ENVIRONMENT: "production",
      AUTH_EXTERNAL_URL: "https://www.salsasegura.com/",
    }),
    "https://www.salsasegura.com/auth/invite",
  );
});

Deno.test("resolveInviteRedirectUrl uses localhost only for local development", () => {
  assertEquals(
    resolveInviteRedirectUrl({ ENVIRONMENT: "development" }),
    "http://localhost:5173/auth/invite",
  );
});

Deno.test("resolveInviteRedirectUrl fails closed for missing or invalid production configuration", () => {
  assertEquals(resolveInviteRedirectUrl({ ENVIRONMENT: "production" }), null);
  assertEquals(
    resolveInviteRedirectUrl({
      ENVIRONMENT: "production",
      AUTH_EXTERNAL_URL: "javascript:alert(1)",
    }),
    null,
  );
  assertEquals(
    resolveInviteRedirectUrl({
      ENVIRONMENT: "production",
      INVITE_REDIRECT_URL: "//evil.example/auth/invite",
    }),
    null,
  );
});

Deno.test("isValidInviteRedirect accepts HTTP URLs and rejects unsafe values", () => {
  assertEquals(isValidInviteRedirect("http://localhost:5173/auth/invite"), true);
  assertEquals(isValidInviteRedirect("https://example.com/auth/invite"), true);
  assertEquals(isValidInviteRedirect("not a URL"), false);
  assertEquals(isValidInviteRedirect("data:text/html,invite"), false);
  assertEquals(isValidInviteRedirect("//evil.example/auth/invite"), false);
});

Deno.test("isAllowedInviteRedirect", () => {
  assertEquals(isAllowedInviteRedirect("http://localhost:5173/auth/invite"), true);
  assertEquals(isAllowedInviteRedirect("https://www.salsasegura.com/auth/invite"), true);
  assertEquals(isAllowedInviteRedirect("/"), false);
  assertEquals(isAllowedInviteRedirect("/auth/callback"), false);
  assertEquals(isAllowedInviteRedirect("//evil.com"), false);
  assertEquals(isAllowedInviteRedirect("https://evil.com"), false);
});
