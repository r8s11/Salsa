import { type EmailContent, layout, plainText } from "./emailLayout.ts";

const PLATFORM_NAME = "Salsa Segura";
const FOOTER = [
  "If you did not request this email, you can safely ignore it.",
  "Salsa Segura · info@salsasegura.com",
];

type AuthEmailLayoutParams = {
  subject: string;
  heading: string;
  paragraphs: string[];
  cta: { label: string; url: string };
  rows?: Array<[string, string]>;
  footerLines?: string[];
};

function authEmailContent(params: AuthEmailLayoutParams): EmailContent {
  const content = {
    platformName: PLATFORM_NAME,
    heading: params.heading,
    paragraphs: params.paragraphs,
    rows: params.rows,
    cta: params.cta,
    footerLines: params.footerLines ?? FOOTER,
  };

  return {
    subject: params.subject,
    html: layout(content),
    text: plainText(content),
  };
}

export function signupEmailContent(verifyUrl: string): EmailContent {
  return authEmailContent({
    subject: "Confirm your SalsaSegura email",
    heading: "Confirm your email",
    paragraphs: [
      "Confirm your email address to finish creating your SalsaSegura account.",
    ],
    cta: { label: "Confirm your email", url: verifyUrl },
  });
}

export function magicLinkEmailContent(verifyUrl: string): EmailContent {
  return authEmailContent({
    subject: "Sign in to SalsaSegura",
    heading: "Your secure sign-in link",
    paragraphs: ["Use this link to sign in to your SalsaSegura account."],
    cta: { label: "Sign in to SalsaSegura", url: verifyUrl },
  });
}

export function passwordRecoveryEmailContent(verifyUrl: string): EmailContent {
  return authEmailContent({
    subject: "Reset your SalsaSegura password",
    heading: "Reset your password",
    paragraphs: [
      "We received a request to reset the password for your SalsaSegura account.",
    ],
    cta: { label: "Reset your password", url: verifyUrl },
  });
}

export function emailChangeCurrentAddressEmailContent(
  verifyUrl: string,
  newEmail: string | null,
): EmailContent {
  return authEmailContent({
    subject: "Confirm your SalsaSegura email change",
    heading: "Confirm your email change",
    paragraphs: [
      "We received a request to change the email address on your SalsaSegura account.",
      "Confirm the change from your current email address.",
    ],
    rows: newEmail ? [["New email", newEmail]] : undefined,
    cta: { label: "Confirm email change", url: verifyUrl },
    footerLines: [
      "If you did not request this change, ignore this email and your account will remain unchanged.",
      "Salsa Segura · info@salsasegura.com",
    ],
  });
}

export function emailChangeNewAddressEmailContent(
  verifyUrl: string,
): EmailContent {
  return authEmailContent({
    subject: "Confirm your new SalsaSegura email",
    heading: "Confirm your new email",
    paragraphs: ["Confirm this email address for your SalsaSegura account."],
    cta: { label: "Confirm new email", url: verifyUrl },
  });
}
