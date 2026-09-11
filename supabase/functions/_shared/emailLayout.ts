/**
 * Generic transactional-email building blocks shared across every Edge
 * Function that sends mail: one HTML/plain-text layout, HTML escaping, and
 * Resend-failure classification. Extracted from `submissionEmail.ts` (which
 * originally defined these privately) when a second, unrelated feature
 * (Founder welcome email) needed the identical layout — genuinely shared
 * code belongs in a neutrally-named module, not imported from a file named
 * for a different feature.
 *
 * Nothing here is domain-specific. Domain content builders
 * (`submissionEmail.ts`, `founderWelcomeEmail.ts`, `founderInvitationEmail.ts`)
 * import from this module; this module never imports from them.
 */

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/**
 * The single shared layout. Table-based and inline-styled because email
 * clients ignore <style> blocks and flexbox; max-width 520px with
 * width:100% keeps it readable on a phone without a media query.
 */
export function layout(params: {
  platformName: string;
  heading: string;
  paragraphs: string[];
  rows?: Array<[string, string]>;
  cta?: { label: string; url: string };
  footerLines: string[];
}): string {
  const rowsHtml = (params.rows ?? [])
    .map(
      ([label, value]) =>
        `<tr>` +
        `<td style="padding:6px 12px 6px 0;color:#8b8b8b;font-size:14px;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>` +
        `<td style="padding:6px 0;color:#1a1a1a;font-size:14px;vertical-align:top;">${escapeHtml(value)}</td>` +
        `</tr>`
    )
    .join("");

  const detailsBlock = rowsHtml
    ? `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;margin:0 0 24px;border-collapse:collapse;">${rowsHtml}</table>`
    : "";

  const ctaBlock = params.cta
    ? `<p style="margin:0 0 24px;">` +
      `<a href="${escapeHtml(params.cta.url)}" style="display:inline-block;padding:12px 24px;background:#e11d48;color:#ffffff;text-decoration:none;border-radius:6px;font-size:15px;font-weight:600;">` +
      `${escapeHtml(params.cta.label)}</a></p>`
    : "";

  return [
    `<!DOCTYPE html>`,
    `<html lang="en"><head><meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `</head>`,
    `<body style="margin:0;padding:24px 12px;background:#f6f6f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">`,
    `<table cellpadding="0" cellspacing="0" border="0" role="presentation" style="width:100%;max-width:520px;margin:0 auto;background:#ffffff;border-radius:10px;">`,
    `<tr><td style="padding:28px 28px 0;">`,
    `<p style="margin:0 0 20px;font-size:15px;font-weight:700;letter-spacing:0.02em;color:#e11d48;">${escapeHtml(params.platformName)}</p>`,
    `<h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#1a1a1a;font-weight:700;">${escapeHtml(params.heading)}</h1>`,
    ...params.paragraphs.map(
      (text) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3a3a3a;">${escapeHtml(text)}</p>`
    ),
    detailsBlock,
    ctaBlock,
    `</td></tr>`,
    `<tr><td style="padding:0 28px 28px;border-top:1px solid #ececec;">`,
    ...params.footerLines.map(
      (text) =>
        `<p style="margin:16px 0 0;font-size:12px;line-height:1.5;color:#8b8b8b;">${escapeHtml(text)}</p>`
    ),
    `</td></tr>`,
    `</table></body></html>`,
  ].join("");
}

export function plainText(params: {
  platformName: string;
  heading: string;
  paragraphs: string[];
  rows?: Array<[string, string]>;
  cta?: { label: string; url: string };
  footerLines: string[];
}): string {
  const blocks = [params.platformName, "", params.heading, "", ...params.paragraphs];
  for (const [label, value] of params.rows ?? []) blocks.push(`${label}: ${value}`);
  if (params.cta) blocks.push("", `${params.cta.label}: ${params.cta.url}`);
  blocks.push("", ...params.footerLines);
  return blocks.join("\n");
}

export type ResendResult = {
  data: { id?: string } | null;
  error: { message?: string; name?: string } | null;
};

/** Normalizes a Resend failure into a safe category — never a raw provider body. */
export function classifyResendFailure(result: ResendResult | null, thrown: unknown): string {
  if (thrown) {
    const message = thrown instanceof Error ? thrown.message.toLowerCase() : "";
    if (message.includes("fetch") || message.includes("network") || message.includes("timeout")) {
      return "network_error";
    }
    return "provider_error";
  }
  const name = (result?.error?.name ?? "").toLowerCase();
  const message = (result?.error?.message ?? "").toLowerCase();
  if (name.includes("rate") || message.includes("rate limit")) return "rate_limited";
  if (message.includes("invalid") && message.includes("to")) return "invalid_recipient";
  if (name.includes("validation") || message.includes("domain")) return "invalid_sender";
  if (!result?.data?.id) return "provider_error";
  return "provider_error";
}
