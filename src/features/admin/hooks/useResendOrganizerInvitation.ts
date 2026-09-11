import { useMutation } from "@tanstack/react-query";
import { resendOrganizerInvitation } from "../api/profilesRepo";

/**
 * Re-sends an organizer invitation that was never accepted.
 *
 * Nothing is cached: the Edge Function's only durable effects are the email
 * and the audit record, neither of which is read through a query key here.
 * Each call mints a fresh idempotency key inside the repository, so a
 * deliberate second resend is a second email while a double-clicked button
 * is one (the button is disabled for the in-flight request).
 */
export function useResendOrganizerInvitation() {
  const mutation = useMutation({
    mutationFn: (userId: string) => resendOrganizerInvitation(userId),
  });

  return {
    resend: mutation.mutate,
    isSending: mutation.isPending,
    sentTo: mutation.data?.email ?? null,
    error: mutation.error?.message ?? null,
  };
}
