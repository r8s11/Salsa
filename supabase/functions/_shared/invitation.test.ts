
import {
  normalizeEmail,
  normalizeDisplayName,
  inviteRedirectUrl,
  isAllowedInviteRedirect,
} from "./invitation.ts";
import { assertEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";

Deno.test("normalizeEmail", () => {
  assertEquals(normalizeEmail(" TEST@EXAMPLE.com "), "test@example.com");
  assertEquals(normalizeEmail("invalid-email"), null);
  assertEquals(normalizeEmail(""), null);
  assertEquals(normalizeEmail(123), null);
});

Deno.test("normalizeDisplayName", () => {
  assertEquals(normalizeDisplayName(" John Doe "), "John Doe");
  assertEquals(normalizeDisplayName(""), null);
  assertEquals(normalizeDisplayName("a".repeat(101)), null);
});

Deno.test("inviteRedirectUrl", () => {
  assertEquals(inviteRedirectUrl("local"), "http://localhost:3000/invite");
  assertEquals(inviteRedirectUrl("production"), "https://salsa.example.com/invite");
});

Deno.test("isAllowedInviteRedirect", () => {
  assertEquals(isAllowedInviteRedirect("http://localhost:3000/invite"), true);
  assertEquals(isAllowedInviteRedirect("https://salsa.example.com/invite"), true);
  assertEquals(isAllowedInviteRedirect("https://salsa.example.com/"), false);
  assertEquals(isAllowedInviteRedirect("/auth/callback"), false);
  assertEquals(isAllowedInviteRedirect("https://malicious.com"), false);
});
