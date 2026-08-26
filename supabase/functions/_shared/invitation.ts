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
    ? "http://localhost:3000/auth/invite-confirm" 
    : "https://salsasegura.com/auth/invite-confirm";
}

export function isAllowedInviteRedirect(value: string): boolean {
  const allowed = [
    "http://localhost:3000/auth/invite-confirm",
    "https://salsasegura.com/auth/invite-confirm"
  ];
  return allowed.includes(value);
}
