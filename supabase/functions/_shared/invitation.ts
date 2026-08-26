
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  // Basic RFC 5322 regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed) && trimmed.length <= 254 ? trimmed : null;
}

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 100) return null;
  return trimmed;
}

export function inviteRedirectUrl(environment: "local" | "production"): string {
  return environment === "local"
    ? "http://localhost:3000/invite"
    : "https://salsa.example.com/invite";
}

export function isAllowedInviteRedirect(value: string): boolean {
  const allowed = [
    "http://localhost:3000/invite",
    "https://salsa.example.com/invite",
  ];
  return allowed.includes(value);
}

export type InviteOrganizerRequest = {
  email: string;
  displayName?: string;
};

export type EmailInviteSuccess = {
  delivery: "email_invitation";
  userId: string;
  email: string;
};
