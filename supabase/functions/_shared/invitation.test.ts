import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
  normalizeEmail,
  normalizeDisplayName,
  inviteRedirectUrl,
  isAllowedInviteRedirect,
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

Deno.test("isAllowedInviteRedirect", () => {
  assertEquals(isAllowedInviteRedirect("http://localhost:5173/auth/invite"), true);
  assertEquals(isAllowedInviteRedirect("https://www.salsasegura.com/auth/invite"), true);
  assertEquals(isAllowedInviteRedirect("/"), false);
  assertEquals(isAllowedInviteRedirect("/auth/callback"), false);
  assertEquals(isAllowedInviteRedirect("//evil.com"), false);
  assertEquals(isAllowedInviteRedirect("https://evil.com"), false);
});
