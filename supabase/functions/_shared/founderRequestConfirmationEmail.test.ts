import { assertEquals } from "https://deno.land/std/testing/asserts.ts";
import { founderRequestConfirmationEmail } from "./founderRequestConfirmationEmail.ts";

const BASE = { applicantName: "John Doe", organizationName: "Salsa Nights Boston" };

Deno.test("has no call-to-action / no admin URLs or tokens anywhere in the content", () => {
  const content = founderRequestConfirmationEmail(BASE);
  for (const forbidden of ["href=", "/admin/", "http://", "https://", "token"]) {
    assertEquals(content.html.toLowerCase().includes(forbidden), false, `html should not contain ${forbidden}`);
    assertEquals(content.text.toLowerCase().includes(forbidden), false, `text should not contain ${forbidden}`);
  }
});

Deno.test("escapes HTML supplied via applicant name / organization name", () => {
  const content = founderRequestConfirmationEmail({
    applicantName: "<img src=x onerror=alert(1)>",
    organizationName: "<script>alert(2)</script>",
  });
  assertEquals(content.html.includes("<img"), false);
  assertEquals(content.html.includes("<script>"), false);
  assertEquals(content.html.includes("&lt;img"), true);
  assertEquals(content.html.includes("&lt;script&gt;"), true);
  assertEquals(content.text.includes("<img src=x onerror=alert(1)>"), true);
  assertEquals(content.text.includes("<script>alert(2)</script>"), true);
});
