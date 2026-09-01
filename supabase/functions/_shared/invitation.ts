export type InviteOrganizerRequest = { email: string; displayName?: string };
export type EmailInviteSuccess = { delivery: "email_invitation"; userId: string; email: string };

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) ? email : null;
}

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 255) return null;
  return trimmed;
}

export function inviteRedirectUrl(environment: "local" | "production"): string {
  return environment === "local"
    ? "http://localhost:5173/auth/invite"
    : "https://www.salsasegura.com/auth/invite";
}

// --- Founder invitation acceptance URL (Phase 4/5) -------------------------
// Mirrors inviteRedirectUrl() above: a hardcoded value per ENVIRONMENT,
// with an optional exact-match override for exceptional cases. The
// canonical shape is fixed by Phase 4: /founders/accept?token=<token>.
// The token itself is appended by the caller (send-founder-invitation);
// this function only builds the base path.

export function founderAcceptUrl(environment: "local" | "production"): string {
  return environment === "local"
    ? "http://localhost:5173/founders/accept"
    : "https://www.salsasegura.com/founders/accept";
}

export function isAllowedFounderAcceptUrl(value: string): boolean {
  const allowed = [
    "http://localhost:5173/founders/accept",
    "https://www.salsasegura.com/founders/accept",
  ];
  return allowed.includes(value);
}

// --- Host Dashboard URL (Phase 8) -------------------------------------------
// Same per-environment shape as founderAcceptUrl() above. Unlike that
// function, this is never a redirect target for Supabase Auth — it is only
// ever interpolated into an email body as a plain link — so there is no
// matching isAllowed* validator: nothing treats this value as untrusted
// input to check against an allowlist.

export function hostDashboardUrl(environment: "local" | "production"): string {
  return environment === "local"
    ? "http://localhost:5173/host"
    : "https://www.salsasegura.com/host";
}

export function isAllowedInviteRedirect(value: string): boolean {
  const allowed = [
    "http://localhost:5173/auth/invite",
    "https://www.salsasegura.com/auth/invite",
  ];
  return allowed.includes(value);
}
