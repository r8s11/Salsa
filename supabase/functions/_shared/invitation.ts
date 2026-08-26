const EMAIL_MAX_LENGTH = 254;
const DISPLAY_NAME_MAX_LENGTH = 100;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVITE_REDIRECTS = {
  local: "http://localhost:5173/auth/invite",
  production: "https://www.salsasegura.com/auth/invite",
} as const;

export type InviteOrganizerRequest = {
  email: string;
  displayName?: string;
};

export type EmailInviteSuccess = {
  delivery: "email_invitation";
  userId: string;
  email: string;
};

export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const email = value.trim().toLowerCase();
  if (!email || email.length > EMAIL_MAX_LENGTH || !EMAIL_PATTERN.test(email)) return null;

  return email;
}

export function normalizeDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const displayName = value.trim();
  if (!displayName || displayName.length > DISPLAY_NAME_MAX_LENGTH) return null;

  return displayName;
}

export function inviteRedirectUrl(environment: "local" | "production"): string {
  return INVITE_REDIRECTS[environment];
}

export function isAllowedInviteRedirect(value: string): boolean {
  return value === INVITE_REDIRECTS.local || value === INVITE_REDIRECTS.production;
}
