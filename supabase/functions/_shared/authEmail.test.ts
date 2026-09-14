import { assertEquals, assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  emailChangeCurrentAddressEmailContent,
  emailChangeNewAddressEmailContent,
  magicLinkEmailContent,
  passwordRecoveryEmailContent,
  signupEmailContent,
} from "./authEmail.ts";

const VERIFY_URL =
  "https://project.supabase.co/auth/v1/verify?token=hash&type=signup&redirect_to=https%3A%2F%2Fwww.salsasegura.com%2Fauth%2Fcallback";

Deno.test("auth email builders use the shared branded layout and preserve their CTA URLs", () => {
  const cases = [
    [signupEmailContent(VERIFY_URL), "Confirm your SalsaSegura email", "Confirm your email"],
    [magicLinkEmailContent(VERIFY_URL), "Sign in to SalsaSegura", "Sign in to SalsaSegura"],
    [
      passwordRecoveryEmailContent(VERIFY_URL),
      "Reset your SalsaSegura password",
      "Reset your password",
    ],
    [
      emailChangeNewAddressEmailContent(VERIFY_URL),
      "Confirm your new SalsaSegura email",
      "Confirm new email",
    ],
  ] as const;

  for (const [content, subject, cta] of cases) {
    assertEquals(content.subject, subject);
    assertStringIncludes(content.html, "<!DOCTYPE html>");
    assertStringIncludes(content.html, "Salsa Segura");
    assertStringIncludes(
      content.html,
      '<img src="https://www.salsasegura.com/images/brand/mark-brand.png" alt="Salsa Segura logo" width="64" height="64"'
    );
    assertStringIncludes(content.html, cta);
    assertStringIncludes(content.html, VERIFY_URL.replaceAll("&", "&amp;"));
    assertStringIncludes(content.text, VERIFY_URL);
  }
});

Deno.test(
  "current-address email change content identifies and escapes the requested new address",
  () => {
    const content = emailChangeCurrentAddressEmailContent(VERIFY_URL, "new+<unsafe>@example.com");

    assertEquals(content.subject, "Confirm your SalsaSegura email change");
    assertStringIncludes(content.html, "new+&lt;unsafe&gt;@example.com");
    assertEquals(content.html.includes("new+<unsafe>@example.com"), false);
    assertStringIncludes(content.html, "Confirm email change");
    assertStringIncludes(content.text, "new+<unsafe>@example.com");
  }
);
