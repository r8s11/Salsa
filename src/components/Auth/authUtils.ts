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
  // Unconfirmed email keeps its message (the resend button appears below it).
  return message;
}
