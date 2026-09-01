import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import {
  normalizeEmail,
  normalizeOrgName,
  normalizeInstagramHandle,
  normalizeWebsiteUrl,
  validateAndNormalize,
  isHoneypotTripped,
} from "./founderRequest.ts";

Deno.test("normalizeEmail", () => {
  assertEquals(normalizeEmail("  USER@EXAMPLE.COM  "), "user@example.com");
});

Deno.test("normalizeOrgName", () => {
  assertEquals(normalizeOrgName("  Havana   Club  Boston  "), "havana club boston");
});

Deno.test("normalizeInstagramHandle", () => {
  assertEquals(normalizeInstagramHandle("@HavanaClub"), "havanaclub");
  assertEquals(normalizeInstagramHandle("havanaclub"), "havanaclub");
  assertEquals(normalizeInstagramHandle("https://instagram.com/HavanaClub"), "havanaclub");
  assertEquals(normalizeInstagramHandle("https://www.instagram.com/HavanaClub/"), "havanaclub");
  assertEquals(normalizeInstagramHandle(""), null);
  assertEquals(normalizeInstagramHandle("   "), null);
});

Deno.test("normalizeWebsiteUrl", () => {
  assertEquals(normalizeWebsiteUrl("example.com"), "https://example.com");
  assertEquals(normalizeWebsiteUrl("https://example.com"), "https://example.com");
  assertEquals(normalizeWebsiteUrl("http://example.com"), "http://example.com");
  assertEquals(normalizeWebsiteUrl(""), null);
});

Deno.test("validateAndNormalize accepts a valid payload and normalizes it", () => {
  const outcome = validateAndNormalize({
    applicantName: "  John Doe  ",
    email: "  JOHN@EXAMPLE.COM  ",
    organizationName: "  Salsa   Nights  Boston  ",
    instagram: "@SalsaNights",
    website: "https://salsanights.com",
    city: "  Boston  ",
    region: "  MA  ",
    description: "  Weekly socials  ",
    message: "  Hello  ",
  });
  assertEquals(outcome.ok, true);
  if (outcome.ok) {
    assertEquals(outcome.data.applicantName, "John Doe");
    assertEquals(outcome.data.email, "john@example.com");
    assertEquals(outcome.data.organizationName, "Salsa   Nights  Boston");
    assertEquals(outcome.data.normalizedOrgName, "salsa nights boston");
    assertEquals(outcome.data.instagram, "salsanights");
    assertEquals(outcome.data.website, "https://salsanights.com");
    assertEquals(outcome.data.city, "Boston");
    assertEquals(outcome.data.region, "MA");
    assertEquals(outcome.data.description, "Weekly socials");
    assertEquals(outcome.data.message, "Hello");
  }
});

Deno.test("validateAndNormalize rejects missing required fields", () => {
  assertEquals(validateAndNormalize({}).ok, false);
  assertEquals(
    validateAndNormalize({ applicantName: "", email: "a@b.co", organizationName: "X" }).ok,
    false
  );
  assertEquals(
    validateAndNormalize({ applicantName: "A", email: "", organizationName: "X" }).ok,
    false
  );
  assertEquals(
    validateAndNormalize({ applicantName: "A", email: "a@b.co", organizationName: "" }).ok,
    false
  );
});

Deno.test("validateAndNormalize rejects invalid email format", () => {
  const outcome = validateAndNormalize({
    applicantName: "A",
    email: "not-an-email",
    organizationName: "X",
  });
  assertEquals(outcome.ok, false);
  if (!outcome.ok) assertEquals(outcome.error, "Invalid email format");
});

Deno.test("validateAndNormalize rejects oversized fields", () => {
  const base = { applicantName: "A", email: "a@b.co", organizationName: "X" };
  assertEquals(validateAndNormalize({ ...base, applicantName: "a".repeat(256) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, organizationName: "a".repeat(256) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, instagram: "a".repeat(101) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, website: "https://" + "a".repeat(495) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, city: "a".repeat(101) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, region: "a".repeat(101) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, description: "a".repeat(5001) }).ok, false);
  assertEquals(validateAndNormalize({ ...base, message: "a".repeat(5001) }).ok, false);
});

Deno.test("validateAndNormalize never reads client-supplied admin fields", () => {
  const outcome = validateAndNormalize({
    applicantName: "A",
    email: "a@b.co",
    organizationName: "X",
    status: "approved",
    reviewed_by: "someone",
    reviewed_at: "2026-01-01",
    created_at: "2026-01-01",
  });
  // Still valid — the unknown fields are simply ignored; the handler
  // hardcodes status at insert, so they cannot leak through.
  assertEquals(outcome.ok, true);
});

Deno.test("validateAndNormalize rejects non-object payloads", () => {
  assertEquals(validateAndNormalize(null).ok, false);
  assertEquals(validateAndNormalize("string").ok, false);
  assertEquals(validateAndNormalize(42).ok, false);
});

Deno.test("isHoneypotTripped", () => {
  assertEquals(isHoneypotTripped({}), false);
  assertEquals(isHoneypotTripped({ companyWebsite: "" }), false);
  assertEquals(isHoneypotTripped({ companyWebsite: "   " }), false);
  assertEquals(isHoneypotTripped({ companyWebsite: "http://spam.bot" }), true);
  assertEquals(isHoneypotTripped(null), false);
});