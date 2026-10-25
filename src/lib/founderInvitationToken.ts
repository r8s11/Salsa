/**
 * Short-lived, client-only storage for a Founder invitation token while
 * the visitor goes through an authentication flow (sign-in, signup with
 * email confirmation, or password recovery) and returns to
 * `/founders/accept`.
 *
 * Why this exists (Phase 6 spec §10/§34):
 *   The emailed link is `/founders/accept?token=<64-hex>`. Once the page
 *   validates the token and cleans the URL (spec §36), the token still
 *   needs to survive the user being redirected away for authentication
 *   — sign-in happens on `/signin`, confirmation/recovery return to
 *   `/auth/callback` — and back. A dedicated sessionStorage key is the
 *   narrowest mechanism that achieves this without persisting the token
 *   long-term or embedding it in redirect URLs.
 *
 * Security properties:
 *   - sessionStorage, NOT localStorage: the token dies with the tab,
 *     never survives a browser restart, and is not shared with other tabs.
 *   - A single dedicated key, never written into the generic
 *     `salsasegura-auth-intent` auth-state object or any analytics event.
 *   - Cleared on: successful acceptance, invalid token detection, and
 *     user cancellation — nothing retains it beyond the acceptance flow.
 *   - Best-effort: if sessionStorage is unavailable (private browsing,
 *     disabled storage), the acceptance page simply cannot survive an
 *     auth redirect; the user can re-open the original email link. No
 *     functional failure, no silent fallback to a less-secure store.
 */

const INVITATION_TOKEN_STORAGE_KEY = "salsasegura-founder-invitation-token";

/** Store the invitation token for the duration of an auth redirect. Best-effort; never throws. */
export function setFounderInvitationToken(token: string): void {
  try {
    window.sessionStorage.setItem(INVITATION_TOKEN_STORAGE_KEY, token);
  } catch {
    // sessionStorage unavailable — the acceptance flow will not survive
    // an auth redirect, but the current page render still works from the URL.
  }
}

/** Read the stored invitation token, without clearing it. Best-effort; never throws. */
export function getFounderInvitationToken(): string | null {
  try {
    const raw = window.sessionStorage.getItem(INVITATION_TOKEN_STORAGE_KEY);
    if (!raw) return null;
    // Defensive: only accept a well-formed token, never arbitrary stored data.
    return /^[0-9a-f]{64}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

/** Clear the stored invitation token. Call on acceptance, invalid token, or cancellation. Best-effort; never throws. */
export function clearFounderInvitationToken(): void {
  try {
    window.sessionStorage.removeItem(INVITATION_TOKEN_STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
