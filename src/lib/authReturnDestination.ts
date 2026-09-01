/**
 * Short-lived, client-only return destination for auth flows that leave
 * the SPA and come back through an email link (Phase 6 spec §10).
 *
 * Why this exists:
 *   The Founder invitation acceptance page (`/founders/accept`) needs the
 *   user to return to it after authenticating. For direct sign-in, the
 *   existing `location.state?.from` mechanism in SignInForm works — the
 *   user never leaves the SPA. But for flows that go through an emailed
 *   link (signup confirmation, password recovery), the user leaves the
 *   SPA entirely: the emailed link redirects to `/auth/callback`, which
 *   has no way to know the user came from the acceptance page.
 *
 *   Supabase's PKCE verify redirect must exactly match an allow-listed
 *   URL (see `authIntent.ts` for the same constraint), so `?next=` cannot
 *   be attached to the emailed link. sessionStorage is the only mechanism
 *   that survives the email-link redirect while remaining tab-scoped and
 *   short-lived.
 *
 * Security properties:
 *   - sessionStorage, NOT localStorage: dies with the tab, never survives
 *     a browser restart, not shared across tabs.
 *   - Only accepts a safe internal path (same validation as `?next=`):
 *     must start with `/`, must not start with `//` or contain `://`.
 *   - Consumed exactly once by whichever auth surface completes first
 *     (AuthCallback for email-link returns, SignInForm for direct
 *     sign-in) — never persists beyond a single auth completion.
 *   - Best-effort: if sessionStorage is unavailable, the auth flow still
 *     completes, the user just lands on their role-default destination
 *     instead of returning to the acceptance page.
 */

import { isSafeInternalPath } from "./authDestination";

const RETURN_DESTINATION_KEY = "salsasegura-auth-return-destination";

/**
 * Record where an auth flow should return the user to. Call before
 * navigating away from a page that needs to be returned to (e.g. the
 * Founder acceptance page before sending the user to sign-in/signup).
 * Best-effort; never throws.
 */
export function setAuthReturnDestination(path: string): void {
  if (!isSafeInternalPath(path)) return;
  try {
    window.sessionStorage.setItem(RETURN_DESTINATION_KEY, path);
  } catch {
    // sessionStorage unavailable — the auth flow will complete, the user
    // just won't be returned to the intended page.
  }
}

/**
 * Read and clear the return destination. Call exactly once from an
 * auth-completion surface (AuthCallback or SignInForm) — the value does
 * not survive past a single auth completion. Returns null if unset,
 * unavailable, or not a safe internal path. Best-effort; never throws.
 */
export function consumeAuthReturnDestination(): string | null {
  try {
    const raw = window.sessionStorage.getItem(RETURN_DESTINATION_KEY);
    if (!raw) return null;
    window.sessionStorage.removeItem(RETURN_DESTINATION_KEY);
    return isSafeInternalPath(raw) ? raw : null;
  } catch {
    return null;
  }
}
