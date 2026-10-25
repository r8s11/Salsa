/**
 * Founder Access Request — shared validation & normalization (pure logic).
 *
 * Imported by the `request-founder-access` Edge Function. Mirrors the
 * client-side helpers in `src/lib/founderRequest.ts` so the server can
 * never be bypassed by a modified client: this module is the
 * authoritative validator for public submissions.
 *
 * No Deno/URL imports — plain TypeScript, exactly like _shared/invitation.ts.
 */

export interface FounderAccessRequestInput {
  applicantName: string;
  email: string;
  organizationName: string;
  instagram?: string;
  website?: string;
  city?: string;
  region?: string;
  description?: string;
  message?: string;
}

/** Normalized, insert-ready shape (presentation value + normalized keys). */
export interface NormalizedFounderRequest {
  applicantName: string;
  email: string;
  organizationName: string;
  normalizedOrgName: string;
  instagram?: string;
  website?: string;
  city?: string;
  region?: string;
  description?: string;
  message?: string;
}

export type ValidationOutcome =
  | { ok: true; data: NormalizedFounderRequest }
  | { ok: false; error: string };

// --- Normalizers ---------------------------------------------------------

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function normalizeOrgName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Accepts "@handle", "handle", or a full instagram.com URL; returns the bare lowercase handle. */
export function normalizeInstagramHandle(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const withoutAt = trimmed.replace(/^@/, "");
  const urlMatch = withoutAt.match(
    /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)\/?$/i
  );
  const handle = (urlMatch ? urlMatch[1] : withoutAt).toLowerCase();
  return handle || null;
}

export function normalizeWebsiteUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

// --- Validation ----------------------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const INSTAGRAM_HANDLE_PATTERN = /^[a-z0-9._]+$/;

/**
 * Validate + normalize an untrusted public payload.
 * Reads ONLY the known fields — a client-supplied `status`, `reviewed_by`,
 * timestamps, or any other admin field is never read, so it cannot be
 * injected. `status` is forced to 'pending' at the insert site.
 */
export function validateAndNormalize(payload: unknown): ValidationOutcome {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  // Per-field `in` + typeof narrowing — no unchecked casts on raw input.
  const applicantName =
    "applicantName" in payload && typeof payload.applicantName === "string"
      ? payload.applicantName
      : undefined;
  const email =
    "email" in payload && typeof payload.email === "string" ? payload.email : undefined;
  const organizationName =
    "organizationName" in payload && typeof payload.organizationName === "string"
      ? payload.organizationName
      : undefined;
  const instagram =
    "instagram" in payload && typeof payload.instagram === "string"
      ? payload.instagram
      : undefined;
  const website =
    "website" in payload && typeof payload.website === "string" ? payload.website : undefined;
  const city =
    "city" in payload && typeof payload.city === "string" ? payload.city : undefined;
  const region =
    "region" in payload && typeof payload.region === "string" ? payload.region : undefined;
  const description =
    "description" in payload && typeof payload.description === "string"
      ? payload.description
      : undefined;
  const message =
    "message" in payload && typeof payload.message === "string"
      ? payload.message
      : undefined;

  if (applicantName === undefined || !applicantName.trim()) {
    return { ok: false, error: "Applicant name is required" };
  }
  if (applicantName.trim().length > 255) {
    return { ok: false, error: "Applicant name too long (max 255 characters)" };
  }

  if (email === undefined || !email.trim()) {
    return { ok: false, error: "Email is required" };
  }
  if (email.trim().length > 255) {
    return { ok: false, error: "Email too long (max 255 characters)" };
  }
  if (!EMAIL_PATTERN.test(email.trim())) {
    return { ok: false, error: "Invalid email format" };
  }

  if (organizationName === undefined || !organizationName.trim()) {
    return { ok: false, error: "Organization name is required" };
  }
  if (organizationName.trim().length > 255) {
    return { ok: false, error: "Organization name too long (max 255 characters)" };
  }

  let normalizedInstagram: string | undefined;
  if (instagram !== undefined && instagram.trim()) {
    if (instagram.trim().length > 100) {
      return { ok: false, error: "Instagram handle too long (max 100 characters)" };
    }
    const handle = normalizeInstagramHandle(instagram);
    if (handle === null || !INSTAGRAM_HANDLE_PATTERN.test(handle)) {
      return { ok: false, error: "Invalid Instagram handle" };
    }
    normalizedInstagram = handle;
  }

  let normalizedWebsite: string | undefined;
  if (website !== undefined && website.trim()) {
    if (website.trim().length > 500) {
      return { ok: false, error: "Website URL too long (max 500 characters)" };
    }
    // The client normalizes protocol-less input before sending; anything
    // that still lacks an explicit http(s) protocol here is rejected.
    if (!/^https?:\/\/[^\s]+$/i.test(website.trim())) {
      return { ok: false, error: "Website must be a valid http(s) URL" };
    }
    normalizedWebsite = website.trim();
  }

  if (city !== undefined && city.trim().length > 100) {
    return { ok: false, error: "City too long (max 100 characters)" };
  }

  if (region !== undefined && region.trim().length > 100) {
    return { ok: false, error: "Region too long (max 100 characters)" };
  }

  if (description !== undefined && description.trim().length > 5000) {
    return { ok: false, error: "Description too long (max 5000 characters)" };
  }

  if (message !== undefined && message.trim().length > 5000) {
    return { ok: false, error: "Message too long (max 5000 characters)" };
  }

  return {
    ok: true,
    data: {
      applicantName: applicantName.trim(),
      email: normalizeEmail(email),
      organizationName: organizationName.trim(),
      normalizedOrgName: normalizeOrgName(organizationName),
      instagram: normalizedInstagram,
      website: normalizedWebsite,
      city: city?.trim() || undefined,
      region: region?.trim() || undefined,
      description: description?.trim() || undefined,
      message: message?.trim() || undefined,
    },
  };
}

/**
 * Honeypot check: the public form renders a visually-hidden
 * "companyWebsite" field that humans never see or fill. A non-empty
 * value means a bot filled it — the caller should return the normal
 * success response WITHOUT inserting anything.
 */
export function isHoneypotTripped(payload: unknown): boolean {
  if (!payload || typeof payload !== "object" || !("companyWebsite" in payload)) {
    return false;
  }
  const value = payload.companyWebsite;
  return typeof value === "string" && value.trim() !== "";
}