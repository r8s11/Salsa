import { publicErrorMessage } from "../../shared/forms/errorMessage";

/** True when a Supabase auth failure means the account's email is unconfirmed. */
export function isUnconfirmedEmail(message: string): boolean {
  return /email not confirmed/i.test(message);
}

/** Map raw Supabase auth errors to user-friendly copy. */
export function friendlyAuthError(message: string): string {
  if (/already registered/i.test(message)) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password.";
  }
  if (/rate limit/i.test(message)) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (/valid.*email|unable to validate email/i.test(message)) {
    return "Please enter a valid email address.";
  }
  if (/password.*at least|should be at least/i.test(message)) {
    return "Password must be at least 6 characters.";
  }
  if (isUnconfirmedEmail(message)) {
    // The resend button appears below this copy (see isUnconfirmedEmail callers).
    return "Your email address hasn't been confirmed yet. Resend the confirmation email to continue.";
  }
  // Anything unmapped never reaches the user verbatim.
  return publicErrorMessage(message, {
    fallback: "We couldn't complete that request. Please try again.",
  });
}
