/**
 * Founder Access Request — client-side validation & normalization helpers.
 *
 * These mirror the server-side logic in `public.request_founder_access`
 * and `public.normalize_founder_*` so the form can give instant feedback
 * without a round-trip. The server remains the authoritative validator.
 */

export interface FounderRequestPayload {
  applicantName: string;
  email: string;
  organizationName: string;
  instagram?: string;
  website?: string;
  city?: string;
  region?: string;
  description?: string;
  message?: string;
  /**
   * Honeypot — rendered visually hidden on the form; humans never fill it.
   * Passed through untouched to the Edge Function, which silently accepts
   * (without inserting) when it is non-empty.
   */
  companyWebsite?: string;
}

export interface FounderRequestErrors {
  applicantName?: string;
  email?: string;
  organizationName?: string;
  instagram?: string;
  website?: string;
  city?: string;
  region?: string;
  description?: string;
  message?: string;
  /** Never set — the honeypot is not validated, but the form's generic
   *  handleChange indexes errors by payload key, so it needs a slot. */
  companyWebsite?: string;
}

/** Normalize email: trim, lowercase. */
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

/** Normalize organization name: trim, collapse whitespace, lowercase. */
export function normalizeOrgName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

/** Normalize Instagram handle: remove leading @, lowercase. */
export function normalizeInstagram(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.replace(/^@/, '').toLowerCase();
}

/** Normalize website: trim, ensure protocol. */
export function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/** Validate email format. */
export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Email is required';
  if (value.trim().length > 255) return 'Email too long (max 255 characters)';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    return 'Invalid email format';
  }
  return null;
}

/** Validate applicant name. */
export function validateApplicantName(value: string): string | null {
  if (!value.trim()) return 'Your name is required';
  if (value.trim().length > 255) return 'Name too long (max 255 characters)';
  return null;
}

/** Validate organization name. */
export function validateOrganizationName(value: string): string | null {
  if (!value.trim()) return 'Organization name is required';
  if (value.trim().length > 255) return 'Organization name too long (max 255 characters)';
  return null;
}

/** Validate Instagram handle. */
export function validateInstagram(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (value.trim().length > 100) return 'Instagram handle too long (max 100 characters)';
  const handle = value.trim().replace(/^@/, '').toLowerCase();
  if (!/^[a-z0-9._]+$/.test(handle)) {
    return 'Enter a valid Instagram handle (letters, numbers, periods, underscores)';
  }
  return null;
}

/** Validate website URL. */
export function validateWebsite(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  const trimmed = value.trim();
  if (trimmed.length > 500) return 'Website URL too long (max 500 characters)';
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'Website must start with http:// or https://';
  }
  return null;
}

/** Validate city. */
export function validateCity(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (value.trim().length > 100) return 'City too long (max 100 characters)';
  return null;
}

/** Validate region. */
export function validateRegion(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (value.trim().length > 100) return 'Region too long (max 100 characters)';
  return null;
}

/** Validate description. */
export function validateDescription(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (value.trim().length > 5000) return 'Description too long (max 5000 characters)';
  return null;
}

/** Validate message. */
export function validateMessage(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  if (value.trim().length > 5000) return 'Message too long (max 5000 characters)';
  return null;
}

/** Validate all fields, returning first error per field. */
export function validateFounderRequest(payload: FounderRequestPayload): FounderRequestErrors {
  const errors: FounderRequestErrors = {};

  const nameErr = validateApplicantName(payload.applicantName);
  if (nameErr) errors.applicantName = nameErr;

  const emailErr = validateEmail(payload.email);
  if (emailErr) errors.email = emailErr;

  const orgErr = validateOrganizationName(payload.organizationName);
  if (orgErr) errors.organizationName = orgErr;

  const igErr = validateInstagram(payload.instagram);
  if (igErr) errors.instagram = igErr;

  const webErr = validateWebsite(payload.website);
  if (webErr) errors.website = webErr;

  const cityErr = validateCity(payload.city);
  if (cityErr) errors.city = cityErr;

  const regionErr = validateRegion(payload.region);
  if (regionErr) errors.region = regionErr;

  const descErr = validateDescription(payload.description);
  if (descErr) errors.description = descErr;

  const msgErr = validateMessage(payload.message);
  if (msgErr) errors.message = msgErr;

  return errors;
}

/** Check if there are any validation errors. */
export function hasErrors(errors: FounderRequestErrors): boolean {
  return Object.values(errors).some((v) => v !== undefined);
}

/** Normalize payload for submission. */
export function normalizePayload(payload: FounderRequestPayload): FounderRequestPayload {
  return {
    applicantName: payload.applicantName.trim(),
    email: normalizeEmail(payload.email),
    organizationName: payload.organizationName.trim(),
    instagram: payload.instagram ? normalizeInstagram(payload.instagram) ?? undefined : undefined,
    website: payload.website ? normalizeWebsite(payload.website) ?? undefined : undefined,
    city: payload.city?.trim(),
    region: payload.region?.trim(),
    description: payload.description?.trim(),
    message: payload.message?.trim(),
    // Honeypot passes through untouched — the server decides what it means.
    companyWebsite: payload.companyWebsite,
  };
}